// bitewise/api/[...all].ts
import { app } from '../server/app';

// Tell Vercel which runtime to use
export const config = { runtime: 'nodejs18.x' };

// Forward requests to your Express app
export default function handler(req: any, res: any) {
  return (app as any)(req, res);
}
