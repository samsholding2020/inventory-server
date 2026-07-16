import type { ConversionResult, UnitMapping } from "./conversion.js";

export interface ShopifyInventoryChange {
  inventoryItemId: string;
  locationId: string;
  delta: number;
}

export interface ShopifyAdjustmentPlan {
  referenceDocumentUri: string;
  idempotencyKey: string;
  reason: "correction";
  changes: ShopifyInventoryChange[];
}

export function buildShopifyAdjustmentPlan({
  shopDomain,
  locationId,
  mapping,
  currentCaseQty,
  currentBaseQty,
  conversion,
  runId,
}: {
  shopDomain: string;
  locationId: string;
  mapping: UnitMapping;
  currentCaseQty: number;
  currentBaseQty: number;
  conversion: ConversionResult;
  runId: string;
}): ShopifyAdjustmentPlan | null {
  if (conversion.action === "NO_CONVERSION") return null;
  if (!mapping.enabled && mapping.enabled !== undefined) return null;

  const caseDelta = conversion.newCaseQty - currentCaseQty;
  const baseDelta = conversion.newBaseQty - currentBaseQty;

  if (caseDelta === 0 && baseDelta === 0) return null;
  if (conversion.newCaseQty < 0) {
    throw new Error("Conversion would make case inventory negative.");
  }

  const safeShop = shopDomain.replace(/[^a-zA-Z0-9.-]/g, "");
  const safeRunId = runId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const referenceDocumentUri =
    `unit-conversion://${safeShop}/${locationId}/${mapping.caseSku}/${safeRunId}`;

  return {
    referenceDocumentUri,
    idempotencyKey: `${locationId}:${mapping.caseInventoryItemId}:${safeRunId}`,
    reason: "correction",
    changes: [
      {
        inventoryItemId: mapping.caseInventoryItemId,
        locationId,
        delta: caseDelta,
      },
      {
        inventoryItemId: mapping.baseInventoryItemId,
        locationId,
        delta: baseDelta,
      },
    ],
  };
}

export const INVENTORY_ADJUST_QUANTITIES_MUTATION = `#graphql
mutation InventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) {
    inventoryAdjustmentGroup {
      createdAt
      reason
      referenceDocumentUri
      changes {
        name
        delta
      }
    }
    userErrors {
      field
      message
    }
  }
}`;
