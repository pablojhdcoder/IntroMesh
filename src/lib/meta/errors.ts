export class MetaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaConfigError";
  }
}

export class MetaRateLimitError extends Error {
  readonly retryable = true;

  constructor(message = "Local Meta Model API rate limit exceeded") {
    super(message);
    this.name = "MetaRateLimitError";
  }
}

export class MetaApiError extends Error {
  readonly status: number | null;
  readonly type: string | null;
  readonly code: string | null;
  readonly param: string | null;
  readonly retryable: boolean;

  constructor(details: {
    message: string;
    status: number | null;
    type: string | null;
    code: string | null;
    param: string | null;
    retryable: boolean;
  }) {
    super(details.message);
    this.name = "MetaApiError";
    this.status = details.status;
    this.type = details.type;
    this.code = details.code;
    this.param = details.param;
    this.retryable = details.retryable;
  }
}
