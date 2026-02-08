-- ============================================
-- Friend Request System Migration
-- Run this in Supabase SQL Editor BEFORE deploying code changes
-- ============================================

-- 1. Add status column to friendships table
ALTER TABLE public.friendships
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'accepted'));

-- 2. Migrate existing friendships to 'accepted' (they were instant-adds)
UPDATE public.friendships SET status = 'accepted';

-- 3. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);

-- 4. Prevent reverse-direction duplicate friendships
CREATE OR REPLACE FUNCTION check_duplicate_friendship()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id = NEW.friend_id AND friend_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Friendship already exists in reverse direction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_duplicate_friendship ON public.friendships;
CREATE TRIGGER prevent_duplicate_friendship
  BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION check_duplicate_friendship();

-- ============================================
-- 5. Update RLS Policies on friendships table
-- ============================================

-- Drop all existing friendship policies
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can insert own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete friendships as friend" ON public.friendships;
DROP POLICY IF EXISTS "Users can update friendships as receiver" ON public.friendships;

-- NEW: Users can view friendships where they are EITHER party
CREATE POLICY "Users can view own friendships"
ON public.friendships FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- INSERT: Only create friendships where you are the requester (user_id)
CREATE POLICY "Users can insert own friendships"
ON public.friendships FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() != friend_id
);

-- NEW: UPDATE policy - only the RECEIVER (friend_id) can update status (accept)
CREATE POLICY "Users can update friendships as receiver"
ON public.friendships FOR UPDATE
TO authenticated
USING (auth.uid() = friend_id)
WITH CHECK (auth.uid() = friend_id);

-- DELETE: The SENDER can cancel/delete their own request
CREATE POLICY "Users can delete own friendships"
ON public.friendships FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- DELETE: The RECEIVER can reject (delete) incoming requests
-- Also needed for account deletion cleanup
CREATE POLICY "Users can delete friendships as friend"
ON public.friendships FOR DELETE
TO authenticated
USING (auth.uid() = friend_id);

-- ============================================
-- 6. Update photos RLS policy for bidirectional friendships
-- ============================================

-- Drop existing friend photos policy
DROP POLICY IF EXISTS "Users can view friends photos" ON public.photos;

-- NEW: View friend photos only for ACCEPTED friendships, BIDIRECTIONAL
CREATE POLICY "Users can view friends photos"
ON public.photos FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT friend_id FROM public.friendships
    WHERE user_id = auth.uid() AND status = 'accepted'
    UNION
    SELECT user_id FROM public.friendships
    WHERE friend_id = auth.uid() AND status = 'accepted'
  )
);

-- ============================================
-- Done! Verify with:
-- SELECT * FROM public.friendships LIMIT 10;
-- ============================================
