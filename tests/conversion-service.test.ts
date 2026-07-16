import { describe, expect, it } from "vitest";
import {
  approveConversion,
  previewConversion,
  type InventoryGateway,
} from "../src/conversion-service.js";
import { MemoryPreviewStore } from "../src/memory-preview-store.js";
import type { ShopifyAdjustmentPlan } from "../src/shopify-adjustment.js";

function gatewayWith(levels: Record<string, number>): InventoryGateway & { plans: ShopifyAdjustmentPlan[] } {
  const plans: ShopifyAdjustmentPlan[] = [];
  return {
    plans,
    async readAvailable(_locationId, ids) {
      return Object.fromEntries(ids.map((id) => [id, levels[id]]));
    },
    async apply(plan) {
      plans.push(plan);
      return { transactionId: "txn-1" };
    },
  };
}

const mapping = {
  baseSku: "7577",
  caseSku: "7577case/72",
  unitsPerCase: 72,
  baseInventoryItemId: "base-1",
  caseInventoryItemId: "case-1",
  minimumBaseUnits: 1,
  minimumCaseUnits: 0,
};

describe("conversion service", () => {
  it("previews and approves a case-to-base conversion", async () => {
    const gateway = gatewayWith({ "case-1": 5, "base-1": -10 });
    const store = new MemoryPreviewStore();
    const preview = await previewConversion({
      gateway,
      store,
      shopDomain: "sam-nail-supply.myshopify.com",
      locationId: "79814754495",
      mapping,
    });

    expect(preview.action).toBe("CASE_TO_BASE");
    expect(preview.newCaseQty).toBe(4);
    expect(preview.newBaseQty).toBe(62);

    const applied = await approveConversion({ gateway, store, previewId: preview.previewId });
    expect(applied.transactionId).toBe("txn-1");
    expect(gateway.plans).toHaveLength(1);
    expect(gateway.plans[0].changes.map((change) => change.delta)).toEqual([-1, 72]);
  });

  it("blocks approval when inventory changed after preview", async () => {
    const levels = { "case-1": 5, "base-1": -10 };
    const gateway = gatewayWith(levels);
    const store = new MemoryPreviewStore();
    const preview = await previewConversion({
      gateway,
      store,
      shopDomain: "sam-nail-supply.myshopify.com",
      locationId: "79814754495",
      mapping,
    });

    levels["base-1"] = 3;
    await expect(
      approveConversion({ gateway, store, previewId: preview.previewId }),
    ).rejects.toThrow("Inventory changed after preview");
    expect(gateway.plans).toHaveLength(0);
  });

  it("blocks duplicate approval", async () => {
    const gateway = gatewayWith({ "case-1": 5, "base-1": -10 });
    const store = new MemoryPreviewStore();
    const preview = await previewConversion({
      gateway,
      store,
      shopDomain: "sam-nail-supply.myshopify.com",
      locationId: "79814754495",
      mapping,
    });

    await approveConversion({ gateway, store, previewId: preview.previewId });
    await expect(
      approveConversion({ gateway, store, previewId: preview.previewId }),
    ).rejects.toThrow("already applied");
  });
});
