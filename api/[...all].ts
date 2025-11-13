type VercelRequest = import('@vercel/node').VercelRequest;
type VercelResponse = import('@vercel/node').VercelResponse;
type RequestHandler = import('express').RequestHandler;

const path = require('path');
const fs = require('fs');

function loadApp(): RequestHandler {
  try {
    // Prefer compiled backend when available (prod build / Vercel)
    const compiledPath = path.join(__dirname, '..', 'dist', 'backend-lib', 'app.js');
    if (!fs.existsSync(compiledPath)) {
      throw new Error(`compiled backend not found at ${compiledPath}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const compiled = require(compiledPath);
    return compiled.default ?? compiled;
  } catch (err) {
    const reason = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
    console.warn('[api] compiled backend missing, falling back to TS source', reason);
    try {
      const tsConfigPath = path.join(__dirname, '..', 'backend-lib', 'tsconfig.server.json');
      process.env.TS_NODE_PROJECT = tsConfigPath;
      require('ts-node/register/transpile-only');
    } catch (tsErr) {
      console.error('[api] failed to register ts-node', tsErr);
      throw err;
    }
    const sourcePath = path.join(__dirname, '..', 'backend-lib', 'app.ts');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const source = require(sourcePath);
    return source.default ?? source;
  }
}

const app: RequestHandler = loadApp();

const handler = (req: VercelRequest, res: VercelResponse) => {
  console.log('[API HIT]', req.method, req.url);
  return app(req as any, res as any, () => {});
};

module.exports = handler;
