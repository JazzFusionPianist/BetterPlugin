-- Release tracks become metadata-only: no audio upload, just the
-- tracklist as printed on the sleeve. media_url stays for a possible
-- future streaming feature but is no longer required.
alter table public.release_tracks alter column media_url drop not null;
