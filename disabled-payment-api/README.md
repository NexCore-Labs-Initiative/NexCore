# Disabled payment APIs

These handlers are intentionally stored outside `/api`, so Vercel does not
deploy them as serverless functions while payments are paused.

Disabled routes:

- `/api/submit-subscription`
- `/api/bank-transfer`
- `/api/paypal-capture`
- `/api/check-email-order`
- `/api/update-subscription-status`
- `/api/receipt-url`

This also pauses admin order approval and receipt viewing for existing orders.

Before re-enabling payments:

1. Complete the legal and operational review.
2. Set `PAYMENTS_ENABLED` to `true` in `lib/pricingPolicy.js`.
3. Move the required handlers back into `/api`.
4. Run `npm test` and verify both payment methods end to end.

