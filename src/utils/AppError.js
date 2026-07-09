// A lightweight error type that carries an HTTP status code.
// Throw this from services when the failure is the caller's fault
// (bad input, empty PDF, password-protected file, etc.) so controllers
// can return the right status code and a safe message instead of
// leaking internal error details on every failure.
export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}