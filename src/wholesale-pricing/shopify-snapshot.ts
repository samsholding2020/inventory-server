import type { PricingRecommendation } from "./types.js";

export interface ShopifyMetafieldSetInput {
  ownerId: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
  compareDigest?: string | null;
}

export interface ShopifyPriceListFixedPriceInput {
  variantId: string;
  price: {
    amount: string;
    currencyCode: string;
  };
}

export interface ApprovedPricingWriteback {
  priceListId?: string;
  fixedPrice?: ShopifyPriceListFixedPriceInput;
  metafields: ShopifyMetafieldSetInput[];
}

function decimal(value: number): string {
  return value.toFixed(2);
}

export function buildRecommendationSnapshotMetafields(args: {
  recommendation: PricingRecommendation;
  ownerId: string;
  compareDigests?: Record<string, string | null>;
  namespace?: string;
}): ShopifyMetafieldSetInput[] {
  const namespace = args.namespace ?? "sams_wholesale_pricing";
  const { recommendation } = args;
  const values: Array<{ key: string; type: string; value: string }> = [
    {
      key: "ai_recommended_price",
      type: "number_decimal",
      value:
        recommendation.recommendedPrice === null
          ? "0.00"
          : decimal(recommendation.recommendedPrice),
    },
    {
      key: "ai_confidence",
      type: "number_decimal",
      value: recommendation.confidence.toFixed(4),
    },
    {
      key: "minimum_price",
      type: "number_decimal",
      value: decimal(recommendation.protectedFloor),
    },
    {
      key: "price_locked",
      type: "boolean",
      value: recommendation.blockedReasons.includes("PRICE_LOCKED")
        ? "true"
        : "false",
    },
    {
      key: "model_version",
      type: "single_line_text_field",
      value: recommendation.modelVersion,
    },
    {
      key: "recommendation_status",
      type: "single_line_text_field",
      value: recommendation.status,
    },
    {
      key: "approval_level",
      type: "single_line_text_field",
      value: recommendation.approvalLevel,
    },
    {
      key: "price_direction",
      type: "single_line_text_field",
      value: recommendation.direction,
    },
    {
      key: "projected_30d_profit_lift",
      type: "number_decimal",
      value: decimal(recommendation.projectedThirtyDayProfitLift ?? 0),
    },
    {
      key: "reason_codes",
      type: "json",
      value: JSON.stringify(recommendation.reasonCodes),
    },
    {
      key: "active_formulas",
      type: "json",
      value: JSON.stringify(recommendation.activeFormulas),
    },
    {
      key: "seller_location_id",
      type: "single_line_text_field",
      value: recommendation.identity.sellerLocationId,
    },
    {
      key: "buyer_pricebook_id",
      type: "single_line_text_field",
      value: recommendation.identity.buyerPricebookId,
    },
    {
      key: "quantity_break",
      type: "number_integer",
      value: String(recommendation.identity.quantityBreak),
    },
    {
      key: "sales_channel",
      type: "single_line_text_field",
      value: recommendation.identity.salesChannel,
    },
    {
      key: "generated_at",
      type: "date_time",
      value: recommendation.generatedAt,
    },
  ];

  return values.map((entry) => ({
    ownerId: args.ownerId,
    namespace,
    ...entry,
    ...(args.compareDigests && entry.key in args.compareDigests
      ? { compareDigest: args.compareDigests[entry.key] }
      : {}),
  }));
}

export function buildApprovedPricingWriteback(args: {
  recommendation: PricingRecommendation;
  ownerId: string;
  approvedBy: string;
  approvedAt: string;
  priceListId?: string;
  compareDigests?: Record<string, string | null>;
  namespace?: string;
}): ApprovedPricingWriteback {
  if (
    args.recommendation.status !== "RECOMMENDED" ||
    args.recommendation.recommendedPrice === null ||
    args.recommendation.approvalLevel === "BLOCKED" ||
    args.recommendation.approvalLevel === "RECOMMENDATION_ONLY"
  ) {
    throw new Error("Recommendation is not eligible for approved writeback.");
  }

  const namespace = args.namespace ?? "sams_wholesale_pricing";
  const snapshot = buildRecommendationSnapshotMetafields({
    recommendation: args.recommendation,
    ownerId: args.ownerId,
    compareDigests: args.compareDigests,
    namespace,
  });
  const approvedFields: ShopifyMetafieldSetInput[] = [
    {
      ownerId: args.ownerId,
      namespace,
      key: "current_wholesale_price",
      type: "number_decimal",
      value: decimal(args.recommendation.recommendedPrice),
      ...(args.compareDigests && "current_wholesale_price" in args.compareDigests
        ? { compareDigest: args.compareDigests.current_wholesale_price }
        : {}),
    },
    {
      ownerId: args.ownerId,
      namespace,
      key: "last_approved_at",
      type: "date_time",
      value: args.approvedAt,
      ...(args.compareDigests && "last_approved_at" in args.compareDigests
        ? { compareDigest: args.compareDigests.last_approved_at }
        : {}),
    },
    {
      ownerId: args.ownerId,
      namespace,
      key: "last_approved_by",
      type: "single_line_text_field",
      value: args.approvedBy,
      ...(args.compareDigests && "last_approved_by" in args.compareDigests
        ? { compareDigest: args.compareDigests.last_approved_by }
        : {}),
    },
  ];

  const currencyCode = args.recommendation.identity.currencyCode ?? "USD";
  return {
    priceListId: args.priceListId,
    fixedPrice: args.priceListId
      ? {
          variantId: args.recommendation.identity.variantId,
          price: {
            amount: decimal(args.recommendation.recommendedPrice),
            currencyCode,
          },
        }
      : undefined,
    metafields: [...snapshot, ...approvedFields],
  };
}
