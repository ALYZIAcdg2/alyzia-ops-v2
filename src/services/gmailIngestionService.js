import { createIngestionRepository } from "../database/ingestionRepository.js";
import { importFlightData } from "../import/importFlightData.js";
import { parseSqEditing } from "../parsers/sq/parseSqEditing.js";
import { decodeBase64, sha256Hex } from "../utils/base64Utils.js";
import { ServiceError, ValidationError } from "./serviceErrors.js";

const MAX_OBJECT_BYTES = 10_000_000;
const MAX_OBJECTS = 20;
const MAX_TOTAL_BYTES = 25_000_000;

function requiredText(value, field, maximum) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} is required`, { field });
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new ValidationError(`${field} exceeds ${maximum} characters`, { field });
  }
  return normalized;
}

function optionalText(value, field, maximum) {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredText(value, field, maximum);
}

function optionalSourceText(value, field, maximum) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} must be a non-empty string`, { field });
  }
  if (value.length > maximum) {
    throw new ValidationError(`${field} exceeds ${maximum} characters`, { field });
  }
  return value;
}

function validateReceivedAt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new ValidationError("received_at must be an ISO date-time", {
      field: "body.received_at",
    });
  }
  return value;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Gmail ingestion payload must be an object", {
      field: "body",
    });
  }
  if (payload.attachments !== undefined && !Array.isArray(payload.attachments)) {
    throw new ValidationError("attachments must be an array", {
      field: "body.attachments",
    });
  }
  if ((payload.attachments?.length ?? 0) > MAX_OBJECTS) {
    throw new ValidationError(`attachments must not exceed ${MAX_OBJECTS} items`, {
      field: "body.attachments",
    });
  }
  if (
    payload.text_content === undefined &&
    payload.raw_message_base64 === undefined &&
    (payload.attachments?.length ?? 0) === 0
  ) {
    throw new ValidationError("At least one Gmail content source is required", {
      field: "body",
    });
  }
  return {
    provider_message_id: requiredText(
      payload.provider_message_id,
      "body.provider_message_id",
      200,
    ),
    provider_thread_id: optionalText(
      payload.provider_thread_id,
      "body.provider_thread_id",
      200,
    ),
    received_at: validateReceivedAt(payload.received_at),
    created_by: requiredText(payload.created_by, "body.created_by", 100),
    text_content: optionalSourceText(
      payload.text_content,
      "body.text_content",
      400_000,
    ),
    raw_message_base64: payload.raw_message_base64,
    attachments: payload.attachments ?? [],
    sq_import: payload.sq_import,
  };
}

function decodeContent(value, field) {
  try {
    return decodeBase64(value, { maximumBytes: MAX_OBJECT_BYTES });
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : "base64 content is invalid",
      { field },
    );
  }
}

function contentItems(payload) {
  const items = [];
  if (payload.raw_message_base64 !== undefined) {
    items.push({
      role: "RAW_MESSAGE",
      source_name: "gmail-message.eml",
      media_type: "message/rfc822",
      bytes: decodeContent(payload.raw_message_base64, "body.raw_message_base64"),
    });
  }
  if (payload.text_content !== undefined) {
    items.push({
      role: "BODY_TEXT",
      source_name: "gmail-body.txt",
      media_type: "text/plain; charset=utf-8",
      bytes: new TextEncoder().encode(payload.text_content),
    });
  }
  for (const [index, attachment] of payload.attachments.entries()) {
    if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
      throw new ValidationError("attachment must be an object", {
        field: `body.attachments[${index}]`,
      });
    }
    items.push({
      role: "ATTACHMENT",
      source_name: requiredText(
        attachment.filename,
        `body.attachments[${index}].filename`,
        200,
      ),
      media_type: optionalText(
        attachment.media_type,
        `body.attachments[${index}].media_type`,
        100,
      ) ?? "application/octet-stream",
      bytes: decodeContent(
        attachment.content_base64,
        `body.attachments[${index}].content_base64`,
      ),
    });
  }
  const totalBytes = items.reduce((sum, item) => sum + item.bytes.byteLength, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new ValidationError("Gmail content exceeds the total size limit", {
      field: "body",
      maximum_bytes: MAX_TOTAL_BYTES,
    });
  }
  return items;
}

function datePath(receivedAt) {
  const date = receivedAt ? new Date(receivedAt) : new Date();
  return [
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("/");
}

async function storeItems({ bucket, repository, ingestionId, messageHash, receivedAt, items }) {
  const stored = [];
  for (const [index, item] of items.entries()) {
    const contentHash = await sha256Hex(item.bytes);
    const key = `gmail/${datePath(receivedAt)}/${messageHash}/${String(index + 1).padStart(2, "0")}-${contentHash.slice(0, 20)}`;
    const record = {
      r2_key: key,
      object_role: item.role,
      source_name: item.source_name,
      media_type: item.media_type,
      size_bytes: item.bytes.byteLength,
      sha256: contentHash,
      object_status: "STORED",
    };
    await bucket.put(key, item.bytes, {
      httpMetadata: { contentType: item.media_type },
      customMetadata: { role: item.role },
    });
    try {
      await repository.addObject(ingestionId, record);
    } catch (error) {
      await bucket.delete(key);
      throw error;
    }
    stored.push(record);
  }
  return stored;
}

function validateSqImport(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("sq_import must be an object", {
      field: "body.sq_import",
    });
  }
  if (value.execute !== true && value.execute !== false) {
    throw new ValidationError("sq_import.execute must be boolean", {
      field: "body.sq_import.execute",
    });
  }
  if (
    value.options !== undefined &&
    (!value.options || typeof value.options !== "object" || Array.isArray(value.options))
  ) {
    throw new ValidationError("sq_import.options must be an object", {
      field: "body.sq_import.options",
    });
  }
  if (
    value.execute === true &&
    (!value.context || typeof value.context !== "object" || Array.isArray(value.context))
  ) {
    throw new ValidationError(
      "sq_import.context is required when execution is requested",
      { field: "body.sq_import.context" },
    );
  }
  return value;
}

export async function ingestGmailMessage({ db, bucket, payload }) {
  if (!bucket || typeof bucket.put !== "function") {
    throw new ServiceError("Gmail ingestion requires an R2 bucket binding", {
      code: "R2_BINDING_NOT_CONFIGURED",
      status: 503,
    });
  }
  const normalized = validatePayload(payload);
  normalized.sq_import = validateSqImport(normalized.sq_import);
  if (normalized.sq_import && normalized.text_content === undefined) {
    throw new ValidationError("text_content is required for SQ processing", {
      field: "body.text_content",
    });
  }
  const items = contentItems(normalized);
  const repository = createIngestionRepository(db);
  const duplicate = await repository.findByProviderMessageId(
    normalized.provider_message_id,
  );
  if (duplicate) {
    throw new ServiceError("Gmail message was already ingested", {
      code: "GMAIL_MESSAGE_ALREADY_INGESTED",
      status: 409,
      details: { ingestion_id: duplicate.id },
    });
  }

  const messageHash = await sha256Hex(normalized.provider_message_id);
  const ingestionId = `GMAIL-${messageHash.slice(0, 32).toUpperCase()}`;
  await repository.createMessage({
    id: ingestionId,
    provider_message_id: normalized.provider_message_id,
    provider_thread_id: normalized.provider_thread_id,
    ingestion_status: "PENDING",
    received_at: normalized.received_at,
    created_by: normalized.created_by,
  });

  try {
    const objects = await storeItems({
      bucket,
      repository,
      ingestionId,
      messageHash,
      receivedAt: normalized.received_at,
      items,
    });
    if (!normalized.sq_import || normalized.text_content === undefined) {
      await repository.updateStatus(ingestionId, "STORED");
      return { ingestion_id: ingestionId, status: "STORED", objects };
    }

    const parse = parseSqEditing({
      source_text: normalized.text_content,
      options: normalized.sq_import.options,
    });
    if (!parse.can_import || normalized.sq_import.execute === false) {
      const status = parse.can_import ? "STORED" : "REVIEW_REQUIRED";
      await repository.updateStatus(ingestionId, status);
      return { ingestion_id: ingestionId, status, objects, parse };
    }

    const bodyObject = objects.find((object) => object.object_role === "BODY_TEXT");
    const result = await importFlightData({
      db,
      model: parse.model,
      context: {
        ...normalized.sq_import.context,
        source: {
          source_type: "GMAIL",
          source_name: "Gmail body text",
          source_document: bodyObject?.r2_key,
          detected_type: parse.parser.detected_type,
          detection_confidence: parse.parser.detection_confidence,
          source_timestamp: normalized.received_at,
          file_status: "RECOGNIZED",
        },
        parser_name: parse.parser.name,
        parser_version: parse.parser.version,
      },
    });
    const status = ["PROCESSED", "NO_CHANGE", "REVIEW_REQUIRED", "ERROR"].includes(
      result.status,
    )
      ? result.status
      : "ERROR";
    await repository.updateStatus(ingestionId, status, {
      import_id: result.import_id,
    });
    return { ingestion_id: ingestionId, status, objects, parse, result };
  } catch (error) {
    await repository.updateStatus(ingestionId, "ERROR");
    throw error;
  }
}
