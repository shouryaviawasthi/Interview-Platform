/**
 * ApiError
 *
 * A lightweight Error subclass that carries an HTTP status code, so the
 * central errorHandler middleware can respond with the right status
 * instead of always falling back to 500 (or an accidental 200).
 *
 * Usage: throw new ApiError('Interview not found', 404);
 */
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Bad request') {
    return new ApiError(message, 400);
  }

  static unauthorized(message = 'Not authorized') {
    return new ApiError(message, 401);
  }

  static forbidden(message = 'Access denied') {
    return new ApiError(message, 403);
  }

  static notFound(message = 'Not found') {
    return new ApiError(message, 404);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(message, 409);
  }

  static badGateway(message = 'Upstream service error') {
    return new ApiError(message, 502);
  }
}

module.exports = ApiError;
