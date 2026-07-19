# Inventory Server

Shopify inventory conversion service for Sam's Nail Supply.

This project manages paired Shopify inventory items:

- base-unit SKU
- case SKU
- units per case
- per-location conversion preview and controlled inventory adjustment

No Shopify access tokens or other credentials should be stored in this repository or in Google Sheets. Use encrypted environment variables or the Shopify app session store.

## Safety-first workflow

1. Validate the SKU, Shopify location ID, quantities, and units-per-case value.
2. Generate a dry-run preview showing the before quantity, requested change, and proposed after quantity.
3. Investigate negative inventory instead of silently resetting it.
4. Require a unique request ID to prevent duplicate adjustments.
5. Require named approval and physical inventory verification before apply mode.
6. Re-read live inventory immediately before any future Shopify write.
7. Record the completed adjustment in an audit log.

The current safety module performs validation and preview calculations only. It does not call Shopify or modify production inventory.

## Development

```bash
npm install
npm run build
npm test
```
