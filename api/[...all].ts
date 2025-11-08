import { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../backend-lib/app';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res); // This MUST return or respond
}
