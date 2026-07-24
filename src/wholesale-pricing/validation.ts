import type { PricingRequest } from "./types.js";

export function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be greater than zero.`);
  }
}

function isNonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNonNegative(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

export function hardDataBlockers(request: PricingRequest): string[] {
  const reasons: string[] = [];
  if (!isNonEmpty(request.identity.variantId)) {
    reasons.push("MISSING_VARIANT_ID");
  }
  if (!isNonEmpty(request.identity.sellerLocationId)) {
    reasons.push("MISSING_SELLER_LOCATION_ID");
  }
  if (!isNonEmpty(request.identity.buyerPricebookId)) {
    reasons.push("MISSING_BUYER_PRICEBOOK_ID");
  }
  if (!isNonEmpty(request.identity.salesChannel)) {
    reasons.push("MISSING_SALES_CHANNEL");
  }
  if (
    !Number.isInteger(request.identity.quantityBreak) ||
    request.identity.quantityBreak < 1
  ) {
    reasons.push("INVALID_QUANTITY_BREAK");
  }
  if (request.identity.sellerLocationName !== request.policy.pilotLocationName) {
    reasons.push("WRONG_PILOT_LOCATION");
  }
  if (!request.identity.sku && !request.identity.barcode) {
    reasons.push("MISSING_SKU_OR_BARCODE");
  }
  if (!request.dataQuality.inventoryTracked) {
    reasons.push("INVENTORY_NOT_TRACKED");
  }
  if (!request.dataQuality.excludedOrdersFiltered) {
    reasons.push("INELIGIBLE_ORDERS_NOT_FILTERED");
  }
  if (request.dataQuality.priceLocked) {
    reasons.push("PRICE_LOCKED");
  }
  if (request.dataQuality.mapStatus === "VIOLATION") {
    reasons.push("MAP_POLICY_VIOLATION");
  }
  if (request.dataQuality.dataAnomaly) {
    reasons.push("UNRESOLVED_DATA_ANOMALY");
  }
  if (!Number.isFinite(request.costs.purchaseCost) || request.costs.purchaseCost <= 0) {
    reasons.push("INVALID_COST");
  }
  if (!Number.isFinite(request.currentPrice) || request.currentPrice <= 0) {
    reasons.push("INVALID_CURRENT_PRICE");
  }
  if (!Number.isFinite(request.demand.baselineUnits) || request.demand.baselineUnits < 0) {
    reasons.push("INVALID_BASELINE_DEMAND");
  }
  if (
    request.demand.horizonDays !== undefined &&
    (!Number.isFinite(request.demand.horizonDays) || request.demand.horizonDays <= 0)
  ) {
    reasons.push("INVALID_DEMAND_HORIZON");
  }
  if (
    !Number.isFinite(request.inventory.availableUnits) ||
    request.inventory.availableUnits < 0 ||
    !isFiniteNonNegative(request.inventory.incomingUnits) ||
    !isFiniteNonNegative(request.inventory.transferableUnits) ||
    !isFiniteNonNegative(request.inventory.reservedUnits)
  ) {
    reasons.push("INVALID_INVENTORY_INPUT");
  }
  return reasons;
}
