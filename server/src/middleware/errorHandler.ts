import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../services/http';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }

  const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
  if (code === 'P2002') {
    res.status(409).json({ error: { message: 'A record with those details already exists.' } });
    return;
  }
  if (code === 'P2003') {
    res.status(409).json({ error: { message: 'This record is still referenced by other data.' } });
    return;
  }
  if (code === 'P2025') {
    res.status(404).json({ error: { message: 'The requested record was not found.' } });
    return;
  }

  res.status(500).json({ error: { message: 'The request could not be completed.' } });
}
