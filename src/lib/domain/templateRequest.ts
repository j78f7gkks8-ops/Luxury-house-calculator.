import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { catalogProjectSchema } from "@/lib/catalog/schema";
import { CalcError } from "@/lib/calc/money";
import { TemplateInput } from "./templates";

/**
 * What a client is allowed to send. For a catalog calculation the client sends
 * only the project id - the server resolves the actual model data from its own
 * imported catalog, so a caller can never smuggle in altered areas, an invented
 * pile count or a made-up model.
 */
export const templateRequestSchema = z.discriminatedUnion("templateId", [
  z.object({
    templateId: z.literal("barn-96-kyzyl"),
    terraceDepthM: z.union([z.literal(2), z.literal(3)]),
    selectedOptionIds: z.array(z.string()).default([]),
    pricingMode: z.enum(["MARKUP", "TARGET_PROFIT_RUB", "TARGET_PROFIT_SHARE"]).optional(),
    markupFraction: z.number().optional(),
    targetProfitRub: z.number().optional(),
    targetProfitShare: z.number().optional(),
    totalRoundingStepRub: z.number().optional(),
  }),
  z.object({
    templateId: z.literal("norma-77-v2"),
    selectedOptionIds: z.array(z.string()).default([]),
    pricingMode: z.enum(["MARKUP", "TARGET_PROFIT_RUB", "TARGET_PROFIT_SHARE"]).optional(),
    markupFraction: z.number().optional(),
    targetProfitRub: z.number().optional(),
    targetProfitShare: z.number().optional(),
    totalRoundingStepRub: z.number().optional(),
  }),
  z.object({
    templateId: z.literal("catalog"),
    catalogProjectId: z.string().min(1),
    selectedOptionIds: z.array(z.string()).default([]),
    pricingMode: z.enum(["MARKUP", "TARGET_PROFIT_RUB", "TARGET_PROFIT_SHARE"]).optional(),
    markupFraction: z.number().optional(),
    targetProfitRub: z.number().optional(),
    targetProfitShare: z.number().optional(),
    totalRoundingStepRub: z.number().optional(),
  }),
]);

export type TemplateRequest = z.infer<typeof templateRequestSchema>;

export async function resolveTemplateInput(request: TemplateRequest): Promise<TemplateInput> {
  if (request.templateId !== "catalog") return request;

  const row = await prisma.houseProject.findUnique({ where: { projectId: request.catalogProjectId } });
  if (!row) {
    throw new CalcError(`Проект каталога "${request.catalogProjectId}" не найден`, "CATALOG_PROJECT_NOT_FOUND");
  }
  // rawJson is exactly what was imported; re-validating keeps the calculation
  // honest even if the stored row was edited by hand.
  const catalogProject = catalogProjectSchema.parse(JSON.parse(row.rawJson));
  const { catalogProjectId: _ignored, ...rest } = request;
  return { ...rest, catalogProject };
}
