import { describe, expect, it } from "vitest";
import { redactSnapshotForRole, permissions } from "./rbac";
import { buildBarn96KyzylSnapshot } from "./templates/barn96Kyzyl";

describe("RBAC redaction (acceptance #26)", () => {
  const snapshot = buildBarn96KyzylSnapshot({ terraceDepthM: 2, selectedOptionIds: ["warm-floor"] });

  it("SHOP never receives cost, price, or margin figures in the payload", () => {
    const shopView = redactSnapshotForRole(snapshot, "SHOP");
    expect(shopView.compositionLines.every((l) => l.unitCostRub === null && l.totalCostRub === null)).toBe(true);
    expect(shopView.costSummary.fullCostRub).toBe(0);
    expect(shopView.priceSummary.roundedPriceRub).toBe(0);
    expect(shopView.priceSummary.profitRub).toBe(0);
    expect(JSON.stringify(shopView)).not.toContain(String(snapshot.priceSummary.roundedPriceRub));
  });

  it("SHOP still sees quantities and hours needed to do the work", () => {
    const shopView = redactSnapshotForRole(snapshot, "SHOP");
    const pipeCoils = shopView.compositionLines.find((l) => l.key === "interior:floor:warm-coils");
    expect(pipeCoils?.qty).toBeGreaterThan(0);
    expect(shopView.laborStages.every((s) => s.hours > 0)).toBe(true);
  });

  it("MANAGER sees the price and floor but not cost breakdown or profit/margin", () => {
    const managerView = redactSnapshotForRole(snapshot, "MANAGER");
    expect(managerView.priceSummary.roundedPriceRub).toBe(snapshot.priceSummary.roundedPriceRub);
    expect(managerView.priceSummary.minimumAllowedPriceRub).toBe(snapshot.priceSummary.minimumAllowedPriceRub);
    expect(managerView.priceSummary.profitRub).toBe(0);
    expect(managerView.priceSummary.markup).toBe(0);
    expect(managerView.costSummary.fullCostRub).toBe(0);
    expect(managerView.compositionLines.every((l) => l.unitCostRub === null)).toBe(true);
  });

  it("OWNER gets the full, unredacted snapshot", () => {
    const ownerView = redactSnapshotForRole(snapshot, "OWNER");
    expect(ownerView).toEqual(snapshot);
  });

  it("permission matrix matches §3", () => {
    expect(permissions.canViewCostBreakdown("SHOP")).toBe(false);
    expect(permissions.canViewCostBreakdown("MANAGER")).toBe(false);
    expect(permissions.canViewCostBreakdown("OWNER")).toBe(true);
    expect(permissions.canExportFullInternalEstimate("MANAGER")).toBe(false);
    expect(permissions.canExportProductionTask("SHOP")).toBe(true);
    expect(permissions.canSelectCompositionAndPrice("SHOP")).toBe(false);
  });
});
