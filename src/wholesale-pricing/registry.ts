import type { FormulaDefinition } from "./types.js";

export const WHOLESALE_FORMULA_REGISTRY: readonly FormulaDefinition[] = [
  {
    key: "LANDED_COST",
    label: "Landed unit cost",
    category: "COST",
    purpose: "Convert purchase cost into the economic cost of one sellable unit.",
    expression:
      "((purchase + freight + duty + handling + transfer - rebate) / (1 - shrink)) + financing",
    requiredInputs: [
      "purchaseCost",
      "inboundFreightPerUnit",
      "dutyPerUnit",
      "handlingPerUnit",
      "transferCostPerUnit",
      "vendorRebatePerUnit",
      "shrinkRate",
      "financingAnnualRate",
      "averageDaysHeld",
    ],
  },
  {
    key: "PROTECTED_MARGIN_FLOOR",
    label: "Protected margin floor",
    category: "COST",
    purpose: "Prevent any candidate from violating the minimum contribution margin.",
    expression:
      "economicUnitCost / (1 - paymentFees - returns - badDebt - minimumMarginRate)",
    requiredInputs: [
      "landedUnitCost",
      "variableFulfillmentPerOrder",
      "minimumMarginRate",
      "paymentFeeRate",
      "returnRate",
      "badDebtRate",
    ],
  },
  {
    key: "ABSOLUTE_CONTRIBUTION_FLOOR",
    label: "Absolute contribution floor",
    category: "COST",
    purpose: "Protect a minimum dollar contribution per unit in addition to a margin percentage.",
    expression:
      "(economicUnitCost + minimumContributionPerUnit) / (1 - revenueDeductions)",
    requiredInputs: ["economicUnitCost", "minimumContributionPerUnit"],
  },
  {
    key: "COST_PLUS_MARKUP",
    label: "Cost-plus markup anchor",
    category: "COST",
    purpose: "Generate auditable candidate prices from approved markup targets.",
    expression: "economicUnitCost × (1 + targetMarkup) / (1 - revenueDeductions)",
    requiredInputs: ["economicUnitCost", "targetMarkupRates"],
  },
  {
    key: "TARGET_MARGIN",
    label: "Target margin anchor",
    category: "COST",
    purpose: "Generate candidate prices that achieve selected contribution margin targets.",
    expression: "economicUnitCost / (1 - revenueDeductions - targetMargin)",
    requiredInputs: ["economicUnitCost", "targetMarginRates"],
  },
  {
    key: "WEIGHTED_MARKET_PRICE",
    label: "Weighted market price",
    category: "MARKET",
    purpose: "Use exact, in-stock competitor evidence without allowing weak listings to dominate.",
    expression:
      "weightedQuantile(deliveredPrice, exactMatch × reliability × recency × shippingVerification)",
    requiredInputs: ["competitorQuotes", "marketHalfLifeDays"],
  },
  {
    key: "MARKET_PARITY",
    label: "Market parity anchors",
    category: "MARKET",
    purpose: "Generate defend, match, and premium positions around the weighted market median.",
    expression: "weightedMarketMedian × parityFactor",
    requiredInputs: ["weightedMarketMedian", "marketParityFactors"],
  },
  {
    key: "CONSTANT_ELASTICITY_OPTIMUM",
    label: "Constant-elasticity optimum",
    category: "DEMAND",
    purpose: "Generate an interior profit-maximizing anchor when elasticity is below -1.",
    expression:
      "elasticity × economicUnitCost / ((1 + elasticity) × (1 - revenueDeductions))",
    requiredInputs: ["elasticity", "economicUnitCost", "revenueDeductions"],
  },
  {
    key: "LINEAR_DEMAND_OPTIMUM",
    label: "Linear-demand optimum",
    category: "DEMAND",
    purpose: "Generate a profit-maximizing anchor for q(p) = intercept - slope × price.",
    expression:
      "((1 - deductions) × intercept + slope × economicUnitCost) / (2 × (1 - deductions) × slope)",
    requiredInputs: ["linearIntercept", "linearSlope", "economicUnitCost"],
  },
  {
    key: "INVENTORY_TARGET_ANCHOR",
    label: "Inventory target anchor",
    category: "INVENTORY",
    purpose: "Solve for the price expected to move inventory toward the target ending stock.",
    expression:
      "currentPrice × (desiredSales / baselineDemand)^(1 / elasticity)",
    requiredInputs: [
      "availableUnits",
      "incomingUnits",
      "transferableUnits",
      "targetEndingUnits",
      "baselineDemand",
      "elasticity",
    ],
  },
  {
    key: "RISK_ADJUSTED_CONTRIBUTION",
    label: "Risk-adjusted contribution objective",
    category: "RISK",
    purpose: "Rank guarded candidates by expected profit after inventory and downside risk costs.",
    expression:
      "expectedContribution - holding - aging - stockout - inventoryTargetPenalty - riskAversion × downsideRisk",
    requiredInputs: ["candidateDemand", "inventory", "holdingRate", "stockoutPenalty", "riskAversion"],
  },
  {
    key: "PRICE_STABILITY_PENALTY",
    label: "Price stability penalty",
    category: "RISK",
    purpose: "Avoid unnecessary price churn when two candidates have similar economics.",
    expression: "abs(candidatePrice - currentPrice) × baselineUnits × stabilityPenaltyRate",
    requiredInputs: ["candidatePrice", "currentPrice", "baselineUnits"],
  },
  {
    key: "QUANTITY_BREAK_UNIT_PRICE_MONOTONICITY",
    label: "Quantity-break unit-price monotonicity",
    category: "TIER_GUARDRAIL",
    purpose: "Ensure larger orders never receive a higher unit price than smaller orders.",
    expression: "unitPrice(q[i]) <= unitPrice(q[i-1])",
    requiredInputs: ["quantityBreakSchedule"],
  },
  {
    key: "QUANTITY_BREAK_TOTAL_VALUE_MONOTONICITY",
    label: "Quantity-break total-value monotonicity",
    category: "TIER_GUARDRAIL",
    purpose: "Prevent a buyer from receiving more units while paying a lower total invoice.",
    expression: "q[i] × price[i] >= (q[i] - 1) × price[i-1]",
    requiredInputs: ["quantityBreakSchedule"],
  },
] as const;
