import { Router } from "express";
import multer from "multer";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { runPdfImportPipeline } from "../domain/pdfImport.js";
import { env } from "../env.js";

export const uploadsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

if (!existsSync(env.uploadDir)) mkdirSync(env.uploadDir, { recursive: true });

/**
 * Раздел 20.1: "Ключевой сценарий: менеджер загружает PDF нового дома, которого нет в 13
 * моделях". Этот маршрут — тот же обработчик, что используется для стартовой библиотеки
 * (раздел Г.14): нет отдельного "быстрого пути" для каталожных проектов.
 */
uploadsRouter.post("/pdf", requireAuth, requireRole("MANAGER", "OWNER"), upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Файл не передан (ожидается multipart поле 'file')" });
    return;
  }
  if (req.file.mimetype !== "application/pdf") {
    res.status(400).json({ error: "Ожидается PDF" });
    return;
  }

  const importResult = await runPdfImportPipeline(req.file.buffer);

  const existingJob = await prisma.importJob.findFirst({ where: { sha256: importResult.sha256 } });
  if (existingJob) {
    res.status(200).json({ ...existingJob, extracted: existingJob.extracted ? JSON.parse(existingJob.extracted) : null, deduplicated: true });
    return;
  }

  const storagePath = path.join(env.uploadDir, `${importResult.sha256}.pdf`);
  writeFileSync(storagePath, req.file.buffer);

  const job = await prisma.importJob.create({
    data: {
      projectId: (req.body?.projectId as string) || null,
      filename: req.file.originalname,
      sha256: importResult.sha256,
      status: importResult.status,
      stageLog: JSON.stringify([
        { stage: "received", at: new Date().toISOString() },
        { stage: "pages_detected", at: new Date().toISOString(), pageCount: importResult.pageCount },
        { stage: importResult.status, at: new Date().toISOString() },
      ]),
      extracted: JSON.stringify(importResult.pages),
      errorMessage: importResult.errorMessage ?? null,
    },
  });

  if (req.body?.projectId) {
    await prisma.attachment.create({
      data: {
        projectId: req.body.projectId,
        filename: req.file.originalname,
        sha256: importResult.sha256,
        mimeType: "application/pdf",
        kind: "source_pdf",
        storagePath,
        containsPrices: false,
        uploadedById: req.user!.sub,
      },
    });
  }

  res.status(201).json({ ...job, extracted: importResult.pages, deduplicated: false });
});

uploadsRouter.get("/:jobId", requireAuth, async (req, res) => {
  const job = await prisma.importJob.findUnique({ where: { id: req.params.jobId } });
  if (!job) {
    res.status(404).json({ error: "Задача импорта не найдена" });
    return;
  }
  res.json({ ...job, extracted: job.extracted ? JSON.parse(job.extracted) : null });
});
