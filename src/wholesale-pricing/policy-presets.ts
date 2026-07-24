import type { PricingPolicy } from "./types.js";

export const HIEP_THAI_WHOLESALE_POLICY: Readonly<PricingPolicy> = Object.freeze({
  pilotLocationName: "Hiep Thai",
  minimumMarginRate: 0.2,
  maximumIncreaseRate: 0.15,
  maximumDecreaseRate: 0.1,
  highVolumeMovementCapRate: 0.02,
  routineMovementRate: 0.03,
  managerApprovalThresholdRate: 0.05,
  executiveApprovalThresholdRate: 0.1,
  autoConfidenceThreshold: 0.8,
  recommendationConfidenceThreshold: 0.6,
  maximumCostAgeDays: 30,
  priceIncrement: 0.01,
  candidateLimit: 50,
  marketHalfLifeDays: 30,
  targetMarginRates: [0.2, 0.25, 0.3, 0.35],
  targetMarkupRates: [0.35, 0.5, 0.75, 1],
  marketParityFactors: [0.95, 1, 1.05],
  fallbackElasticity: -1.5,
  riskAversion: 0.25,
  priceStabilityPenaltyRate: 0.02,
  inventoryTargetPenaltyRate: 0.05,
});

export function createHiepThaiWholesalePolicy(
  overrides: Partial<PricingPolicy> = {},
): PricingPolicy {
  return {
    ...HIEP_THAI_WHOLESALE_POLICY,
    ...overrides,
    pilotLocationName:
      overrides.pilotLocationName ??
      HIEP_THAI_WHOLESALE_POLICY.pilotLocationName,
    minimumMarginRate:
      overrides.minimumMarginRate ??
      HIEP_THAI_WHOLESALE_POLICY.minimumMarginRate,
  };
}
