# Inventory Server

Shopify inventory conversion service for Sam's Nail Supply.

This project manages paired Shopify inventory items:

- base-unit SKU
- case SKU
- units per case
- per-location conversion preview and controlled inventory adjustment

No Shopify access tokens or other credentials should be stored in this repository or in Google Sheets. Use encrypted environment variables or the Shopify app session store.
