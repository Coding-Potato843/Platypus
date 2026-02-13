> **Note**: This file must be written in English only.

---

## Subagents (Task Tool)

**IMPORTANT**: Actively use subagents for complex tasks to improve efficiency and reduce context usage.

| Subagent | When to Use |
|----------|-------------|
| `Explore` | Finding files, understanding codebase structure |
| `Plan` | Designing architecture, planning multi-step implementations |
| `code-finder` | Locating where specific features/functions are implemented |
| `code-reviewer` | Analyzing readability, performance, security before commits |
| `error-extractor` | Parsing stack traces and error logs |
| `claude-code-guide` | Questions about Claude Code features and settings |

Launch multiple agents in parallel for independent tasks.

---

# Platypus - Photo Sharing & Organization App

## Tech Stack
- **Web Frontend**: Vanilla JS (ES6 modules), Custom CSS, Phosphor Icons, Inter font, Korean UI
- **Mobile App**: React Native + Expo SDK 54, TypeScript (see `app/app_description.txt` for details)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS, Realtime) - Direct frontend connection (serverless)
- **Hosting**: Render (Static Site, auto-deploy from `main` branch, publish dir: `Frontend`)

## File Structure
```
Project_02_Platypus/
├── Frontend/                         # Web frontend
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── main.js                   # App entry, state, event listeners
│   │   ├── services/
│   │   │   ├── api.js                # Supabase client & all API calls
│   │   │   └── auth.js               # Supabase Auth wrapper
│   │   ├── components/
│   │   │   ├── gallery.js            # Photo gallery rendering
│   │   │   ├── modals.js             # Modal components
│   │   │   ├── slideshow.js          # Slideshow player
│   │   │   └── tabs.js               # Tab navigation
│   │   └── utils/
│   │       └── exif.js               # EXIF parser & reverse geocoding
│   └── background_image/
│       ├── images.json               # Background image list for login page
│       └── *.png
├── app/                              # Mobile app (React Native + Expo)
│   ├── App.tsx                       # Entry point
│   ├── app_description.txt           # Mobile app documentation
│   └── src/                          # screens/, services/, components/, hooks/, config/, types/
├── supabase_rls_setup.sql            # RLS policies for all tables
├── supabase_friend_request_migration.sql  # Friend request system migration
├── supabase_friend_nicknames_migration.sql  # Friend nicknames migration
├── supabase_block_friend_requests_migration.sql  # Privacy settings migration
├── supabase_realtime_setup.sql       # Realtime publication setup
└── CLAUDE.md
```

---

## Database Schema

> **Two user tables**: `auth.users` (Supabase Auth - email/password/login) and `public.users` (app profile data). App features reference `public.users.id` via foreign keys.

### users
`id` (uuid PK, = auth.users.id), `email` (text UNIQUE), `username` (text, display name), `user_id` (text UNIQUE, handle like @_a3x9), `avatar_url` (text), `created_at` (timestamp), `last_sync_at` (timestamp, last mobile scan date), `block_friend_requests` (boolean DEFAULT false), `lock_photo_downloads` (boolean DEFAULT true), `hide_location` (boolean DEFAULT true)

### photos
`id` (uuid PK), `user_id` (uuid FK→users), `url` (text), `date_taken` (timestamp), `location` (text), `file_hash` (text, SHA-256 for dedup), `created_at` (timestamp, upload date)

### groups
`id` (uuid PK), `user_id` (uuid FK→users), `name` (text), `created_at` (timestamp)

### photo_groups (Junction)
`photo_id` + `group_id` = Composite PK (N:M)

### friendships
`id`, `user_id` (requester), `friend_id` (receiver), `status` ('pending'|'accepted'), `created_at`
- UNIQUE on (user_id, friend_id); trigger blocks reverse-direction duplicates (A→B exists → B→A blocked)
- All friend queries must check BOTH directions (user_id and friend_id)

### friend_nicknames
`id` (uuid PK), `user_id` (uuid FK→users, nickname setter), `friend_id` (uuid FK→users, nicknamed person), `nickname` (text), `created_at` (timestamp)
- UNIQUE on (user_id, friend_id); one nickname per friend per user
- Private: only visible to the setter (RLS restricts all ops to `user_id = auth.uid()`)
- FK CASCADE: auto-deleted when either user is deleted

---

## Supabase Config
```javascript
const SUPABASE_URL = 'https://vtpgatnkobvjqwvoqtad.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cGdhdG5rb2J2anF3dm9xdGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NzQxNzIsImV4cCI6MjA4NTM1MDE3Mn0.Tc_lFbbkBrUusy2fI4XpNwxTXTGI2qfksU82y6AFyAQ';
```
> `anon key` is safe to expose (RLS protects data). Dashboard: https://supabase.com/dashboard/project/vtpgatnkobvjqwvoqtad

---

## API Reference

### api.js
```javascript
// Photos
getPhotos(userId, params)       // params: { sortField, sortOrder, limit, offset, location, startDate, endDate }
getPhoto(photoId)
uploadPhotos(userId, photos, onProgress)  // Hash-based dedup, progress: (current, total, 'hashing'|'uploading')
deletePhoto(photoId, userId)
updatePhotoGroups(photoId, groupIds)
calculateFileHash(file)         // SHA-256 via Web Crypto API
checkDuplicateHashes(userId, hashes)  // Returns Set of existing hashes

// Groups
getGroups(userId), createGroup(userId, name), updateGroup(groupId, userId, name), deleteGroup(groupId, userId)

// Friends (Bidirectional Request System)
getFriends(userId)              // Accepted friendships, both directions
getFriendsPhotos(userId, params)  // Author names + avatar + privacy settings via friendships FK join
sendFriendRequest(userId, friendId)       // Creates pending friendship; checks target's block_friend_requests
acceptFriendRequest(userId, friendshipId) // Receiver accepts → status='accepted'
rejectFriendRequest(userId, friendshipId) // Receiver rejects → row deleted
cancelFriendRequest(userId, friendshipId) // Sender cancels → row deleted
getPendingRequests(userId)                // Returns { received: [...], sent: [...] }
getFriendshipStatuses(userId, otherUserIds)  // Batch status check for search results
removeFriend(userId, friendId)
searchUsers(searchTerm)

// Friend Nicknames (private per-user)
getFriendNicknames(userId)                    // Returns { friendId: nickname } map
setFriendNickname(userId, friendId, nickname) // Upsert nickname
removeFriendNickname(userId, friendId)        // Delete nickname

// User
getUserProfile(userId), updateUserProfile(userId, updates), updateLastSync(userId), getUserStats(userId)
deleteUserAccount(userId)  // Cascade-deletes all user data + auth.users via RPC

// Realtime
subscribeToRealtimeChanges(userId, callbacks)  // photos, groups, friendships, photo_groups
subscribeToFriendPhotos(friendIds, callbacks)  // friend photos (all events) + friend user settings (UPDATE)
unsubscribeFromRealtime()
diagnoseRealtime()                             // Console diagnostic tool for Realtime connection status
```

### auth.js
```javascript
initAuth(), login(email, password), register(email, password, displayName)
logout(), deleteAccount(), getCurrentUser(), getCurrentUserProfile(), onAuthStateChange(callback)
validateEmail(email), validatePassword(password), validateUsername(username)
```

### utils/exif.js
```javascript
extractExifData(file)               // Date (DateTimeOriginal > DateTime > lastModified) and GPS
reverseGeocode(latitude, longitude) // OpenStreetMap Nominatim, free, 1 req/sec, cached
batchReverseGeocode(coordinates)
getFileDate(file)
```

---

## Key Architecture Patterns

### Authentication
- Email/password via Supabase Auth with session persistence
- Validation: Email (format + duplicate), Password (8+ chars, lower/number/special), Username (3-20 chars, Korean/alphanumeric/_)
- `user_id` auto-generated from display name with random suffix (e.g., `@_a3x9`) via `generateUniqueUserId()`
- `register()` takes 3 params: (email, password, displayName)
- Loading overlay shown only once per login/refresh (pass `showLoadingOverlay=false` to prevent duplicates)
- `onAuthStateChange` skips if `elements.appContainer.style.display === 'block'`

### Photo Import (Web)
1. User selects files → EXIF extraction (date, GPS) → preview with all selected
2. Background reverse geocoding → user clicks Import → SHA-256 dedup check → upload to Supabase Storage
3. Web import does NOT update `last_sync_at` (only mobile Gallery Scan tab does)

### Friend Request System
- **Flow**: Send request → receiver accepts/rejects → mutual friendship
- `user_id` = requester, `friend_id` = receiver
- Add friend modal shows 4 states: 추가/요청됨/수락/친구
- Account tab layout: Profile Card → Privacy Settings (toggles) → Friend Sub-tabs (with search) → Account Actions
- Privacy settings: block_friend_requests (default off), lock_photo_downloads (default on), hide_location (default on)
- Request sections always visible (show empty state message when none)
- Badge notification on Account tab for pending received requests
- Realtime needs two `.on()` listeners per channel (Supabase doesn't support OR filters)

### Account Deletion Order
1. Storage files → 2. photo_groups → 3. photos → 4. groups → 5. friend_nicknames → 6. friendships → 7. public.users → 8. auth.users (RPC: `delete_user_auth()`) → 9. Sign out

### Realtime
- Supabase JS pinned to `@2.95.3` via CDN (prevents silent breaking changes)
- Two channels: `db-changes` (own data) and `friend-data-changes` (friend photos + settings)
- `db-changes` channel: photos, groups, friendships (bidirectional), photo_groups
- `friend-data-changes` channel: friend photos (INSERT/UPDATE/DELETE) + friend `users` table UPDATE (privacy settings like `lock_photo_downloads`, `hide_location`)
- Friendships need two listeners: `user_id=eq.X` AND `friend_id=eq.X` (no OR filter support)
- `setupRealtimeSubscriptions()` (async) called after login: sets `supabase.realtime.setAuth(token)` before subscribing
- `TOKEN_REFRESHED` auth event keeps Realtime WebSocket token in sync
- `cleanupRealtimeSubscriptions()` on logout; uses `removeAllChannels()` for thorough cleanup
- `diagnoseRealtime()` exported for browser console debugging
- Auth initialization guard prevents double `setupRealtimeSubscriptions()` call on page load

### Duplicate Detection
- SHA-256 hash stored in `file_hash` column
- Web: Web Crypto API (`crypto.subtle`); Mobile: expo-crypto (requires dev build)
- Batch hash check before upload; skips existing photos
- UI feedback: "중복 검사 중... X/Y" → "업로드 중... X/Y"

---

## Supabase Query Gotchas

- Use `.maybeSingle()` instead of `.single()` when row might not exist (avoids PGRST116)
- FK joins: `users!friendships_friend_id_fkey` (friend_id direction), `users!friendships_user_id_fkey` (user_id direction)
- Bidirectional queries need two separate queries merged client-side
- `getFriendsPhotos()` resolves author names, avatars, and privacy settings (lock_photo_downloads, hide_location) from friendships FK joins
- `loadPhotos()` and `loadFriendPhotos()` use separate loading flags (`isLoadingMoreMyPhotos` / `isLoadingMoreFriendPhotos`) to avoid race conditions in `Promise.all`
- Groups use UUID as id (not string)

---

## UI/UX

### Layout
- 3 tabs: My Photos (내 사진), Friends (친구), Account (계정)
- Dark theme only: cyan primary `#06b6d4`, slate backgrounds (`#0f172a`, `#1e293b`)
- Gallery: responsive grid (2-5 cols), lazy loading, pagination (20/page)
- Sorting: two dropdowns — field (촬영 시간/업로드 시간) and order (최신순/오래된순)
- Slideshow: Play/Pause, Prev/Next, Arrow/Space/Escape keys, 3s auto-advance, auto-hide controls

### Components
Toast (`showToast(message, type)`), Loading overlay, Confirm modal (`openModal(elements.confirmModal)`), Photo detail modal (taken date, upload date, location, group assignment — groups/delete hidden for friend photos, download disabled if locked, location hidden if owner set hide_location), Import modal, Group modal, Profile modal, Add Friend modal, Custom tooltip (`[data-tooltip]` attribute, dark theme styled)

### Auth Page Background
Random image from `Frontend/background_image/images.json` via `setRandomAuthBackground()`. CSS: `.auth-page` with `background-size: cover` and dark overlay (70% opacity `::before`).

---

## RLS Policies

### Tables (supabase_rls_setup.sql)
- **users**: All can read, only self can create/update/delete
- **photos**: Own CRUD + read friend photos (accepted friendships, bidirectional)
- **groups**: Own groups only
- **photo_groups**: Own links only
- **friendships**: SELECT both directions, INSERT as sender, UPDATE as receiver (accept), DELETE as sender or receiver
- **friend_nicknames**: All ops restricted to own rows (`user_id = auth.uid()`)

### Storage (photos bucket)
- Public bucket (SELECT needs no policy)
- INSERT/DELETE: Authenticated users in own folder only

---

## Required Setup (Supabase SQL Editor)

### 1. User Profile Trigger
```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, username, user_id)
  values (
    new.id, new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing users
insert into public.users (id, email, username, user_id)
select id, email, split_part(email, '@', 1), split_part(email, '@', 1)
from auth.users where id not in (select id from public.users);
```

### 2. RLS Policies
Run `supabase_rls_setup.sql`

### 3. Duplicate Detection
```sql
ALTER TABLE photos ADD COLUMN IF NOT EXISTS file_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_photos_file_hash ON photos(user_id, file_hash);
```

### 4. Account Deletion RPC
```sql
CREATE OR REPLACE FUNCTION public.delete_user_auth()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = auth, public AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_user_auth() TO authenticated;
```

### 5. Realtime
Run `supabase_realtime_setup.sql` in SQL Editor to add all tables to the `supabase_realtime` publication.
Also enable Realtime toggle for each table in Dashboard → Table Editor → table settings.
Required tables: `photos`, `friendships`, `groups`, `photo_groups`, `users`

### 6. Friend Request Migration
Run `supabase_friend_request_migration.sql` (adds `status` column, updates RLS, creates dupe trigger, migrates existing rows to 'accepted')

### 7. Friend Nicknames Migration
Run `supabase_friend_nicknames_migration.sql` (creates `friend_nicknames` table with RLS policies and indexes)

### 8. Privacy Settings Migration
Run `supabase_block_friend_requests_migration.sql` (adds `block_friend_requests`, `lock_photo_downloads`, `hide_location` columns to users table + schema cache reload)

---

## UI Terminology (Korean)

| English | Korean | Context |
|---------|--------|---------|
| Import Photos | 사진 불러오기 | Main import button |
| Select Photo Files | 사진 파일 선택 | File picker |
| Taken Time | 촬영 시간 | Sort by date_taken |
| Upload Time | 업로드 시간 | Sort by created_at |
| Newest / Oldest | 최신순 / 오래된순 | Sort order |
| No Photos | 사진이 없습니다 | Empty state |
| Send Friend Request | 친구 요청 보내기 | Button in sent requests header |
| No Received Requests | 받은 친구 요청이 없습니다 | Empty state |
| No Sent Requests | 보낸 친구 요청이 없습니다 | Empty state |
| Block Friend Requests | 친구 요청 거부 | Account settings toggle |
| Download Lock | 다운로드 잠금 | Account settings toggle (default ON) |
| Hide Location | 위치 정보 숨기기 | Account settings toggle (default ON) |
| Uploader | 업로더 | Friend photo detail modal (was "작성자") |
| Gallery Scan | 갤러리 스캔 | Mobile: auto-scan tab |
| Select from Gallery | 갤러리에서 선택 | Mobile: manual picker tab |

> **"동기화" (sync) is NOT used** in UI. Use "불러오기" (import) or "스캔" (scan) instead.

---

## Mobile App

React Native (Expo SDK 54) companion for native gallery photo import. **Full documentation**: `app/app_description.txt`

**Key differences from web:**
- Two import tabs: "갤러리 스캔" (auto-scan, updates `last_sync_at`) / "갤러리에서 선택" (manual picker, does NOT update `last_sync_at`)
- Uses `modificationTime` for date filtering (catches downloaded images)
- SHA-256 via expo-crypto (requires EAS development build, not Expo Go)
- Custom dark-theme Alert/Toast replacing system `Alert.alert()`
- No registration — users must register on web first

**Dev commands:**
```bash
cd app && npm install --legacy-peer-deps
npx expo start --tunnel
eas build --profile development --platform android
```

---

## Notes
- Photo storage: Supabase Storage, public bucket, 50MB limit
- No default groups — users create their own
- All user-facing strings are in Korean
- State management: plain `state` object, DOM elements in `elements` object
- Date format: `formatDate()` → "YYYY년 M월 D일", `formatDateTime()` → "YYYY-MM-DD HH:mm"
- Friend photo objects include: `authorId`, `author`, `authorAvatar`, `downloadLocked`, `locationHidden`
- Friend sub-tab search bar: real-time filtering by name/ID (+ nickname for friends list), clears on tab switch
- Friend photo detail modal: no delete button, no group section; download button disabled with tooltip if locked; location hidden if owner set hide_location
- Gallery author badge shows friend's profile avatar (falls back to person icon if no avatar)
- Toggle switch component: `.toggle-switch` with `.toggle-slider`, reusable across settings
- Custom tooltip: `[data-tooltip]` attribute, dark theme with white text and arrow
