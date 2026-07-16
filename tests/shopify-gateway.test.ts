import { describe, expect, it } from "vitest";
import {
  ShopifyGraphqlGateway,
  type ShopifyGraphqlTransport,
} from "../src/shopify-gateway.js";
import type { ShopifyAdjustmentPlan } from "../src/shopify-adjustment.js";

class FakeTransport implements ShopifyGraphqlTransport {
  calls: Array<{ query: string; variables: Record<string, unknown> }> = [];

  constructor(private readonly responses: unknown[]) {}

  async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    this.calls.push({ query, variables });
    const response = this.responses.shift();
    if (!response) throw new Error("No fake response configured.");
    return response as T;
  }
}

describe("ShopifyGraphqlGateway", () => {
  it("reads available inventory for case and base items", async () => {
    const transport = new FakeTransport([
      {
        nodes: [
          {
            id: "gid://shopify/InventoryItem/100",
            inventoryLevel: {
              quantities: [{ name: "available", quantity: 5 }],
            },
          },
          {
            id: "gid://shopify/InventoryItem/200",
            inventoryLevel: {
              quantities: [{ name: "available", quantity: -10 }],
            },
          },
        ],
      },
    ]);
    const gateway = new ShopifyGraphqlGateway(transport);

    const levels = await gateway.readAvailable("79814754495", ["100", "200"]);

    expect(levels).toMatchObject({ "100": 5, "200": -10 });
    expect(transport.calls[0]?.variables).toEqual({
      ids: [
        "gid://shopify/InventoryItem/100",
        "gid://shopify/InventoryItem/200",
      ],
      locationId: "gid://shopify/Location/79814754495",
    });
  });

  it("submits both case and base changes as one adjustment", async () => {
    const transport = new FakeTransport([
      {
        inventoryAdjustQuantities: {
          inventoryAdjustmentGroup: {
            createdAt: "2026-07-16T21:00:00Z",
            referenceDocumentUri: "unit-conversion://shop/location/case/run",
          },
          userErrors: [],
        },
      },
    ]);
    const gateway = new ShopifyGraphqlGateway(transport);
    const plan: ShopifyAdjustmentPlan = {
      reason: "correction",
      referenceDocumentUri: "unit-conversion://shop/location/case/run",
      idempotencyKey: "location:case:run",
      changes: [
        { inventoryItemId: "100", locationId: "79814754495", delta: -1 },
        { inventoryItemId: "200", locationId: "79814754495", delta: 72 },
      ],
    };

    const applied = await gateway.apply(plan);

    expect(applied.transactionId).toBe(plan.referenceDocumentUri);
    expect(transport.calls[0]?.variables).toEqual({
      input: {
        reason: "correction",
        name: "available",
        referenceDocumentUri: plan.referenceDocumentUri,
        changes: [
          {
            inventoryItemId: "gid://shopify/InventoryItem/100",
            locationId: "gid://shopify/Location/79814754495",
            delta: -1,
          },
          {
            inventoryItemId: "gid://shopify/InventoryItem/200",
            locationId: "gid://shopify/Location/79814754495",
            delta: 72,
          },
        ],
      },
    });
  });

  it("surfaces Shopify user errors", async () => {
    const transport = new FakeTransport([
      {
        inventoryAdjustQuantities: {
          inventoryAdjustmentGroup: null,
          userErrors: [{ field: ["input"], message: "Inventory item is not stocked." }],
        },
      },
    ]);
    const gateway = new ShopifyGraphqlGateway(transport);

    await expect(
      gateway.apply({
        reason: "correction",
        referenceDocumentUri: "unit-conversion://test",
        idempotencyKey: "test",
        changes: [
          { inventoryItemId: "100", locationId: "1", delta: -1 },
          { inventoryItemId: "200", locationId: "1", delta: 12 },
        ],
      }),
    ).rejects.toThrow("Inventory item is not stocked");
  });
});
