import type {
  QuantityBreakTier,
  QuantityBreakValidation,
  QuantityBreakViolation,
} from "./types.js";

export function validateQuantityBreakSchedule(args: {
  tiers: QuantityBreakTier[];
  maximumDiscountRate?: number;
}): QuantityBreakValidation {
  const violations: QuantityBreakViolation[] = [];
  const maximumDiscountRate = args.maximumDiscountRate;
  const firstPrice = args.tiers[0]?.unitPrice ?? 0;

  for (let index = 0; index < args.tiers.length; index += 1) {
    const tier = args.tiers[index];
    if (!tier) continue;
    if (!Number.isInteger(tier.minimumQuantity) || tier.minimumQuantity < 1) {
      violations.push({
        code: "INVALID_MINIMUM_QUANTITY",
        tierIndex: index,
        message: "Quantity breaks must be positive whole numbers.",
      });
    }
    if (!Number.isFinite(tier.unitPrice) || tier.unitPrice <= 0) {
      violations.push({
        code: "BELOW_PROTECTED_FLOOR",
        tierIndex: index,
        message: "Unit price must be greater than zero and at or above the protected floor.",
      });
    } else if (tier.unitPrice + 0.0001 < tier.protectedFloor) {
      violations.push({
        code: "BELOW_PROTECTED_FLOOR",
        tierIndex: index,
        message: `Unit price ${tier.unitPrice.toFixed(2)} is below protected floor ${tier.protectedFloor.toFixed(2)}.`,
      });
    }

    if (
      maximumDiscountRate !== undefined &&
      firstPrice > 0 &&
      (firstPrice - tier.unitPrice) / firstPrice > maximumDiscountRate + 0.0001
    ) {
      violations.push({
        code: "DISCOUNT_EXCEEDS_POLICY",
        tierIndex: index,
        message: "The quantity discount exceeds the configured policy cap.",
      });
    }

    if (index === 0) continue;
    const previous = args.tiers[index - 1];
    if (!previous) continue;
    if (tier.minimumQuantity <= previous.minimumQuantity) {
      violations.push({
        code: "DUPLICATE_OR_UNSORTED_BREAK",
        tierIndex: index,
        message: "Quantity breaks must be strictly increasing.",
      });
    }
    if (tier.unitPrice > previous.unitPrice + 0.0001) {
      violations.push({
        code: "UNIT_PRICE_INCREASES_WITH_VOLUME",
        tierIndex: index,
        message: "Unit price cannot increase at a larger quantity break.",
      });
    }

    const totalAtNewBreak = tier.minimumQuantity * tier.unitPrice;
    const totalImmediatelyBeforeBreak =
      Math.max(1, tier.minimumQuantity - 1) * previous.unitPrice;
    if (totalAtNewBreak + 0.0001 < totalImmediatelyBeforeBreak) {
      violations.push({
        code: "TOTAL_ORDER_VALUE_DECREASES",
        tierIndex: index,
        message:
          "The new quantity break would let the buyer receive more units for a lower total invoice.",
      });
    }
  }

  return { valid: violations.length === 0, violations };
}
