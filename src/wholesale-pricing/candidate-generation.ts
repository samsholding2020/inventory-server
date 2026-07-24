import {
  ceilToIncrement,
  clamp,
  floorToIncrement,
  roundToIncrement,
  type PriceAnchor,
} from "./formulas.js";
import type { FormulaKey, PricingRequest } from "./types.js";

function mergeFormulaSources(
  target: Map<number, Set<FormulaKey>>,
  price: number,
  formulas: FormulaKey[],
  increment: number,
): void {
  if (!Number.isFinite(price) || price <= 0) return;
  const rounded = roundToIncrement(price, increment);
  const existing = target.get(rounded) ?? new Set<FormulaKey>();
  for (const formula of formulas) existing.add(formula);
  target.set(rounded, existing);
}

export function buildCandidatePrices(args: {
  request: PricingRequest;
  floor: number;
  anchors: PriceAnchor[];
}): Array<{ price: number; formulas: FormulaKey[] }> {
  const { request, floor, anchors } = args;
  const policy = request.policy;
  const increment = policy.priceIncrement ?? 0.01;
  const limit = Math.max(5, Math.min(50, policy.candidateLimit ?? 50));
  const highVolumeCap = policy.highVolumeMovementCapRate ?? 0.02;
  const maximumIncrease = request.dataQuality.highVolumeSku
    ? Math.min(highVolumeCap, policy.maximumIncreaseRate ?? 0.15)
    : policy.maximumIncreaseRate ?? 0.15;
  const maximumDecrease = request.dataQuality.highVolumeSku
    ? Math.min(highVolumeCap, policy.maximumDecreaseRate ?? 0.1)
    : policy.maximumDecreaseRate ?? 0.1;

  const rawLower = Math.max(
    floor,
    request.currentPrice * (1 - maximumDecrease),
  );
  const rawUpper = Math.min(
    request.currentPrice * (1 + maximumIncrease),
    policy.maximumAllowedPrice ?? Number.POSITIVE_INFINITY,
  );
  const lower = ceilToIncrement(rawLower, increment);
  const upper = floorToIncrement(rawUpper, increment);
  if (lower > upper) return [];

  const sources = new Map<number, Set<FormulaKey>>();
  mergeFormulaSources(sources, lower, ["PROTECTED_MARGIN_FLOOR"], increment);
  mergeFormulaSources(sources, upper, [], increment);
  const roundedCurrentPrice = roundToIncrement(request.currentPrice, increment);
  if (roundedCurrentPrice >= lower && roundedCurrentPrice <= upper) {
    mergeFormulaSources(sources, roundedCurrentPrice, [], increment);
  }
  for (const anchor of anchors) {
    const roundedAnchor = roundToIncrement(anchor.price, increment);
    if (roundedAnchor >= lower && roundedAnchor <= upper) {
      mergeFormulaSources(sources, roundedAnchor, anchor.formulas, increment);
    }
  }

  if (upper - lower <= increment * (limit - 1)) {
    for (let value = lower; value <= upper + increment / 2; value += increment) {
      mergeFormulaSources(sources, value, [], increment);
    }
  } else {
    for (let index = 0; index < limit; index += 1) {
      const ratio = limit === 1 ? 0 : index / (limit - 1);
      const candidate = lower + (upper - lower) * ratio;
      const bounded = clamp(roundToIncrement(candidate, increment), lower, upper);
      mergeFormulaSources(sources, bounded, [], increment);
    }
  }

  const all = [...sources.entries()]
    .map(([price, formulas]) => ({ price, formulas: [...formulas] }))
    .sort((a, b) => a.price - b.price);
  if (all.length <= limit) return all;

  const selected = new Map<number, { price: number; formulas: FormulaKey[] }>();
  const add = (price: number): void => {
    if (selected.size >= limit) return;
    const candidate = all.find((item) => item.price === price);
    if (candidate) selected.set(price, candidate);
  };

  add(lower);
  add(upper);
  if (roundedCurrentPrice >= lower && roundedCurrentPrice <= upper) {
    add(roundedCurrentPrice);
  }

  const formulaAnchors = all
    .filter((candidate) => candidate.formulas.length > 0)
    .sort((a, b) => {
      const aDistance = Math.abs(a.price - request.currentPrice);
      const bDistance = Math.abs(b.price - request.currentPrice);
      return aDistance - bDistance || a.price - b.price;
    });
  for (const candidate of formulaAnchors) add(candidate.price);

  const unselected = all.filter((candidate) => !selected.has(candidate.price));
  const remaining = Math.max(0, limit - selected.size);
  for (let index = 0; index < remaining && unselected.length > 0; index += 1) {
    const position = Math.round(
      (index * (unselected.length - 1)) / Math.max(1, remaining - 1),
    );
    const candidate = unselected[position];
    if (candidate) add(candidate.price);
  }

  return [...selected.values()].sort((a, b) => a.price - b.price);
}
