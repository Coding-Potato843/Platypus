-- Migration: Add privacy setting columns to users table
-- block_friend_requests: blocks incoming friend requests
-- lock_photo_downloads: prevents friends from downloading this user's photos
-- hide_location: hides photo location info from friends

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS block_friend_requests BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS lock_photo_downloads BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hide_location BOOLEAN DEFAULT true;

NOTIFY pgrst, 'reload schema';
