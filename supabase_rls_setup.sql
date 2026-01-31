-- ============================================
-- Platypus - Supabase RLS 정책 설정
-- ============================================
-- Supabase Dashboard > SQL Editor에서 실행하세요
--
-- 실행 순서:
-- 1. 먼저 이 파일 전체를 복사
-- 2. Supabase Dashboard > SQL Editor 열기
-- 3. 붙여넣기 후 "Run" 클릭
-- ============================================

-- ============================================
-- 1. RLS 활성화 (모든 테이블)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. users 테이블 RLS 정책
-- ============================================
-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.users;

-- 모든 사용자 프로필 조회 가능 (친구 검색을 위해)
CREATE POLICY "Users can view all profiles"
ON public.users FOR SELECT
TO authenticated
USING (true);

-- 자신의 프로필만 생성 가능
CREATE POLICY "Users can insert own profile"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 자신의 프로필만 수정 가능
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 자신의 프로필만 삭제 가능 (회원탈퇴)
CREATE POLICY "Users can delete own profile"
ON public.users FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- ============================================
-- 3. photos 테이블 RLS 정책
-- ============================================
-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Users can view own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can view friends photos" ON public.photos;
DROP POLICY IF EXISTS "Users can insert own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can update own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can delete own photos" ON public.photos;

-- 자신의 사진 조회
CREATE POLICY "Users can view own photos"
ON public.photos FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 친구의 사진 조회 (친구 관계가 있는 경우)
CREATE POLICY "Users can view friends photos"
ON public.photos FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT friend_id FROM public.friendships WHERE user_id = auth.uid()
  )
);

-- 자신의 사진만 추가
CREATE POLICY "Users can insert own photos"
ON public.photos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 자신의 사진만 수정
CREATE POLICY "Users can update own photos"
ON public.photos FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 자신의 사진만 삭제
CREATE POLICY "Users can delete own photos"
ON public.photos FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- 4. groups 테이블 RLS 정책
-- ============================================
-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Users can view own groups" ON public.groups;
DROP POLICY IF EXISTS "Users can insert own groups" ON public.groups;
DROP POLICY IF EXISTS "Users can update own groups" ON public.groups;
DROP POLICY IF EXISTS "Users can delete own groups" ON public.groups;

-- 자신의 그룹만 조회
CREATE POLICY "Users can view own groups"
ON public.groups FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 자신의 그룹만 생성
CREATE POLICY "Users can insert own groups"
ON public.groups FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 자신의 그룹만 수정
CREATE POLICY "Users can update own groups"
ON public.groups FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 자신의 그룹만 삭제
CREATE POLICY "Users can delete own groups"
ON public.groups FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- 5. photo_groups 테이블 RLS 정책
-- ============================================
-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Users can view own photo_groups" ON public.photo_groups;
DROP POLICY IF EXISTS "Users can insert own photo_groups" ON public.photo_groups;
DROP POLICY IF EXISTS "Users can delete own photo_groups" ON public.photo_groups;

-- 자신의 사진-그룹 연결만 조회
CREATE POLICY "Users can view own photo_groups"
ON public.photo_groups FOR SELECT
TO authenticated
USING (
  photo_id IN (SELECT id FROM public.photos WHERE user_id = auth.uid())
);

-- 자신의 사진-그룹 연결만 생성
CREATE POLICY "Users can insert own photo_groups"
ON public.photo_groups FOR INSERT
TO authenticated
WITH CHECK (
  photo_id IN (SELECT id FROM public.photos WHERE user_id = auth.uid())
  AND
  group_id IN (SELECT id FROM public.groups WHERE user_id = auth.uid())
);

-- 자신의 사진-그룹 연결만 삭제
CREATE POLICY "Users can delete own photo_groups"
ON public.photo_groups FOR DELETE
TO authenticated
USING (
  photo_id IN (SELECT id FROM public.photos WHERE user_id = auth.uid())
);

-- ============================================
-- 6. friendships 테이블 RLS 정책
-- ============================================
-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can insert own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete friendships as friend" ON public.friendships;

-- 자신의 친구 관계만 조회
CREATE POLICY "Users can view own friendships"
ON public.friendships FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 자신의 친구 관계만 생성 (자기 자신을 친구로 추가 불가)
CREATE POLICY "Users can insert own friendships"
ON public.friendships FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() != friend_id
);

-- 자신의 친구 관계만 삭제
CREATE POLICY "Users can delete own friendships"
ON public.friendships FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 자신이 friend로 등록된 관계 삭제 (회원탈퇴 시 필요)
CREATE POLICY "Users can delete friendships as friend"
ON public.friendships FOR DELETE
TO authenticated
USING (auth.uid() = friend_id);

-- ============================================
-- 완료 메시지
-- ============================================
-- 모든 RLS 정책이 설정되었습니다!
--
-- 다음 단계:
-- 1. Storage > photos 버킷 생성 (아직 안했다면)
-- 2. Storage > photos 버킷 > Policies에서 정책 추가
--    또는 아래 Storage RLS 쿼리를 별도로 실행
-- ============================================
