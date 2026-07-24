export const WHOLESALE_PRICING_MODEL_VERSION = "wholesale-pricing-v1.0.0";

export type ApprovalLevel =
  | "BLOCKED"
  | "RECOMMENDATION_ONLY"
  | "MANAGER_APPROVAL"
  | "EXECUTIVE_APPROVAL"
  | "AUTO_ELIGIBLE";

export type PriceDirection = "RAISE" | "LOWER" | "HOLD";

export type DemandModelKind =
  | "CONSTANT_ELASTICITY"
  | "LINEAR"
  | "POLICY_FALLBACK";

export type FormulaKey =
  | "LANDED_COST"
  | "PROTECTED_MARGIN_FLOOR"
  | "ABSOLUTE_CONTRIBUTION_FLOOR"
  | "COST_PLUS_MARKUP"
  | "TARGET_MARGIN"
  | "WEIGHTED_MARKET_PRICE"
  | "MARKET_PARITY"
  | "CONSTANT_ELASTICITY_OPTIMUM"
  | "LINEAR_DEMAND_OPTIMUM"
  | "INVENTORY_TARGET_ANCHOR"
  | "RISK_ADJUSTED_CONTRIBUTION"
  | "PRICE_STABILITY_PENALTY"
  | "QUANTITY_BREAK_UNIT_PRICE_MONOTONICITY"
  | "QUANTITY_BREAK_TOTAL_VALUE_MONOTONICITY";

export interface PricingIdentity {
  variantId: string;
  sku?: string;
  barcode?: string;
  sellerLocationId: string;
  sellerLocationName: string;
  buyerPricebookId: string;
  quantityBreak: number;
  salesChannel: string;
  currencyCode?: string;
  effectiveFrom?: string;
}

export interface CostInputs {
  purchaseCost: number;
  inboundFreightPerUnit?: number;
  dutyPerUnit?: number;
  handlingPerUnit?: number;
  transferCostPerUnit?: number;
  vendorRebatePerUnit?: number;
  shrinkRate?: number;
  financingAnnualRate?: number;
  averageDaysHeld?: number;
  paymentFeeRate?: number;
  returnRate?: number;
  badDebtRate?: number;
  variableFulfillmentPerOrder?: number;
  costAgeDays?: number;
}

export interface ElasticityEstimate {
  estimate: number;
  confidence: number;
  lowerBound?: number;
  upperBound?: number;
  source?: "ITEM" | "CATEGORY" | "VENDOR" | "EXPERIMENT" | "CAUSAL_MODEL";
}

export interface LinearDemandEstimate {
  intercept: number;
  slope: number;
  confidence: number;
}

export interface DemandInputs {
  horizonDays?: number;
  baselineUnits: number;
  baselineOrders?: number;
  uncertaintyStdUnits?: number;
  seasonalityFactor?: number;
  availabilityFactor?: number;
  elasticity?: ElasticityEstimate;
  fallbackElasticity?: number;
  linearDemand?: LinearDemandEstimate;
  distinctHistoricalPricePoints?: number;
  eligibleOrderCount?: number;
  inStockObservationRate?: number;
  modelCalibrationScore?: number;
}

export interface InventoryInputs {
  availableUnits: number;
  incomingUnits?: number;
  transferableUnits?: number;
  reservedUnits?: number;
  targetDaysCover?: number;
  targetEndingUnits?: number;
  holdingAnnualRate?: number;
  stockoutPenaltyPerUnit?: number;
  agingDays?: number;
  agingPenaltyAnnualRate?: number;
  inventoryConfidence?: number;
}

export interface CompetitorQuote {
  source: string;
  unitPrice: number;
  shippingPerUnit?: number;
  exactSkuMatch: boolean;
  genericOrAlternateBrand?: boolean;
  inStock: boolean;
  shippingVerified?: boolean;
  ageDays: number;
  matchQuality: number;
  sourceReliability: number;
}

export type MapStatus = "CLEAR" | "UNCERTAIN" | "VIOLATION" | "NOT_APPLICABLE";

export interface DataQualityInputs {
  inventoryTracked: boolean;
  excludedOrdersFiltered: boolean;
  activePromotion?: boolean;
  mapStatus?: MapStatus;
  priceLocked?: boolean;
  highVolumeSku?: boolean;
  topRevenueSku?: boolean;
  strategicAccount?: boolean;
  dataAnomaly?: boolean;
}

export interface PricingPolicy {
  pilotLocationName: string;
  minimumMarginRate: number;
  minimumContributionPerUnit?: number;
  maximumIncreaseRate?: number;
  maximumDecreaseRate?: number;
  highVolumeMovementCapRate?: number;
  routineMovementRate?: number;
  managerApprovalThresholdRate?: number;
  executiveApprovalThresholdRate?: number;
  autoConfidenceThreshold?: number;
  recommendationConfidenceThreshold?: number;
  maximumCostAgeDays?: number;
  priceIncrement?: number;
  candidateLimit?: number;
  marketHalfLifeDays?: number;
  targetMarginRates?: number[];
  targetMarkupRates?: number[];
  marketParityFactors?: number[];
  fallbackElasticity?: number;
  riskAversion?: number;
  priceStabilityPenaltyRate?: number;
  inventoryTargetPenaltyRate?: number;
  mapMinimumPrice?: number;
  maximumAllowedPrice?: number;
}

export interface PricingRequest {
  identity: PricingIdentity;
  currentPrice: number;
  costs: CostInputs;
  demand: DemandInputs;
  inventory: InventoryInputs;
  competitors?: CompetitorQuote[];
  dataQuality: DataQualityInputs;
  policy: PricingPolicy;
  generatedAt?: string;
  sourceSnapshotToken?: string;
}

export interface MarketSummary {
  exactSourceCount: number;
  effectiveSourceCount: number;
  weightedLow: number | null;
  weightedMedian: number | null;
  weightedHigh: number | null;
  weightedDispersionRate: number | null;
  confidence: number;
}

export interface ResolvedDemandModel {
  kind: DemandModelKind;
  confidence: number;
  elasticity: number | null;
  linearIntercept: number | null;
  linearSlope: number | null;
  source: string;
}

export interface CandidateEvaluation {
  price: number;
  sourceFormulas: FormulaKey[];
  changeRate: number;
  expectedDemandUnits: number;
  demandStdUnits: number;
  expectedUnitsSold: number;
  expectedOrders: number;
  expectedRevenue: number;
  expectedContributionProfit: number;
  expectedEndingInventory: number;
  expectedLostSalesUnits: number;
  holdingCost: number;
  agingCost: number;
  stockoutPenalty: number;
  inventoryTargetPenalty: number;
  downsideRisk: number;
  priceStabilityPenalty: number;
  objectiveScore: number;
  contributionMarginRate: number;
  markupRate: number;
  feasible: boolean;
  violations: string[];
}

export interface PricingRecommendation {
  modelVersion: string;
  generatedAt: string;
  status: "BLOCKED" | "RECOMMENDED";
  approvalLevel: ApprovalLevel;
  direction: PriceDirection;
  identity: PricingIdentity;
  currentPrice: number;
  recommendedPrice: number | null;
  landedUnitCost: number;
  protectedFloor: number;
  confidence: number;
  market: MarketSummary;
  demandModel: ResolvedDemandModel;
  candidateCount: number;
  projectedThirtyDayProfitLift: number | null;
  selectedCandidate: CandidateEvaluation | null;
  currentPriceCandidate: CandidateEvaluation | null;
  candidates: CandidateEvaluation[];
  activeFormulas: FormulaKey[];
  reasonCodes: string[];
  blockedReasons: string[];
}

export interface FormulaDefinition {
  key: FormulaKey;
  label: string;
  category: "COST" | "MARKET" | "DEMAND" | "INVENTORY" | "RISK" | "TIER_GUARDRAIL";
  purpose: string;
  expression: string;
  requiredInputs: string[];
}

export interface QuantityBreakTier {
  minimumQuantity: number;
  unitPrice: number;
  protectedFloor: number;
  label?: string;
}

export interface QuantityBreakViolation {
  code:
    | "INVALID_MINIMUM_QUANTITY"
    | "DUPLICATE_OR_UNSORTED_BREAK"
    | "UNIT_PRICE_INCREASES_WITH_VOLUME"
    | "TOTAL_ORDER_VALUE_DECREASES"
    | "BELOW_PROTECTED_FLOOR"
    | "DISCOUNT_EXCEEDS_POLICY";
  tierIndex: number;
  message: string;
}

export interface QuantityBreakValidation {
  valid: boolean;
  violations: QuantityBreakViolation[];
}
