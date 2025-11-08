// /api/index.ts

import app from "../backend-lib/app";
import { createServer } from "@vercel/node";
import { RequestHandler } from "express";

export default createServer(app as RequestHandler);
