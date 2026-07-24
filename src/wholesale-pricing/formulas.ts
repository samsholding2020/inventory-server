import type {
  CompetitorQuote,
  CostInputs,
  DemandInputs,
  FormulaKey,
  InventoryInputs,
  MarketSummary,
  PricingPolicy,
  ResolvedDemandModel,
} from "./types.js";

export interface DemandProjection {
  units: number;
  stdUnits: number;
}

export interface PriceAnchor {
  price: number;
  formulas: FormulaKey[];
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertIncrement(increment: number): void {
  if (!Number.isFinite(increment) || increment <= 0) {
    throw new Error("priceIncrement must be greater than zero.");
  }
}

function normalizeIncrementResult(value: number): number {
  return Number(value.toFixed(10));
}

export function roundToIncrement(value: number, increment: number): number {
  if (!Number.isFinite(value)) return value;
  assertIncrement(increment);
  return normalizeIncrementResult(Math.round(value / increment) * increment);
}

export function ceilToIncrement(value: number, increment: number): number {
  if (!Number.isFinite(value)) return value;
  assertIncrement(increment);
  return normalizeIncrementResult(
    Math.ceil((value - Number.EPSILON) / increment) * increment,
  );
}

export function floorToIncrement(value: number, increment: number): number {
  if (!Number.isFinite(value)) return value;
  assertIncrement(increment);
  return normalizeIncrementResult(
    Math.floor((value + Number.EPSILON) / increment) * increment,
  );
}

function requiredRate(name: string, value: number | undefined): number {
  const result = value ?? 0;
  if (!Number.isFinite(result) || result < 0 || result >= 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
  return result;
}

function optionalNonNegative(name: string, value: number | undefined): number {
  const result = value ?? 0;
  if (!Number.isFinite(result) || result < 0) {
    throw new Error(`${name} cannot be negative.`);
  }
  return result;
}

export function computeLandedUnitCost(costs: CostInputs): number {
  if (!Number.isFinite(costs.purchaseCost) || costs.purchaseCost <= 0) {
    throw new Error("purchaseCost must be greater than zero.");
  }

  const directCost =
    costs.purchaseCost +
    optionalNonNegative("inboundFreightPerUnit", costs.inboundFreightPerUnit) +
    optionalNonNegative("dutyPerUnit", costs.dutyPerUnit) +
    optionalNonNegative("handlingPerUnit", costs.handlingPerUnit) +
    optionalNonNegative("transferCostPerUnit", costs.transferCostPerUnit) -
    optionalNonNegative("vendorRebatePerUnit", costs.vendorRebatePerUnit);

  if (directCost <= 0) {
    throw new Error("Net direct unit cost must be greater than zero.");
  }

  const shrinkRate = requiredRate("shrinkRate", costs.shrinkRate);
  const shrinkAdjustedCost = directCost / (1 - shrinkRate);
  const financingAnnualRate = requiredRate(
    "financingAnnualRate",
    costs.financingAnnualRate,
  );
  const averageDaysHeld = optionalNonNegative(
    "averageDaysHeld",
    costs.averageDaysHeld,
  );
  const financingCost =
    shrinkAdjustedCost * financingAnnualRate * (averageDaysHeld / 365);

  return roundMoney(shrinkAdjustedCost + financingCost);
}

export function computeAverageUnitsPerOrder(demand: DemandInputs): number {
  const orders = demand.baselineOrders ?? 0;
  if (orders > 0 && demand.baselineUnits > 0) {
    return Math.max(1, demand.baselineUnits / orders);
  }
  return Math.max(1, demand.baselineUnits > 0 ? demand.baselineUnits : 1);
}

export function computePercentageRevenueDeductions(costs: CostInputs): number {
  const deductions =
    requiredRate("paymentFeeRate", costs.paymentFeeRate) +
    requiredRate("returnRate", costs.returnRate) +
    requiredRate("badDebtRate", costs.badDebtRate);
  if (deductions >= 0.95) {
    throw new Error("Combined revenue deductions must be below 95%.");
  }
  return deductions;
}

export function computeProtectedFloor(args: {
  landedUnitCost: number;
  costs: CostInputs;
  demand: DemandInputs;
  policy: PricingPolicy;
}): number {
  const { landedUnitCost, costs, demand, policy } = args;
  if (
    !Number.isFinite(policy.minimumMarginRate) ||
    policy.minimumMarginRate < 0 ||
    policy.minimumMarginRate >= 1
  ) {
    throw new Error("minimumMarginRate must be between 0 and 1.");
  }

  const averageUnitsPerOrder = computeAverageUnitsPerOrder(demand);
  const fulfillmentPerUnit =
    optionalNonNegative(
      "variableFulfillmentPerOrder",
      costs.variableFulfillmentPerOrder,
    ) / averageUnitsPerOrder;
  const economicUnitCost = landedUnitCost + fulfillmentPerUnit;
  const deductions = computePercentageRevenueDeductions(costs);

  const marginDenominator = 1 - deductions - policy.minimumMarginRate;
  if (marginDenominator <= 0) {
    throw new Error(
      "minimumMarginRate plus revenue deductions leaves no feasible protected floor.",
    );
  }

  const marginFloor = economicUnitCost / marginDenominator;
  const contributionFloor =
    (economicUnitCost +
      optionalNonNegative(
        "minimumContributionPerUnit",
        policy.minimumContributionPerUnit,
      )) /
    (1 - deductions);
  const mapFloor = optionalNonNegative(
    "mapMinimumPrice",
    policy.mapMinimumPrice,
  );

  return ceilToIncrement(
    Math.max(marginFloor, contributionFloor, mapFloor),
    policy.priceIncrement ?? 0.01,
  );
}

export function computeContributionMarginRate(args: {
  price: number;
  landedUnitCost: number;
  fulfillmentPerUnit: number;
  percentageDeductions: number;
}): number {
  if (args.price <= 0) return Number.NEGATIVE_INFINITY;
  const contributionPerUnit =
    args.price * (1 - args.percentageDeductions) -
    args.landedUnitCost -
    args.fulfillmentPerUnit;
  return contributionPerUnit / args.price;
}

export function resolveDemandModel(
  demand: DemandInputs,
  policy: PricingPolicy,
): ResolvedDemandModel {
  const linear = demand.linearDemand;
  const elasticity = demand.elasticity;

  if (
    linear &&
    Number.isFinite(linear.intercept) &&
    Number.isFinite(linear.slope) &&
    linear.intercept > 0 &&
    linear.slope > 0 &&
    linear.confidence >= (elasticity?.confidence ?? 0)
  ) {
    return {
      kind: "LINEAR",
      confidence: clamp(linear.confidence, 0, 1),
      elasticity: null,
      linearIntercept: linear.intercept,
      linearSlope: linear.slope,
      source: "LINEAR_DEMAND_MODEL",
    };
  }

  if (
    elasticity &&
    Number.isFinite(elasticity.estimate) &&
    elasticity.estimate < 0
  ) {
    return {
      kind: "CONSTANT_ELASTICITY",
      confidence: clamp(elasticity.confidence, 0, 1),
      elasticity: elasticity.estimate,
      linearIntercept: null,
      linearSlope: null,
      source: elasticity.source ?? "ITEM",
    };
  }

  const fallbackElasticity =
    demand.fallbackElasticity ?? policy.fallbackElasticity ?? -1.5;
  if (!Number.isFinite(fallbackElasticity) || fallbackElasticity >= 0) {
    throw new Error("fallbackElasticity must be a negative number.");
  }

  return {
    kind: "POLICY_FALLBACK",
    confidence: 0.35,
    elasticity: fallbackElasticity,
    linearIntercept: null,
    linearSlope: null,
    source: "POLICY_FALLBACK",
  };
}

export function projectDemand(args: {
  price: number;
  currentPrice: number;
  demand: DemandInputs;
  model: ResolvedDemandModel;
}): DemandProjection {
  const seasonality = args.demand.seasonalityFactor ?? 1;
  const availability = args.demand.availabilityFactor ?? 1;
  if (seasonality < 0 || availability < 0) {
    throw new Error("Demand factors cannot be negative.");
  }
  const baseUnits = Math.max(0, args.demand.baselineUnits * seasonality * availability);
  const baseStd = Math.max(0, args.demand.uncertaintyStdUnits ?? 0) * seasonality;

  if (args.model.kind === "LINEAR") {
    const units = Math.max(
      0,
      (args.model.linearIntercept ?? 0) -
        (args.model.linearSlope ?? 0) * args.price,
    );
    const scale = baseUnits > 0 ? units / baseUnits : 1;
    return { units, stdUnits: Math.max(0, baseStd * scale) };
  }

  if (args.currentPrice <= 0 || args.price <= 0) {
    return { units: 0, stdUnits: 0 };
  }
  const elasticity = args.model.elasticity ?? -1.5;
  const ratio = args.price / args.currentPrice;
  const multiplier = Math.pow(ratio, elasticity);
  return {
    units: Math.max(0, baseUnits * multiplier),
    stdUnits: Math.max(0, baseStd * multiplier),
  };
}

interface WeightedPoint {
  value: number;
  weight: number;
  source: string;
}

function weightedQuantile(points: WeightedPoint[], quantile: number): number | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, point) => sum + point.weight, 0);
  if (totalWeight <= 0) return null;
  const target = clamp(quantile, 0, 1) * totalWeight;
  let cumulative = 0;
  for (const point of sorted) {
    cumulative += point.weight;
    if (cumulative >= target) return point.value;
  }
  return sorted[sorted.length - 1]?.value ?? null;
}

export function summarizeMarket(
  quotes: CompetitorQuote[],
  policy: PricingPolicy,
): MarketSummary {
  const halfLifeDays = Math.max(1, policy.marketHalfLifeDays ?? 30);
  const points: WeightedPoint[] = [];

  for (const quote of quotes) {
    if (
      !quote.exactSkuMatch ||
      quote.genericOrAlternateBrand ||
      !quote.inStock ||
      !Number.isFinite(quote.unitPrice) ||
      quote.unitPrice <= 0
    ) {
      continue;
    }
    const recencyWeight = Math.pow(0.5, Math.max(0, quote.ageDays) / halfLifeDays);
    const shippingWeight = quote.shippingVerified ? 1 : 0.65;
    const weight =
      clamp(quote.matchQuality, 0, 1) *
      clamp(quote.sourceReliability, 0, 1) *
      recencyWeight *
      shippingWeight;
    if (weight <= 0) continue;
    points.push({
      value: quote.unitPrice + Math.max(0, quote.shippingPerUnit ?? 0),
      weight,
      source: quote.source,
    });
  }

  const low = weightedQuantile(points, 0.1);
  const median = weightedQuantile(points, 0.5);
  const high = weightedQuantile(points, 0.9);
  const totalWeight = points.reduce((sum, point) => sum + point.weight, 0);
  const squaredWeight = points.reduce(
    (sum, point) => sum + point.weight * point.weight,
    0,
  );
  const effectiveSourceCount =
    squaredWeight > 0 ? (totalWeight * totalWeight) / squaredWeight : 0;
  const exactSourceCount = new Set(points.map((point) => point.source)).size;
  const confidence = clamp(
    (1 - Math.exp(-effectiveSourceCount / 2)) *
      (points.length > 0 ? totalWeight / points.length : 0),
    0,
    1,
  );
  const dispersion =
    median && low !== null && high !== null && median > 0
      ? (high - low) / median
      : null;

  return {
    exactSourceCount,
    effectiveSourceCount,
    weightedLow: low === null ? null : roundMoney(low),
    weightedMedian: median === null ? null : roundMoney(median),
    weightedHigh: high === null ? null : roundMoney(high),
    weightedDispersionRate: dispersion,
    confidence,
  };
}

export function buildFormulaAnchors(args: {
  currentPrice: number;
  landedUnitCost: number;
  protectedFloor: number;
  costs: CostInputs;
  demand: DemandInputs;
  inventory: InventoryInputs;
  policy: PricingPolicy;
  market: MarketSummary;
  model: ResolvedDemandModel;
}): PriceAnchor[] {
  const anchors: PriceAnchor[] = [
    { price: args.currentPrice, formulas: [] },
    {
      price: args.protectedFloor,
      formulas: ["PROTECTED_MARGIN_FLOOR", "ABSOLUTE_CONTRIBUTION_FLOOR"],
    },
  ];
  const deductions = computePercentageRevenueDeductions(args.costs);
  const averageUnitsPerOrder = computeAverageUnitsPerOrder(args.demand);
  const fulfillmentPerUnit =
    (args.costs.variableFulfillmentPerOrder ?? 0) / averageUnitsPerOrder;
  const economicCost = args.landedUnitCost + fulfillmentPerUnit;

  for (const markup of args.policy.targetMarkupRates ?? [0.35, 0.5, 0.75]) {
    if (markup >= 0) {
      anchors.push({
        price: economicCost * (1 + markup) / (1 - deductions),
        formulas: ["COST_PLUS_MARKUP"],
      });
    }
  }

  for (const margin of args.policy.targetMarginRates ?? [0.25, 0.3, 0.35]) {
    const denominator = 1 - deductions - margin;
    if (denominator > 0) {
      anchors.push({
        price: economicCost / denominator,
        formulas: ["TARGET_MARGIN"],
      });
    }
  }

  if (args.market.weightedMedian !== null) {
    anchors.push({
      price: args.market.weightedMedian,
      formulas: ["WEIGHTED_MARKET_PRICE"],
    });
    for (const factor of args.policy.marketParityFactors ?? [0.95, 1, 1.05]) {
      if (factor > 0) {
        anchors.push({
          price: args.market.weightedMedian * factor,
          formulas: ["MARKET_PARITY"],
        });
      }
    }
  }

  if (
    args.model.elasticity !== null &&
    args.model.elasticity < -1.0001 &&
    1 - deductions > 0
  ) {
    const elasticity = args.model.elasticity;
    const optimum =
      (elasticity * economicCost) /
      ((1 + elasticity) * (1 - deductions));
    if (Number.isFinite(optimum) && optimum > 0) {
      anchors.push({
        price: optimum,
        formulas: ["CONSTANT_ELASTICITY_OPTIMUM"],
      });
    }
  }

  if (
    args.model.kind === "LINEAR" &&
    (args.model.linearIntercept ?? 0) > 0 &&
    (args.model.linearSlope ?? 0) > 0
  ) {
    const intercept = args.model.linearIntercept ?? 0;
    const slope = args.model.linearSlope ?? 0;
    const netRate = 1 - deductions;
    const optimum =
      (netRate * intercept + slope * economicCost) /
      (2 * netRate * slope);
    if (Number.isFinite(optimum) && optimum > 0) {
      anchors.push({
        price: optimum,
        formulas: ["LINEAR_DEMAND_OPTIMUM"],
      });
    }
  }

  if (args.model.elasticity !== null && args.model.elasticity < 0) {
    const horizon = Math.max(1, args.demand.horizonDays ?? 30);
    const baseDemand =
      args.demand.baselineUnits *
      (args.demand.seasonalityFactor ?? 1) *
      (args.demand.availabilityFactor ?? 1);
    const inventoryAvailable = Math.max(
      0,
      args.inventory.availableUnits +
        (args.inventory.incomingUnits ?? 0) +
        (args.inventory.transferableUnits ?? 0) -
        (args.inventory.reservedUnits ?? 0),
    );
    const targetEnding =
      args.inventory.targetEndingUnits ??
      ((args.inventory.targetDaysCover ?? 0) * baseDemand) / horizon;
    const desiredSales = Math.max(0.0001, inventoryAvailable - targetEnding);
    if (baseDemand > 0) {
      const anchor =
        args.currentPrice *
        Math.pow(desiredSales / baseDemand, 1 / args.model.elasticity);
      if (Number.isFinite(anchor) && anchor > 0) {
        anchors.push({
          price: anchor,
          formulas: ["INVENTORY_TARGET_ANCHOR"],
        });
      }
    }
  }

  return anchors;
}
