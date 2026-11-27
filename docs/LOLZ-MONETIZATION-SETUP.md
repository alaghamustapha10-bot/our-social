# LOLZ Monetization & Creator Economy

## What is included

This feature branch adds an optional earning hub at **Earn on LOLZ**. It keeps core social functions free and adds the following building blocks:

- Existing LOLZ Premium subscription (EUR 2.99/month) continues to use the separate `paypal-subscription` function.
- Creator and business seller profiles.
- Marketplace offers for creator memberships, community access passes, original digital products, event tickets, courses, bookings and services.
- Creator tips and voluntary LOLZ project support.
- Server-created PayPal Orders v2 checkout for marketplace purchases, tips and project support.
- A 10% platform fee on paid marketplace orders and creator tips. The amount is displayed in the earnings ledger; the remaining 90% is recorded as seller net.
- Appointment requests with provider accept/decline and customer cancellation.
- Sponsored collaboration briefs with creator applications.
- Ad campaign submissions with moderator approval.
- Earnings history and seller payout requests with administrator review.

## Required Supabase setup

The migration is:

`supabase/migrations/20261127235900_lolz_monetization_marketplace.sql`

Apply it to the correct LOLZ Supabase project before opening the monetization hub. Then deploy the Edge Function:

```powershell
supabase functions deploy lolz-commerce
```

The function is configured with `verify_jwt = true`. It authenticates every user action using the signed-in Supabase session.

## PayPal configuration

The new function requires these Edge Function secrets:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `APP_BASE_URL`

For Sandbox testing, set:

- `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`

For Live payments, omit `PAYPAL_API_BASE` or set it to `https://api-m.paypal.com` only after merchant verification and successful Sandbox tests.

Optional comma-separated allowed origins can be set with `LOLZ_ALLOWED_CHECKOUT_ORIGINS`. Local `http://127.0.0.1:5180` and `http://localhost:5180` return URLs are allowed only while PayPal is configured for Sandbox.

Never place PayPal secrets in React, Vite environment variables, Android assets, or GitHub source. Do not send secret values in chat. Existing Premium subscription credentials and webhooks are separate and must remain configured for the current Premium feature.

## Payment and seller accounting

- The server reads the offer price from Supabase; it never trusts a price sent by the browser.
- PayPal order creation and capture happen in the Edge Function.
- A purchase is marked paid only after PayPal confirms a completed EUR capture and the captured amount matches the server-side order.
- A server-created entitlement is recorded for paid offers with the chosen expiry date.
- LOLZ currently receives the PayPal order payment into the platform's merchant account. Seller balances are accounting records, not an automatic split payment.
- Sellers request withdrawals; an administrator reviews them. A request can be marked paid only after the actual external transfer has been completed.
- The 10% fee and seller's 90% net are displayed before the feature is launched to users. Revisit the fee and terms before any live launch.

## Important current limitations

This is a first commerce foundation, not a fully automated marketplace:

- Membership/community purchases create time-limited entitlement records, but they are not yet wired into every group/channel permission check. Do not advertise automatic private access until that integration is completed.
- Sellers manually deliver digital files, course access, tickets and other purchased services. The marketplace does not yet host a protected download library, ticket QR check-in, stock controls or refunds workflow.
- Appointment listings create requests only; a request is not a confirmed booking and no booking fee is collected yet.
- Collaboration briefs and applications connect parties; they do not escrow or automatically pay sponsorship fees.
- Ad campaigns stay pending until a moderator reviews them. Approval does not yet schedule, charge for or display an advertisement.
- Seller payouts are manually reviewed and transferred outside LOLZ. No bank or PayPal Payouts automation is enabled.
- PayPal commerce confirmation currently occurs when the buyer returns to LOLZ and the server captures the approved order. Unreturned approvals may remain pending and require reconciliation.
- Before a public merchant launch, add marketplace terms, seller identity/business verification, consumer cancellation/refund policy, VAT/tax handling, prohibited-goods enforcement, dispute handling and privacy disclosures appropriate to the countries served.

## Halal and trust controls

Only offer goods and services that are lawful and permissible. Marketplace offers and sponsorship briefs enter a review queue before they become public. Ad campaigns require moderator approval. Prohibit gambling, interest-based finance, alcohol, deceptive offers, fake engagement and harmful promotions. Describe the goods, price, seller, fulfilment, refund conditions and platform fee clearly. This technical checklist is not a religious ruling; review the final business terms with a qualified adviser before going live.
