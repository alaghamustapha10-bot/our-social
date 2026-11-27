-- Persist story editor presentation metadata.
begin;

alter table public.stories
  add column if not exists media_filter text not null default 'none',
  add column if not exists caption_position text not null default 'bottom';

alter table public.stories
  drop constraint if exists stories_media_filter_check;
alter table public.stories
  add constraint stories_media_filter_check
  check (media_filter in ('none', 'warm', 'mono', 'vivid', 'cool', 'soft'));

alter table public.stories
  drop constraint if exists stories_caption_position_check;
alter table public.stories
  add constraint stories_caption_position_check
  check (caption_position in ('top', 'middle', 'bottom'));

commit;