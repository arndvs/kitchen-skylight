export class AppError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function notFound(what: string): AppError {
  return new AppError('NOT_FOUND', `${what} not found`)
}

export function invalid(message: string): AppError {
  return new AppError('INVALID', message)
}
