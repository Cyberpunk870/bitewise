// api/[...all].ts

import app  from "../backend-lib/app";
import { createServer } from "http";

const server = createServer(app as any);

export default (req: any, res: any) => {
  server.emit("request", req, res);
};
