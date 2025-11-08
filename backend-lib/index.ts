// bitewise/server/index.ts
import  app  from "./app";

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
})
