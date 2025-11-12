type VercelRequest = import('@vercel/node').VercelRequest;
type VercelResponse = import('@vercel/node').VercelResponse;
type RequestHandler = import('express').RequestHandler;

function loadApp(): RequestHandler {
  try {
    // Prefer compiled backend when available (prod build / Vercel)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const compiled = require('../dist/backend-lib/app.js');
    return compiled.default ?? compiled;
  } catch (err) {
    const reason = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
    console.warn('[api] compiled backend missing, falling back to TS source', reason);
    try {
      require('ts-node/register/transpile-only');
    } catch (tsErr) {
      console.error('[api] failed to register ts-node', tsErr);
      throw err;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const source = require('../backend-lib/app');
    return source.default ?? source;
  }
}

const app: RequestHandler = loadApp();

const handler = (req: VercelRequest, res: VercelResponse) => {
  console.log('[API HIT]', req.method, req.url);
  return app(req as any, res as any, () => {});
};

module.exports = handler;
