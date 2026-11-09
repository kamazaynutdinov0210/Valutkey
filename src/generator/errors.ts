// Messages are written for the person using the app, so the UI can show them as-is.
export class GeneratorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeneratorError'
  }
}
