import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RequestHandler } from 'express';

const appModule = require('../backend-lib/app');
const app: RequestHandler = appModule.default ?? appModule;

const handler = (req: VercelRequest, res: VercelResponse) => {
  console.log('[API HIT]', req.method, req.url);
  return app(req as any, res as any, () => {});
};

module.exports = handler;

