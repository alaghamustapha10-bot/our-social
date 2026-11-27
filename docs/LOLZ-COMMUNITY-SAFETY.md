# LOLZ Community Safety

## Moderation behavior

- Clear explicit sexual/pornographic phrases, drug-selling promotions, and gambling/betting promotions are screened locally before publishing.
- A PostgreSQL trigger applies a second text-only backstop to posts, stories, profile bios, comments, LOLZ comments, direct messages, group messages, channel posts, and LOLZ video captions.
- Images and videos are checked through the authenticated `lolz-moderate` Supabase Edge Function using OpenAI's `omni-moderation-latest` moderation endpoint.
- Video review samples four frames across the clip. This is a screening aid, not a guarantee that every frame or violation will be detected.
- Voice and other audio messages are not automatically transcribed or analyzed. They remain reportable and subject to human review.
- Reports are private to the reporter and trusted moderators. Moderator actions are audited in `lolz_moderation_actions`.

## Enable image and video review

In the Supabase Dashboard for the LOLZ project, open **Edge Functions → Secrets**:

https://supabase.com/dashboard/project/edxwpivsuximriwdvzeq/functions/secrets

Add:

- Name: `OPENAI_API_KEY`
- Value: an API key from the OpenAI API platform

Keep the key only in Supabase secrets. Never put it in React code, GitHub, Android assets, or a chat message. The function can be deployed before this secret is added, but image/video uploads remain blocked until the secret is present and the service responds successfully.

## Important limitations

Automated moderation can make mistakes and cannot guarantee that all prohibited content is caught. Keep user reporting, moderator review, appeals/corrections, and clear written rules available. Do not submit known or suspected child sexual abuse material to the moderation endpoint; follow the appropriate safety and legal escalation process instead.
