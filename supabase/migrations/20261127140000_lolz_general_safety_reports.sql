-- Allow private reports about community rules or safety features in general.
begin;
alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;
alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type in (
    'user','post','video','comment','message','story','group','channel',
    'group_message','channel_post','lolz_comment','other'
  ));
commit;
