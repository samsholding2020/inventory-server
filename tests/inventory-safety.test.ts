import { describe, expect, it } from "vitest";

import {
  InventorySafetyError,
  baseUnitsToCases,
  casesToBaseUnits,
  previewInventoryAdjustment,
} from "../src/inventory-safety.js";

describe("case conversion", () => {
  it.each([
    [3, 4, 12],
    [2, 6, 12],
    [5, 12, 60],
  ])("converts %i cases at %i units per case", (cases, unitsPerCase, expected) => {
    expect(casesToBaseUnits(cases, unitsPerCase)).toBe(expected);
  });

  it.each([
    [12, 4, 3],
    [12, 6, 2],
    [60, 12, 5],
  ])("converts %i base units at %i units per case", (units, unitsPerCase, expected) => {
    expect(baseUnitsToCases(units, unitsPerCase)).toBe(expected);
  });

  it("blocks fractional case conversion", () => {
    expect(() => baseUnitsToCases(11, 6)).toThrow(InventorySafetyError);
  });

  it("blocks invalid case sizes", () => {
    expect(() => casesToBaseUnits(1, 0)).toThrow(InventorySafetyError);
  });
});

describe("inventory adjustment preview", () => {
  const validRequest = {
    requestId: "adjustment-001",
    sku: "16883",
    locationId: "36382244961",
    currentQuantity: 2,
    requestedDelta: 3,
  };

  it("defaults to dry-run and calculates the proposed result", () => {
    expect(previewInventoryAdjustment(validRequest)).toEqual({
      requestId: "adjustment-001",
      sku: "16883",
      locationId: "36382244961",
      beforeQuantity: 2,
      requestedDelta: 3,
      afterQuantity: 5,
      mode: "dry-run",
      warnings: [],
    });
  });

  it("requires approval and physical verification for apply mode", () => {
    expect(() =>
      previewInventoryAdjustment({ ...validRequest, mode: "apply" }),
    ).toThrow("approvedBy is required");

    expect(() =>
      previewInventoryAdjustment({
        ...validRequest,
        mode: "apply",
        approvedBy: "David Tran",
      }),
    ).toThrow("physicalInventoryVerified must be true");
  });

  it("allows apply mode only with approval and verification", () => {
    const result = previewInventoryAdjustment({
      ...validRequest,
      mode: "apply",
      approvedBy: "David Tran",
      physicalInventoryVerified: true,
    });

    expect(result.mode).toBe("apply");
    expect(result.afterQuantity).toBe(5);
  });

  it("blocks unsupported modes at runtime", () => {
    expect(() =>
      previewInventoryAdjustment({
        ...validRequest,
        mode: "force" as "apply",
      }),
    ).toThrow("unsupported mode");
  });

  it("blocks duplicate request IDs", () => {
    expect(() =>
      previewInventoryAdjustment(validRequest, new Set(["adjustment-001"])),
    ).toThrow("duplicate requestId");
  });

  it("flags negative inventory rather than silently correcting it", () => {
    const result = previewInventoryAdjustment({
      ...validRequest,
      currentQuantity: -1,
      requestedDelta: 0,
    });

    expect(result.warnings).toContain(
      "Current inventory is negative and requires investigation.",
    );
    expect(result.warnings).toContain("Proposed inventory remains negative.");
  });

  it("blocks missing SKU and location mapping", () => {
    expect(() => previewInventoryAdjustment({ ...validRequest, sku: " " })).toThrow(
      "sku is required",
    );
    expect(() =>
      previewInventoryAdjustment({ ...validRequest, locationId: "" }),
    ).toThrow("locationId is required");
  });
});
