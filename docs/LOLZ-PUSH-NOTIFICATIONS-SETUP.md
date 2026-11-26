# LOLZ Push Notifications Setup

This branch contains the application and server code for Android push notifications.

## What is included

- FCM device-token registration and account ownership in `public.push_tokens`.
- Server-side FCM HTTP v1 delivery from the `lolz-push` Supabase Edge Function.
- Push delivery for likes, comments, follows, story replies, direct messages, group messages, channel posts, incoming calls, missed calls, and successful group/channel joins.
- Android channels for calls, messages, and social activity.
- Foreground presentation, notification tap routing, and live refresh of the in-app activity list.
- Expired FCM tokens are removed from `push_tokens`.

## Required one-time provider setup

The repository currently does not contain an Android Firebase config file. This is intentionally not committed because it is project-specific.

1. In Firebase Console, create/select the Firebase project and register an Android app with package name `com.oursocial.app`.
2. Download `google-services.json` and place it at `android/app/google-services.json` in the local Android project. Keep the file out of Git.
3. In Firebase Project Settings → Service accounts, create a service-account private key. Store the complete JSON securely as a Supabase Edge Function secret named `FIREBASE_SERVICE_ACCOUNT_JSON`. Do not commit it, paste it into chat, or put it in a frontend environment variable.
4. Apply the migration `supabase/migrations/20261126140000_lolz_push_notifications.sql` to the linked Supabase project.
5. Deploy the function with `supabase functions deploy lolz-push`. The function uses the normal authenticated-user JWT verification and the built-in Supabase service-role environment variable.

The Firebase Android app package must match `capacitor.config.json` (`com.oursocial.app`). Capacitor's Android push integration requires the project-specific `google-services.json` file in the app module directory.

## Local Android sync

After placing the Firebase config file locally, run:

```powershell
npx cap sync android
```

Then rebuild and install the Android app. Web preview in Chrome cannot validate native FCM delivery.

## Test matrix

Use two Android devices/accounts:

- Device A likes/comments/follows Device B.
- Device A sends a text, photo, video, or voice DM to Device B.
- Device A sends a group message or channel update where Device B is a member.
- Device A starts a private, group, or channel call for Device B.
- Device B rejects a private call to confirm the caller receives a missed-call notification.
- Repeat with LOLZ open, in the background, and closed from the recent-apps screen. Tap each notification and confirm it returns to the relevant in-app area.

Android notification permission and notification-channel settings are controlled by the device owner. Users can disable notifications or individual channel sounds in Android Settings.

## Current scope note

The existing group/channel code joins users immediately; it does not currently implement a separate pending-approval join-request workflow. This branch notifies the owner/admin when someone successfully joins. A true pending request/approve/deny feature would need its own UI and database workflow.
