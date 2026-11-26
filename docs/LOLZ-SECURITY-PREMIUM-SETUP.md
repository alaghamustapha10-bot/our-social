# LOLZ security, stories, and Premium rollout

This branch is **not deployed** and is not merged into `main`.

## 1. Apply the Supabase database migration

Apply this file to the LOLZ Supabase project first:

`supabase/migrations/20261126120000_lolz_security_stories_premium.sql`

You can apply it from the Supabase SQL Editor, or from a trusted local machine after linking the CLI to the correct project. Review the SQL and take a database backup before applying it to production.

The migration adds:
- Private reports with reporter ownership, admin-only review, and a per-user rate limit.
- User blocking with database-level filters for profiles, feed items, stories, videos, and private conversations.
- Story view records and an owner-only viewer-count RPC.
- A private `private-messages` Storage bucket for new direct-message attachments.
- Read-only user access to subscription records; only the Edge Function writes billing state.

The SQL migration is not executed by GitHub Actions. A green web build does not mean the database migration has been applied.

## 2. Deploy the PayPal Edge Function

After the migration is applied, deploy:

`supabase/functions/paypal-subscription/index.ts`

From a logged-in Supabase CLI session linked to the LOLZ project:

```powershell
supabase functions deploy paypal-subscription
```

The function has `verify_jwt = false` in `supabase/config.toml` because PayPal webhooks do not carry a Supabase user JWT. User actions are still authenticated inside the function with Supabase Auth, and incoming PayPal webhooks are checked against PayPal's signature-verification API.

## 3. Add Edge Function secrets in Supabase

Set these under **Supabase → Edge Functions → Secrets**. Do not commit the values to GitHub or paste them into chat.

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_PLAN_ID`
- `PAYPAL_WEBHOOK_ID`
- `APP_BASE_URL` (for this project: `https://our-social-public.vercel.app`)
- `PAYPAL_API_BASE` (omit for live PayPal; use `https://api-m.sandbox.paypal.com` only for sandbox testing)

The function expects the Supabase project URL and service-role key from the Edge Function runtime environment. Never place the service-role key in the browser app.

The configured PayPal plan must be **active**, have exactly one regular billing cycle, and charge **EUR 2.99 every month**. The function checks this before creating a subscription; it rejects a mismatched plan instead of charging a different price.

## 4. Register the PayPal webhook

In the PayPal Developer Dashboard, create a webhook pointing to:

`https://edxwpivsuximriwdvzeq.supabase.co/functions/v1/paypal-subscription`

Subscribe to:
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`

Copy the webhook ID into the Supabase secret `PAYPAL_WEBHOOK_ID`. Test with PayPal sandbox before switching to live credentials.

## 5. Configure moderator accounts

The report-review page is visible only when the authenticated user's **app metadata** contains:

`{ "role": "admin" }`

Set this using a trusted server-side Supabase Auth admin workflow. Do not put an admin role in editable user metadata or expose a service-role key to the browser. Have the moderator sign out and back in after the claim changes.

## 6. Important privacy limitation

New direct-message attachments are uploaded to the private bucket and served through short-lived signed URLs after the message is saved. Older direct-message attachments that already have public `social-media` URLs are not moved automatically by this migration; their original public URLs may remain accessible until a separate, carefully tested media migration is carried out.

Other media used for public posts, stories, reels, groups, and channels continues to use the existing `social-media` bucket. This branch does not claim that every historical Storage object or every existing table policy has been fully audited.

## 7. Local testing

Fetch and switch to this feature branch only after saving any uncommitted local work:

```powershell
git fetch origin
git switch feature/lolz-stories-security-premium
git pull
npm ci
npm run build
npm run lint
npm run dev -- --force --host 127.0.0.1 --port 5180 --strictPort
```

Test stories (image, video, next/previous, replies, heart, and view count), reporting, blocking/unblocking, private-message attachments from both participants, and Premium checkout/cancellation in PayPal sandbox before production release.
