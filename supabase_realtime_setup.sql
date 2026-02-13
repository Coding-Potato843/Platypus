-- ============================================
-- Platypus - Supabase Realtime 활성화 설정
-- ============================================
-- Supabase Dashboard > SQL Editor에서 실행하세요
--
-- 이 스크립트는 Realtime에 필요한 모든 테이블을
-- supabase_realtime publication에 추가합니다.
-- ============================================

-- 1. 기존 테이블 제거 후 다시 추가 (각각 개별 처리하여 에러 방지)
DO $$
DECLARE
    _tbl TEXT;
BEGIN
    FOREACH _tbl IN ARRAY ARRAY['photos','friendships','groups','photo_groups','users']
    LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', _tbl);
            RAISE NOTICE 'Dropped table % from publication', _tbl;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Table % was not in publication, skipping drop', _tbl;
        END;
    END LOOP;
END $$;

-- 2. 모든 필요한 테이블을 Realtime publication에 추가
DO $$
DECLARE
    _tbl TEXT;
BEGIN
    FOREACH _tbl IN ARRAY ARRAY['photos','friendships','groups','photo_groups','users']
    LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', _tbl);
            RAISE NOTICE 'Added table % to publication', _tbl;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Table % already in publication or error: %', _tbl, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. REPLICA IDENTITY 설정 (UPDATE/DELETE 이벤트에서 old 레코드 포함)
ALTER TABLE public.photos REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.photo_groups REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;

-- 4. 최종 확인 - 등록된 테이블 목록 출력
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
