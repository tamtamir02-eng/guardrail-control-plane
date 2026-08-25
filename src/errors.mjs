export class FailClosedError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'FailClosedError'
    this.details = details
  }
}

export class RefChangedError extends FailClosedError {
  constructor(message, details = {}) {
    super(message, details)
    this.name = 'RefChangedError'
  }
}
