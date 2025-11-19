// bitewise/server/index.ts
import app from "./app";
import logger from "./lib/logger";

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  logger.info({ port }, `Backend server running at http://localhost:${port}`);
});
