import {
  previewWholesalePrice,
  type PricingPreview,
  type PricingPreviewStore,
} from "./service.js";
import type { ApprovalLevel, PricingRequest } from "./types.js";

export interface BatchPricingSafetyPolicy {
  maxItemsPerRun?: number;
  maxAutoEligibleItems?: number;
  maxAutoEligibleShare?: number;
  blockedRateAutomationStop?: number;
}

export interface BatchAutomationSuppression {
  previewId: string;
  reason:
    | "BATCH_AUTO_LIMIT_REACHED"
    | "BATCH_AUTO_SHARE_LIMIT_REACHED"
    | "BATCH_BLOCK_RATE_EXCEEDED";
}

export interface BatchPricingPreviewResult {
  previews: PricingPreview[];
  automationEligiblePreviewIds: string[];
  automationSuppressed: BatchAutomationSuppression[];
  summary: {
    requested: number;
    recommended: number;
    blocked: number;
    recommendationOnly: number;
    managerApproval: number;
    executiveApproval: number;
    autoEligibleByItemPolicy: number;
    autoEligibleAfterBatchSafety: number;
    raises: number;
    lowers: number;
    holds: number;
    projectedThirtyDayProfitLift: number;
  };
}

function countApproval(
  previews: PricingPreview[],
  approvalLevel: ApprovalLevel,
): number {
  return previews.filter(
    (preview) => preview.recommendation.approvalLevel === approvalLevel,
  ).length;
}

function assertRate(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
}

export async function previewBatchWholesalePrices(args: {
  requests: PricingRequest[];
  store: PricingPreviewStore;
  safetyPolicy?: BatchPricingSafetyPolicy;
}): Promise<BatchPricingPreviewResult> {
  const maxItems = args.safetyPolicy?.maxItemsPerRun ?? 10_000;
  if (!Number.isInteger(maxItems) || maxItems < 1) {
    throw new Error("maxItemsPerRun must be a positive whole number.");
  }
  if (args.requests.length > maxItems) {
    throw new Error(
      `Batch contains ${args.requests.length} items; maximum is ${maxItems}.`,
    );
  }

  const maxAutoItems = args.safetyPolicy?.maxAutoEligibleItems ?? 250;
  if (!Number.isInteger(maxAutoItems) || maxAutoItems < 0) {
    throw new Error("maxAutoEligibleItems must be a non-negative whole number.");
  }
  const maxAutoShare = args.safetyPolicy?.maxAutoEligibleShare ?? 0.1;
  const blockedRateStop =
    args.safetyPolicy?.blockedRateAutomationStop ?? 0.25;
  assertRate("maxAutoEligibleShare", maxAutoShare);
  assertRate("blockedRateAutomationStop", blockedRateStop);

  const previews: PricingPreview[] = [];
  for (const request of args.requests) {
    previews.push(await previewWholesalePrice({ request, store: args.store }));
  }

  const autoCandidates = previews
    .filter(
      (preview) =>
        preview.recommendation.status === "RECOMMENDED" &&
        preview.recommendation.approvalLevel === "AUTO_ELIGIBLE",
    )
    .sort((a, b) => {
      const confidenceDifference =
        b.recommendation.confidence - a.recommendation.confidence;
      if (Math.abs(confidenceDifference) > 0.0001) {
        return confidenceDifference;
      }
      const aMovement = Math.abs(
        a.recommendation.selectedCandidate?.changeRate ?? 0,
      );
      const bMovement = Math.abs(
        b.recommendation.selectedCandidate?.changeRate ?? 0,
      );
      return aMovement - bMovement;
    });
  const blockedCount = countApproval(previews, "BLOCKED");
  const blockedRate = previews.length > 0 ? blockedCount / previews.length : 0;
  const shareLimit = Math.floor(previews.length * maxAutoShare);
  const allowedAutoCount = Math.min(maxAutoItems, shareLimit);
  const suppressAllAutomation = blockedRate > blockedRateStop;
  const automationEligible = suppressAllAutomation
    ? []
    : autoCandidates.slice(0, allowedAutoCount);
  const eligibleIds = new Set(
    automationEligible.map((preview) => preview.previewId),
  );
  const automationSuppressed = autoCandidates
    .filter((preview) => !eligibleIds.has(preview.previewId))
    .map((preview, index): BatchAutomationSuppression => {
      if (suppressAllAutomation) {
        return {
          previewId: preview.previewId,
          reason: "BATCH_BLOCK_RATE_EXCEEDED",
        };
      }
      if (index + automationEligible.length >= maxAutoItems) {
        return {
          previewId: preview.previewId,
          reason: "BATCH_AUTO_LIMIT_REACHED",
        };
      }
      return {
        previewId: preview.previewId,
        reason: "BATCH_AUTO_SHARE_LIMIT_REACHED",
      };
    });

  return {
    previews,
    automationEligiblePreviewIds: automationEligible.map(
      (preview) => preview.previewId,
    ),
    automationSuppressed,
    summary: {
      requested: previews.length,
      recommended: previews.filter(
        (preview) => preview.recommendation.status === "RECOMMENDED",
      ).length,
      blocked: blockedCount,
      recommendationOnly: countApproval(previews, "RECOMMENDATION_ONLY"),
      managerApproval: countApproval(previews, "MANAGER_APPROVAL"),
      executiveApproval: countApproval(previews, "EXECUTIVE_APPROVAL"),
      autoEligibleByItemPolicy: autoCandidates.length,
      autoEligibleAfterBatchSafety: automationEligible.length,
      raises: previews.filter(
        (preview) =>
          preview.recommendation.status === "RECOMMENDED" &&
          preview.recommendation.direction === "RAISE",
      ).length,
      lowers: previews.filter(
        (preview) =>
          preview.recommendation.status === "RECOMMENDED" &&
          preview.recommendation.direction === "LOWER",
      ).length,
      holds: previews.filter(
        (preview) =>
          preview.recommendation.status === "RECOMMENDED" &&
          preview.recommendation.direction === "HOLD",
      ).length,
      projectedThirtyDayProfitLift: previews.reduce(
        (sum, preview) =>
          sum + (preview.recommendation.projectedThirtyDayProfitLift ?? 0),
        0,
      ),
    },
  };
}
