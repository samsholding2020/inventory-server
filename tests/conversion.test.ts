import { describe, expect, it } from "vitest";
import { calculateUnitConversion } from "../src/conversion.js";

describe("calculateUnitConversion", () => {
  it("opens one case to restore negative base inventory", () => {
    expect(
      calculateUnitConversion({ caseQty: 5, baseQty: -3, unitsPerCase: 12 }),
    ).toMatchObject({
      action: "CASE_TO_BASE",
      newCaseQty: 4,
      newBaseQty: 9,
      casesConverted: 1,
    });
  });

  it("opens multiple cases when required", () => {
    expect(
      calculateUnitConversion({ caseQty: 10, baseQty: -80, unitsPerCase: 24 }),
    ).toMatchObject({
      action: "CASE_TO_BASE",
      newCaseQty: 6,
      newBaseQty: 16,
      casesConverted: 4,
    });
  });

  it("creates cases and retains one base unit", () => {
    expect(
      calculateUnitConversion({ caseQty: 0, baseQty: 100, unitsPerCase: 12 }),
    ).toMatchObject({
      action: "BASE_TO_CASE",
      newCaseQty: 8,
      newBaseQty: 4,
      casesConverted: 8,
    });
  });

  it("does not create cases while case stock exists under spreadsheet mode", () => {
    expect(
      calculateUnitConversion({ caseQty: 1, baseQty: 100, unitsPerCase: 12 }),
    ).toMatchObject({ action: "NO_CONVERSION" });
  });

  it("supports configurable base-to-case conversion when cases exist", () => {
    expect(
      calculateUnitConversion({
        caseQty: 1,
        baseQty: 150,
        unitsPerCase: 50,
        minimumBaseUnits: 1,
        allowBaseToCaseWhenCasesExist: true,
      }),
    ).toMatchObject({
      action: "BASE_TO_CASE",
      newCaseQty: 3,
      newBaseQty: 50,
      casesConverted: 2,
    });
  });

  it("rejects invalid case size", () => {
    expect(() =>
      calculateUnitConversion({ caseQty: 1, baseQty: 1, unitsPerCase: 0 }),
    ).toThrow("unitsPerCase must be greater than zero");
  });
});
