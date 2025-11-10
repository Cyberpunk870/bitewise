import { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../backend-lib/app';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[API HIT)', req.method, req.url);
  return app(req, res); // This MUST return or respond
}


