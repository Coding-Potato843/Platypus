-- Migration: Add block_friend_requests and lock_photo_downloads columns to users table
-- block_friend_requests: blocks incoming friend requests
-- lock_photo_downloads: prevents friends from downloading this user's photos

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS block_friend_requests BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS lock_photo_downloads BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';
