import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, 'Invalid request data', result.error.issues);
  }
  return result.data;
}

export function parseRange(value: unknown) {
  const allowed = ['1h', '6h', '24h', '7d', '30d'] as const;
  type Range = (typeof allowed)[number];
  const range: Range = typeof value === 'string' && allowed.includes(value as Range) ? value as Range : '24h';
  const durations: Record<Range, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  return { range, since: new Date(Date.now() - durations[range]) };
}