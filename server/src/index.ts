import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { projectsRouter } from "./routes/projects.js";
import { actualWorkRouter } from "./routes/actualWork.js";
import { uploadsRouter } from "./routes/uploads.js";
import { exportsRouter } from "./routes/exports.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/actual-work", actualWorkRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/exports", exportsRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

app.listen(env.port, () => {
  console.log(`Luxury House Calculator API запущен на порту ${env.port}`);
});
