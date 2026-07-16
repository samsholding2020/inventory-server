import { calculateUnitConversion, type UnitMapping } from "./conversion.js";
import {
  buildShopifyAdjustmentPlan,
  type ShopifyAdjustmentPlan,
} from "./shopify-adjustment.js";

export interface InventorySnapshot {
  shopDomain: string;
  locationId: string;
  mapping: UnitMapping;
  caseQty: number;
  baseQty: number;
  capturedAt: string;
}

export interface ConversionPreview extends InventorySnapshot {
  previewId: string;
  action: "CASE_TO_BASE" | "BASE_TO_CASE" | "NO_CONVERSION";
  casesConverted: number;
  newCaseQty: number;
  newBaseQty: number;
  reason: string;
  adjustmentPlan: ShopifyAdjustmentPlan | null;
}

export interface InventoryGateway {
  readAvailable(locationId: string, inventoryItemIds: string[]): Promise<Record<string, number>>;
  apply(plan: ShopifyAdjustmentPlan): Promise<{ transactionId: string }>;
}

export interface PreviewStore {
  save(preview: ConversionPreview): Promise<void>;
  get(previewId: string): Promise<ConversionPreview | null>;
  markApplied(previewId: string, transactionId: string): Promise<void>;
  wasApplied(previewId: string): Promise<boolean>;
}

function previewKey(locationId: string, mapping: UnitMapping, caseQty: number, baseQty: number): string {
  return [locationId, mapping.caseSku, mapping.baseSku, caseQty, baseQty, Date.now()].join(":");
}

export async function previewConversion(args: {
  gateway: InventoryGateway;
  store: PreviewStore;
  shopDomain: string;
  locationId: string;
  mapping: UnitMapping;
  allowBaseToCaseWhenCasesExist?: boolean;
}): Promise<ConversionPreview> {
  const { gateway, store, shopDomain, locationId, mapping } = args;
  if (mapping.enabled === false) throw new Error("This unit mapping is disabled.");

  const levels = await gateway.readAvailable(locationId, [
    mapping.caseInventoryItemId,
    mapping.baseInventoryItemId,
  ]);
  const caseQty = levels[mapping.caseInventoryItemId];
  const baseQty = levels[mapping.baseInventoryItemId];
  if (!Number.isInteger(caseQty) || !Number.isInteger(baseQty)) {
    throw new Error("Shopify did not return valid inventory for both mapped items.");
  }

  const result = calculateUnitConversion({
    caseQty,
    baseQty,
    unitsPerCase: mapping.unitsPerCase,
    minimumBaseUnits: mapping.minimumBaseUnits,
    minimumCaseUnits: mapping.minimumCaseUnits,
    allowBaseToCaseWhenCasesExist: args.allowBaseToCaseWhenCasesExist,
  });

  const previewId = previewKey(locationId, mapping, caseQty, baseQty);
  const adjustmentPlan = buildShopifyAdjustmentPlan({
    shopDomain,
    locationId,
    mapping,
    currentCaseQty: caseQty,
    currentBaseQty: baseQty,
    conversion: result,
    runId: previewId,
  });

  const preview: ConversionPreview = {
    previewId,
    shopDomain,
    locationId,
    mapping,
    caseQty,
    baseQty,
    capturedAt: new Date().toISOString(),
    action: result.action,
    casesConverted: result.casesConverted,
    newCaseQty: result.newCaseQty,
    newBaseQty: result.newBaseQty,
    reason: result.reason,
    adjustmentPlan,
  };
  await store.save(preview);
  return preview;
}

export async function approveConversion(args: {
  gateway: InventoryGateway;
  store: PreviewStore;
  previewId: string;
}): Promise<{ transactionId: string }> {
  const preview = await args.store.get(args.previewId);
  if (!preview) throw new Error("Conversion preview was not found or has expired.");
  if (!preview.adjustmentPlan) throw new Error("This preview has no inventory conversion to apply.");
  if (await args.store.wasApplied(args.previewId)) throw new Error("This conversion was already applied.");

  const current = await args.gateway.readAvailable(preview.locationId, [
    preview.mapping.caseInventoryItemId,
    preview.mapping.baseInventoryItemId,
  ]);
  if (
    current[preview.mapping.caseInventoryItemId] !== preview.caseQty ||
    current[preview.mapping.baseInventoryItemId] !== preview.baseQty
  ) {
    throw new Error("Inventory changed after preview. Generate a new preview before approval.");
  }

  const applied = await args.gateway.apply(preview.adjustmentPlan);
  await args.store.markApplied(args.previewId, applied.transactionId);
  return applied;
}
