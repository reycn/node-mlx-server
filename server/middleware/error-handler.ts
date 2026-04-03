import { Request, Response, NextFunction } from 'express';

/**
 * Global error handling middleware.
 * Catches unhandled errors and returns appropriate error responses.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[ERROR] %s %s:', req.method, req.path, err.message);

  // Determine error format based on the route prefix
  const isAnthropic = req.path.startsWith('/v1/messages');

  if (isAnthropic) {
    res.status(500).json({
      type: 'error',
      error: {
        type: 'api_error',
        message: err.message || 'Internal server error',
      },
    });
  } else {
    res.status(500).json({
      error: {
        message: err.message || 'Internal server error',
        type: 'server_error',
        code: 'internal_error',
      },
    });
  }
}
