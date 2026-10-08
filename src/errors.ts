export type PaletteErrorCode =
  | 'NOT_READY'
  | 'INVALID_VIEW_RELATIONSHIP'
  | 'INVALID_POINT'
  | 'UNRESOLVED_BACKDROP'
  | 'UNSUPPORTED_CONTENT'
  | 'CAPTURE_FAILED'
  | 'ABORTED';

export class PaletteError extends Error {
  readonly code: PaletteErrorCode;

  constructor(code: PaletteErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'PaletteError';
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
