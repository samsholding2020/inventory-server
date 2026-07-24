import type { PricingIdentity } from "./types.js";

function requiredSegment(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required to build a pricing decision key.`);
  }
  return encodeURIComponent(value.trim());
}

export function buildPricingDecisionKey(identity: PricingIdentity): string {
  if (!Number.isInteger(identity.quantityBreak) || identity.quantityBreak < 1) {
    throw new Error("quantityBreak must be a positive whole number.");
  }

  return [
    requiredSegment("variantId", identity.variantId),
    requiredSegment("sellerLocationId", identity.sellerLocationId),
    requiredSegment("buyerPricebookId", identity.buyerPricebookId),
    String(identity.quantityBreak),
    requiredSegment("salesChannel", identity.salesChannel),
    encodeURIComponent(identity.effectiveFrom ?? "CURRENT"),
  ].join("::");
}
