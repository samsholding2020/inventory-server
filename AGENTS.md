# AGENTS.md

## Purpose

This repository is the controlled Shopify inventory conversion service for Sam's Nail Supply. Codex should improve reliability, testing, observability, and operator safety without making unapproved production changes.

## Business context

The service manages paired inventory records:

- base-unit SKU
- case SKU
- configured units per case
- Shopify inventory by location
- previewed and controlled adjustments

Sam's Nail Supply operates multiple Shopify and ConnectPOS locations. Location identity and SKU identity are business-critical.

## Non-negotiable safety rules

1. Never deploy, write to production Shopify inventory, change prices, fulfill orders, or alter live product data without David Tran's explicit approval.
2. Default every inventory operation to preview or dry-run mode.
3. Require a separate, explicit approval step before executing a proposed inventory write.
4. Never store Shopify access tokens, API secrets, passwords, private keys, or customer data in source code, tests, fixtures, logs, issues, or documentation.
5. Use encrypted environment variables or the approved Shopify app session store for credentials.
6. Never substitute one color, product, variant, or SKU for another.
7. Never infer a Shopify or ConnectPOS location mapping. Validate it against configured location IDs.
8. Treat negative inventory as an exception requiring investigation, not as permission to automatically set inventory to zero.
9. Block production changes when physical inventory has not been verified.
10. Do not silently repair duplicate SKUs, missing SKUs, conflicting case sizes, or location mismatches. Surface them as blocking validation errors.

## Inventory conversion rules

- Use only the configured `unitsPerCase` value for conversions.
- Supported common case sizes include 4, 6, and 12, but code must not assume those are the only valid sizes.
- Use integer-safe arithmetic. Reject fractional unit results.
- Show the complete calculation in preview output.
- A proposed adjustment must include:
  - base SKU
  - case SKU
  - Shopify location ID
  - units per case
  - current base quantity
  - current case quantity
  - requested action
  - proposed base quantity
  - proposed case quantity
  - validation warnings or blockers
- Re-read current inventory immediately before an approved write when possible, and stop if quantities changed after preview.

## Idempotency and concurrency

- Every write request must have an idempotency key.
- Repeated requests with the same key must not apply the inventory adjustment twice.
- Use optimistic concurrency or an equivalent compare-before-write safeguard.
- Record failed, blocked, previewed, approved, and completed operations distinctly.

## Audit logging

Every proposed or executed adjustment should record:

- timestamp
- actor or requesting system
- approval identity when applicable
- idempotency key
- base SKU and case SKU
- Shopify location ID
- quantities before the operation
- requested adjustment
- quantities after the operation
- preview, blocked, approved, failed, or completed status
- error or validation reason

Do not log secrets or unnecessary customer data.

## Testing requirements

Before opening a pull request, run:

```bash
npm test
npm run build
```

Add or maintain tests for:

- case sizes 4, 6, and 12
- zero inventory
- negative inventory
- missing base SKU
- missing case SKU
- duplicate SKU
- invalid or missing location ID
- mismatched location mapping
- fractional conversion result
- duplicate idempotency key
- inventory changed between preview and write
- write attempted without approval
- rollback or compensating action behavior where supported

Tests must not call the live Shopify Admin API.

## Change strategy

- Keep changes small and reviewable.
- Prefer pure calculation and validation functions over logic coupled directly to Shopify API calls.
- Separate preview generation, approval, execution, and audit persistence.
- Preserve existing behavior unless the issue or task explicitly requires a change.
- Document assumptions and unresolved production details in the pull request.
- Open draft pull requests by default.

## Pull request checklist

- [ ] Scope matches the linked issue.
- [ ] No credentials or sensitive data were committed.
- [ ] Dry-run remains the default.
- [ ] Production writes require explicit approval.
- [ ] Location and SKU validation are enforced.
- [ ] Idempotency and concurrency risks were considered.
- [ ] Tests pass.
- [ ] TypeScript build passes.
- [ ] Operational impact and rollback are documented.
