import { optimizeWholesalePrice } from "./engine.js";
import {
  buildApprovedPricingWriteback,
  type ApprovedPricingWriteback,
} from "./shopify-snapshot.js";
import type { PricingRecommendation, PricingRequest } from "./types.js";

export type PricingApproverRole = "SYSTEM" | "MANAGER" | "EXECUTIVE";

export interface PricingPreview {
  previewId: string;
  createdAt: string;
  request: PricingRequest;
  recommendation: PricingRecommendation;
}

export interface PricingPreviewStore {
  save(preview: PricingPreview): Promise<void>;
  get(previewId: string): Promise<PricingPreview | null>;
  wasApplied(previewId: string): Promise<boolean>;
  markApplied(previewId: string, transactionId: string): Promise<void>;
}

export interface PricingApprovalGateway {
  validateBeforeApply(
    preview: PricingPreview,
  ): Promise<{ valid: boolean; reason?: string }>;
  apply(writeback: ApprovedPricingWriteback): Promise<{ transactionId: string }>;
}

function previewKey(request: PricingRequest): string {
  return [
    request.identity.variantId,
    request.identity.sellerLocationId,
    request.identity.buyerPricebookId,
    request.identity.quantityBreak,
    request.identity.salesChannel,
    request.sourceSnapshotToken ?? "no-snapshot-token",
    Date.now(),
    Math.random().toString(36).slice(2),
  ].join(":");
}

function assertRoleCanApprove(
  recommendation: PricingRecommendation,
  role: PricingApproverRole,
): void {
  switch (recommendation.approvalLevel) {
    case "BLOCKED":
      throw new Error("Blocked recommendations cannot be applied.");
    case "RECOMMENDATION_ONLY":
      throw new Error("Recommendation-only decisions cannot be applied.");
    case "EXECUTIVE_APPROVAL":
      if (role !== "EXECUTIVE") {
        throw new Error("Executive approval is required for this price change.");
      }
      return;
    case "MANAGER_APPROVAL":
      if (role !== "MANAGER" && role !== "EXECUTIVE") {
        throw new Error("Manager or executive approval is required for this price change.");
      }
      return;
    case "AUTO_ELIGIBLE":
      return;
  }
}

export async function previewWholesalePrice(args: {
  request: PricingRequest;
  store: PricingPreviewStore;
}): Promise<PricingPreview> {
  const recommendation = optimizeWholesalePrice(args.request);
  const preview: PricingPreview = {
    previewId: previewKey(args.request),
    createdAt: new Date().toISOString(),
    request: structuredClone(args.request),
    recommendation,
  };
  await args.store.save(preview);
  return structuredClone(preview);
}

export async function approveWholesalePrice(args: {
  previewId: string;
  store: PricingPreviewStore;
  gateway: PricingApprovalGateway;
  approverRole: PricingApproverRole;
  approvedBy: string;
  approvedAt: string;
  ownerId: string;
  priceListId?: string;
  compareDigests?: Record<string, string | null>;
  namespace?: string;
}): Promise<{ transactionId: string; writeback: ApprovedPricingWriteback }> {
  const preview = await args.store.get(args.previewId);
  if (!preview) {
    throw new Error("Pricing preview was not found or has expired.");
  }
  if (await args.store.wasApplied(args.previewId)) {
    throw new Error("This pricing preview was already applied.");
  }
  assertRoleCanApprove(preview.recommendation, args.approverRole);

  const validation = await args.gateway.validateBeforeApply(preview);
  if (!validation.valid) {
    throw new Error(
      validation.reason ??
        "Pricing inputs changed after preview. Generate a new preview before approval.",
    );
  }

  const writeback = buildApprovedPricingWriteback({
    recommendation: preview.recommendation,
    ownerId: args.ownerId,
    approvedBy: args.approvedBy,
    approvedAt: args.approvedAt,
    priceListId: args.priceListId,
    compareDigests: args.compareDigests,
    namespace: args.namespace,
  });
  const applied = await args.gateway.apply(writeback);
  await args.store.markApplied(args.previewId, applied.transactionId);
  return { transactionId: applied.transactionId, writeback };
}
