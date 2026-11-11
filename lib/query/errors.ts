export class JVerseApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly correlationId?: string) {
    super(message);
    this.name = "JVerseApiError";
  }
}
