-- ============================================
-- Platypus - 친구 별명 기능 마이그레이션
-- ============================================
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- ============================================

-- 1. friend_nicknames 테이블 생성
CREATE TABLE IF NOT EXISTS public.friend_nicknames (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    UNIQUE(user_id, friend_id)
);

-- 2. RLS 활성화
ALTER TABLE public.friend_nicknames ENABLE ROW LEVEL SECURITY;

-- 3. RLS 정책 (별명을 설정한 사용자만 접근 가능)
DROP POLICY IF EXISTS "Users can view own friend nicknames" ON public.friend_nicknames;
DROP POLICY IF EXISTS "Users can insert own friend nicknames" ON public.friend_nicknames;
DROP POLICY IF EXISTS "Users can update own friend nicknames" ON public.friend_nicknames;
DROP POLICY IF EXISTS "Users can delete own friend nicknames" ON public.friend_nicknames;

CREATE POLICY "Users can view own friend nicknames"
ON public.friend_nicknames FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own friend nicknames"
ON public.friend_nicknames FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friend nicknames"
ON public.friend_nicknames FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own friend nicknames"
ON public.friend_nicknames FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_friend_nicknames_user_id ON public.friend_nicknames(user_id);
