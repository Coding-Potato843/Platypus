-- Migration: Add block_friend_requests column to users table
-- This allows users to block incoming friend requests.
-- When enabled, other users cannot send friend requests to this user.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS block_friend_requests BOOLEAN DEFAULT false;
