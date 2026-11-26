# LOLZ admin dashboard rollout
Run `supabase/migrations/20261126190000_lolz_admin_verified_controls.sql` once in Supabase SQL Editor.
Deploy from a terminal linked to the LOLZ project:
```powershell
supabase functions deploy lolz-admin
supabase functions deploy paypal-subscription
```
In Supabase → Authentication → Users, set your account's trusted **app_metadata** to:
```json
{ "role": "owner" }
```
Do not use user_metadata. Sign out and back in. Keep owner access private.
Confirm Supabase Edge Function secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID, PAYPAL_WEBHOOK_ID, APP_BASE_URL=https://our-social-public.vercel.app. Set PAYPAL_API_BASE=https://api-m.sandbox.paypal.com only for Sandbox; omit for Live. PayPal plan must be Active and exactly EUR 2.99/month. Webhook: https://edxwpivsuximriwdvzeq.supabase.co/functions/v1/paypal-subscription.
The admin dashboard includes account search, verification grant/revoke, manual Premium grant/revoke, suspension/restore and platform counts. Existing report review stays available. Privileged actions are checked in the server function.
