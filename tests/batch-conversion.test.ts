import { describe, expect, it } from "vitest";
import { previewBatchConversions } from "../src/batch-conversion.js";
import { MemoryPreviewStore } from "../src/memory-preview-store.js";
import type { InventoryGateway } from "../src/conversion-service.js";
import type { ShopifyAdjustmentPlan } from "../src/shopify-adjustment.js";

function gateway(levels: Record<string, number>): InventoryGateway {
  return {
    async readAvailable(_locationId, ids) {
      return Object.fromEntries(ids.map((id) => [id, levels[id]]));
    },
    async apply(_plan: ShopifyAdjustmentPlan) {
      return { transactionId: "unused" };
    },
  };
}

const mappings = [
  {
    baseSku: "7577",
    caseSku: "7577case/72",
    unitsPerCase: 72,
    baseInventoryItemId: "base-7577",
    caseInventoryItemId: "case-7577",
  },
  {
    baseSku: "29991",
    caseSku: "29991case/50",
    unitsPerCase: 50,
    baseInventoryItemId: "base-29991",
    caseInventoryItemId: "case-29991",
  },
];

describe("previewBatchConversions", () => {
  it("summarizes case-to-base and base-to-case actions", async () => {
    const result = await previewBatchConversions({
      gateway: gateway({
        "case-7577": 5,
        "base-7577": -10,
        "case-29991": 0,
        "base-29991": 121,
      }),
      store: new MemoryPreviewStore(),
      shopDomain: "sam-nail-supply.myshopify.com",
      locationId: "79814754495",
      mappings,
    });

    expect(result.summary).toMatchObject({
      mappings: 2,
      actionable: 2,
      caseToBase: 1,
      baseToCase: 1,
      blocked: 0,
    });
  });

  it("blocks an item that exceeds the unit adjustment limit", async () => {
    const result = await previewBatchConversions({
      gateway: gateway({
        "case-7577": 10,
        "base-7577": -500,
        "case-29991": 0,
        "base-29991": 1,
      }),
      store: new MemoryPreviewStore(),
      shopDomain: "sam-nail-supply.myshopify.com",
      locationId: "79814754495",
      mappings,
      policy: { maxAbsoluteUnitDeltaPerItem: 200 },
    });

    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0]?.caseSku).toBe("7577case/72");
    expect(result.summary.blocked).toBe(1);
  });

  it("rejects a batch larger than the configured maximum", async () => {
    await expect(
      previewBatchConversions({
        gateway: gateway({}),
        store: new MemoryPreviewStore(),
        shopDomain: "sam-nail-supply.myshopify.com",
        locationId: "79814754495",
        mappings,
        policy: { maxMappingsPerRun: 1 },
      }),
    ).rejects.toThrow("maximum is 1");
  });
});
