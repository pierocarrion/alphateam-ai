/**
 * Error intended to be shown directly to the user.
 *
 * Throw this from use-cases or route handlers when the message is safe and
 * friendly to display. Anything thrown as a plain `Error` is treated as an
 * internal/technical failure and replaced with a generic friendly message by
 * the `apiErrors` helper — so never put user-facing copy in a plain `Error`.
 */
export class UserFacingError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UserFacingError";
    this.status = status;
  }
}
