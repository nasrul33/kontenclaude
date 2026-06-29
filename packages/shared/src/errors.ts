export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION', message, 400);
    this.name = 'ValidationError';
  }
}

export class PlatformConstraintError extends AppError {
  constructor(message: string) {
    super('PLATFORM_CONSTRAINT', message, 422);
    this.name = 'PlatformConstraintError';
  }
}

export class AIOutputInvalidError extends AppError {
  constructor(message: string) {
    super('AI_OUTPUT_INVALID', message, 502);
    this.name = 'AIOutputInvalidError';
  }
}
