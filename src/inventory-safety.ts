export type InventoryAdjustmentRequest = {
  requestId: string;
  sku: string;
  locationId: string;
  currentQuantity: number;
  requestedDelta: number;
  unitsPerCase?: number;
  mode?: "dry-run" | "apply";
  approvedBy?: string;
  physicalInventoryVerified?: boolean;
};

export type InventoryAdjustmentPreview = {
  requestId: string;
  sku: string;
  locationId: string;
  beforeQuantity: number;
  requestedDelta: number;
  afterQuantity: number;
  mode: "dry-run" | "apply";
  warnings: string[];
};

export class InventorySafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventorySafetyError";
  }
}

const requireNonEmpty = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new InventorySafetyError(`${field} is required`);
  }
  return normalized;
};

const requireInteger = (value: number, field: string): number => {
  if (!Number.isSafeInteger(value)) {
    throw new InventorySafetyError(`${field} must be a safe integer`);
  }
  return value;
};

export function validateUnitsPerCase(unitsPerCase: number): number {
  requireInteger(unitsPerCase, "unitsPerCase");
  if (unitsPerCase <= 0) {
    throw new InventorySafetyError("unitsPerCase must be greater than zero");
  }
  return unitsPerCase;
}

export function casesToBaseUnits(cases: number, unitsPerCase: number): number {
  requireInteger(cases, "cases");
  const validatedUnitsPerCase = validateUnitsPerCase(unitsPerCase);
  return cases * validatedUnitsPerCase;
}

export function baseUnitsToCases(baseUnits: number, unitsPerCase: number): number {
  requireInteger(baseUnits, "baseUnits");
  const validatedUnitsPerCase = validateUnitsPerCase(unitsPerCase);

  if (baseUnits % validatedUnitsPerCase !== 0) {
    throw new InventorySafetyError(
      `baseUnits must be evenly divisible by unitsPerCase (${validatedUnitsPerCase})`,
    );
  }

  return baseUnits / validatedUnitsPerCase;
}

export function previewInventoryAdjustment(
  request: InventoryAdjustmentRequest,
  processedRequestIds: ReadonlySet<string> = new Set(),
): InventoryAdjustmentPreview {
  const requestId = requireNonEmpty(request.requestId, "requestId");
  const sku = requireNonEmpty(request.sku, "sku");
  const locationId = requireNonEmpty(request.locationId, "locationId");
  const currentQuantity = requireInteger(request.currentQuantity, "currentQuantity");
  const requestedDelta = requireInteger(request.requestedDelta, "requestedDelta");
  const mode = request.mode ?? "dry-run";

  if (mode !== "dry-run" && mode !== "apply") {
    throw new InventorySafetyError(`unsupported mode: ${String(mode)}`);
  }

  if (processedRequestIds.has(requestId)) {
    throw new InventorySafetyError(`duplicate requestId: ${requestId}`);
  }

  if (request.unitsPerCase !== undefined) {
    validateUnitsPerCase(request.unitsPerCase);
  }

  if (mode === "apply") {
    requireNonEmpty(request.approvedBy ?? "", "approvedBy");
    if (request.physicalInventoryVerified !== true) {
      throw new InventorySafetyError(
        "physicalInventoryVerified must be true before apply mode",
      );
    }
  }

  const afterQuantity = currentQuantity + requestedDelta;
  const warnings: string[] = [];

  if (currentQuantity < 0) {
    warnings.push("Current inventory is negative and requires investigation.");
  }
  if (afterQuantity < 0) {
    warnings.push("Proposed inventory remains negative.");
  }
  if (requestedDelta === 0) {
    warnings.push("No inventory change requested.");
  }

  return {
    requestId,
    sku,
    locationId,
    beforeQuantity: currentQuantity,
    requestedDelta,
    afterQuantity,
    mode,
    warnings,
  };
}
