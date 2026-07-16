import type { UnitMapping } from "./conversion.js";
import {
  previewConversion,
  type ConversionPreview,
  type InventoryGateway,
  type PreviewStore,
} from "./conversion-service.js";

export interface BatchSafetyPolicy {
  maxMappingsPerRun?: number;
  maxCasesConvertedPerItem?: number;
  maxAbsoluteUnitDeltaPerItem?: number;
}

export interface BatchPreviewResult {
  previews: ConversionPreview[];
  blocked: Array<{ caseSku: string; reason: string }>;
  summary: {
    mappings: number;
    actionable: number;
    noConversion: number;
    blocked: number;
    caseToBase: number;
    baseToCase: number;
  };
}

export async function previewBatchConversions(args: {
  gateway: InventoryGateway;
  store: PreviewStore;
  shopDomain: string;
  locationId: string;
  mappings: UnitMapping[];
  allowBaseToCaseWhenCasesExist?: boolean;
  policy?: BatchSafetyPolicy;
}): Promise<BatchPreviewResult> {
  const maxMappings = args.policy?.maxMappingsPerRun ?? 5000;
  if (args.mappings.length > maxMappings) {
    throw new Error(`Batch contains ${args.mappings.length} mappings; maximum is ${maxMappings}.`);
  }

  const previews: ConversionPreview[] = [];
  const blocked: Array<{ caseSku: string; reason: string }> = [];

  for (const mapping of args.mappings) {
    try {
      const preview = await previewConversion({
        gateway: args.gateway,
        store: args.store,
        shopDomain: args.shopDomain,
        locationId: args.locationId,
        mapping,
        allowBaseToCaseWhenCasesExist: args.allowBaseToCaseWhenCasesExist,
      });

      const caseLimit = args.policy?.maxCasesConvertedPerItem;
      const unitLimit = args.policy?.maxAbsoluteUnitDeltaPerItem;
      const unitDelta = Math.abs(preview.newBaseQty - preview.baseQty);

      if (caseLimit !== undefined && preview.casesConverted > caseLimit) {
        blocked.push({
          caseSku: mapping.caseSku,
          reason: `Requires ${preview.casesConverted} cases; safety limit is ${caseLimit}.`,
        });
        continue;
      }
      if (unitLimit !== undefined && unitDelta > unitLimit) {
        blocked.push({
          caseSku: mapping.caseSku,
          reason: `Base-unit adjustment ${unitDelta} exceeds safety limit ${unitLimit}.`,
        });
        continue;
      }

      previews.push(preview);
    } catch (error) {
      blocked.push({
        caseSku: mapping.caseSku,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    previews,
    blocked,
    summary: {
      mappings: args.mappings.length,
      actionable: previews.filter((p) => p.action !== "NO_CONVERSION").length,
      noConversion: previews.filter((p) => p.action === "NO_CONVERSION").length,
      blocked: blocked.length,
      caseToBase: previews.filter((p) => p.action === "CASE_TO_BASE").length,
      baseToCase: previews.filter((p) => p.action === "BASE_TO_CASE").length,
    },
  };
}
