/** Log an `openDocument` failure through the app-provided logger. */
export const logOpenDocumentError = (logError: (message: string, error?: unknown) => void, err: unknown): void => logError('openDocument:', err);
