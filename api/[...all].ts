type VercelRequest = import('@vercel/node').VercelRequest;
type VercelResponse = import('@vercel/node').VercelResponse;
type RequestHandler = import('express').RequestHandler;

// Always load the prebuilt CJS backend copied into api/backend-cjs during build.
// This keeps the function self-contained and avoids relying on dist paths.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appModule = require("./backend-cjs/app.js");
const app: RequestHandler = appModule.default ?? appModule;

const handler = (req: VercelRequest, res: VercelResponse) => {
  console.log("[API HIT]", req.method, req.url);
  return app(req as any, res as any, () => {});
};

module.exports = handler;
