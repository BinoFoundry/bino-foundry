# Milestone 2 — Commerce preparation

Prepare order flow without committing to full payment integration unless contract includes it.

**Baseline (M1):** Dynamic pricing in builders; prescription = manual follow-up; checkout CTA disabled / placeholder.

## Pricing & quotes

- [ ] Single source of truth: sunglasses + bracelet pricing from DB
- [ ] Tax/shipping placeholders documented as out of scope or TBD
- [ ] Currency display (USD) consistent in UI and API
- [ ] Price snapshot at save time (store computed total on configuration)

## Cart & checkout (scope TBD)

- [ ] Product definition: sunglasses config vs bracelet config as line items
- [ ] Guest vs authenticated checkout decision
- [ ] “Request quote” / “Submit order” for prescription paths
- [ ] Email or webhook notification on new order (design)
- [ ] Admin view of submitted configurations (status `ordered`)

## Payment integration (optional)

- [ ] Payment provider selection (Stripe, etc.)
- [ ] Webhook handler module in backend
- [ ] Idempotency keys for checkout session
- [ ] Refund/chargeback — out of scope note

## Legal & UX copy

- [ ] Terms / privacy links in footer
- [ ] Lens disclaimer retained at checkout
- [ ] Prescription degree limitations at commit step

## Database (if orders in scope)

- [ ] Migration: `orders`, `order_items` (or extend `bracelet_configurations`)
- [ ] FK to saved configurations
- [ ] No inventory deduction (per M1 conventions)

## Verify

1. User completes bracelet → save → submit order request → row status `ordered`.
2. Admin can see order reference and configuration payload.
3. Pricing on submitted order matches builder total at save time.

## Dependencies

- [MILESTONE2_BRACELET_CHECKLIST.md](./MILESTONE2_BRACELET_CHECKLIST.md) — save/load reliable
- [MILESTONE2_BACKEND_CHECKLIST.md](./MILESTONE2_BACKEND_CHECKLIST.md) — auth + status transitions
