export class ServiceError extends Error {
  constructor(message, { code, status = 400, details } = {}) {
    super(message);
    this.name = "ServiceError";
    this.code = code ?? "SERVICE_ERROR";
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends ServiceError {
  constructor(message, details) {
    super(message, { code: "VALIDATION_ERROR", status: 400, details });
    this.name = "ValidationError";
  }
}

export class ConflictError extends ServiceError {
  constructor(message, details) {
    super(message, { code: "FLIGHT_CONFLICT", status: 409, details });
    this.name = "ConflictError";
  }
}
