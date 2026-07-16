import type { InventoryGateway } from "./conversion-service.js";
import type { ShopifyAdjustmentPlan } from "./shopify-adjustment.js";

export interface ShopifyGraphqlTransport {
  request<T>(query: string, variables: Record<string, unknown>): Promise<T>;
}

const INVENTORY_LEVELS_QUERY = `#graphql
query InventoryLevels($ids: [ID!]!, $locationId: ID!) {
  nodes(ids: $ids) {
    ... on InventoryItem {
      id
      inventoryLevel(locationId: $locationId) {
        quantities(names: ["available"]) {
          name
          quantity
        }
      }
    }
  }
}`;

const ADJUST_MUTATION = `#graphql
mutation InventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) {
    inventoryAdjustmentGroup {
      createdAt
      referenceDocumentUri
    }
    userErrors {
      field
      message
    }
  }
}`;

function inventoryItemGid(id: string): string {
  return id.startsWith("gid://") ? id : `gid://shopify/InventoryItem/${id}`;
}

function locationGid(id: string): string {
  return id.startsWith("gid://") ? id : `gid://shopify/Location/${id}`;
}

function numericId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

export class ShopifyGraphqlGateway implements InventoryGateway {
  constructor(private readonly transport: ShopifyGraphqlTransport) {}

  async readAvailable(
    locationId: string,
    inventoryItemIds: string[],
  ): Promise<Record<string, number>> {
    const unique = [...new Set(inventoryItemIds)];
    const data = await this.transport.request<{
      nodes: Array<{
        id: string;
        inventoryLevel: null | {
          quantities: Array<{ name: string; quantity: number }>;
        };
      } | null>;
    }>(INVENTORY_LEVELS_QUERY, {
      ids: unique.map(inventoryItemGid),
      locationId: locationGid(locationId),
    });

    const result: Record<string, number> = {};
    for (const node of data.nodes) {
      if (!node) continue;
      const available = node.inventoryLevel?.quantities.find(
        (quantity) => quantity.name === "available",
      );
      if (available && Number.isInteger(available.quantity)) {
        result[numericId(node.id)] = available.quantity;
        result[node.id] = available.quantity;
      }
    }
    return result;
  }

  async apply(plan: ShopifyAdjustmentPlan): Promise<{ transactionId: string }> {
    const data = await this.transport.request<{
      inventoryAdjustQuantities: {
        inventoryAdjustmentGroup: null | {
          createdAt: string;
          referenceDocumentUri: string | null;
        };
        userErrors: Array<{ field: string[] | null; message: string }>;
      };
    }>(ADJUST_MUTATION, {
      input: {
        reason: plan.reason,
        name: "available",
        referenceDocumentUri: plan.referenceDocumentUri,
        changes: plan.changes.map((change) => ({
          inventoryItemId: inventoryItemGid(change.inventoryItemId),
          locationId: locationGid(change.locationId),
          delta: change.delta,
        })),
      },
    });

    const result = data.inventoryAdjustQuantities;
    if (result.userErrors.length) {
      throw new Error(
        `Shopify rejected inventory conversion: ${result.userErrors
          .map((error) => error.message)
          .join("; ")}`,
      );
    }
    if (!result.inventoryAdjustmentGroup) {
      throw new Error("Shopify did not return an inventory adjustment group.");
    }

    return {
      transactionId:
        result.inventoryAdjustmentGroup.referenceDocumentUri ||
        result.inventoryAdjustmentGroup.createdAt,
    };
  }
}
