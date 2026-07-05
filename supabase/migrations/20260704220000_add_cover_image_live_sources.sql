-- Add cover_image_url to live_sources so admin can attach a poster image for player
BEGIN;
ALTER TABLE public.live_sources
  ADD COLUMN IF NOT EXISTS cover_image_url text;
COMMIT;
