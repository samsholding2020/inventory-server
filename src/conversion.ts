export type ConversionAction =
  | "CASE_TO_BASE"
  | "BASE_TO_CASE"
  | "NO_CONVERSION";

export interface UnitMapping {
  baseSku: string;
  caseSku: string;
  unitsPerCase: number;
  baseInventoryItemId: string;
  caseInventoryItemId: string;
  enabled?: boolean;
  minimumBaseUnits?: number;
  minimumCaseUnits?: number;
}

export interface ConversionInput {
  caseQty: number;
  baseQty: number;
  unitsPerCase: number;
  minimumBaseUnits?: number;
  minimumCaseUnits?: number;
  allowBaseToCaseWhenCasesExist?: boolean;
}

export interface ConversionResult {
  action: ConversionAction;
  newCaseQty: number;
  newBaseQty: number;
  casesConverted: number;
  reason: string;
}

function assertInteger(name: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`);
  }
}

export function calculateUnitConversion({
  caseQty,
  baseQty,
  unitsPerCase,
  minimumBaseUnits = 1,
  minimumCaseUnits = 0,
  allowBaseToCaseWhenCasesExist = false,
}: ConversionInput): ConversionResult {
  assertInteger("caseQty", caseQty);
  assertInteger("baseQty", baseQty);
  assertInteger("unitsPerCase", unitsPerCase);
  assertInteger("minimumBaseUnits", minimumBaseUnits);
  assertInteger("minimumCaseUnits", minimumCaseUnits);

  if (unitsPerCase <= 0) {
    throw new Error("unitsPerCase must be greater than zero.");
  }
  if (minimumBaseUnits < 0 || minimumCaseUnits < 0) {
    throw new Error("Minimum inventory values cannot be negative.");
  }

  // Match the spreadsheet rule: open enough cases to restore at least one
  // base unit, while never reducing cases below the configured reserve.
  if (baseQty < minimumBaseUnits && caseQty > minimumCaseUnits) {
    const casesNeeded = Math.ceil(
      (minimumBaseUnits - baseQty) / unitsPerCase,
    );
    const availableCases = caseQty - minimumCaseUnits;
    const casesToOpen = Math.min(casesNeeded, availableCases);

    if (casesToOpen > 0) {
      return {
        action: "CASE_TO_BASE",
        newCaseQty: caseQty - casesToOpen,
        newBaseQty: baseQty + casesToOpen * unitsPerCase,
        casesConverted: casesToOpen,
        reason: `Opened ${casesToOpen} case(s) into base units.`,
      };
    }
  }

  const canCreateCases =
    allowBaseToCaseWhenCasesExist || caseQty <= minimumCaseUnits;
  const convertibleUnits = baseQty - minimumBaseUnits;
  const casesToCreate = canCreateCases
    ? Math.floor(convertibleUnits / unitsPerCase)
    : 0;

  if (casesToCreate > 0) {
    return {
      action: "BASE_TO_CASE",
      newCaseQty: caseQty + casesToCreate,
      newBaseQty: baseQty - casesToCreate * unitsPerCase,
      casesConverted: casesToCreate,
      reason: `Converted base units into ${casesToCreate} case(s).`,
    };
  }

  return {
    action: "NO_CONVERSION",
    newCaseQty: caseQty,
    newBaseQty: baseQty,
    casesConverted: 0,
    reason: "Inventory is already within conversion limits.",
  };
}
