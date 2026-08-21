import { getOpsSummary } from "../services/opsSupervisionService.js";
import { jsonResponse, methodNotAllowed } from "./httpUtils.js";
import { requireWriteAuthorization } from "./writeAuthorization.js";

export async function handleOpsApi(request, env, url) {
  if (url.pathname !== "/api/ops/summary") return null;
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  await requireWriteAuthorization(request, env);
  const result = await getOpsSummary({
    db: env.DB,
    bindings: {
      r2: Boolean(env.SOURCE_ARCHIVE),
      queues: Boolean(env.INGESTION_QUEUE),
    },
  });
  return jsonResponse(result);
}
