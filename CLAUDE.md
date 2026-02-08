> **Note**: This file must be written in English only. All documentation should be in English.

---

## Subagents (Task Tool)

**IMPORTANT**: Actively use subagents for complex tasks to improve efficiency and reduce context usage.

### Available Subagents

| Subagent | Purpose | When to Use |
|----------|---------|-------------|
| `Explore` | Codebase exploration | Finding files, understanding structure, searching for keywords |
| `Plan` | Implementation planning | Designing architecture, planning multi-step implementations |
| `code-finder` | Locate specific code | Finding where features/functions/logic are implemented |
| `code-reviewer` | Code review | Analyzing readability, performance, security issues |
| `error-extractor` | Extract error details | Parsing stack traces, extracting technical facts from logs |
| `claude-code-guide` | Claude Code help | Questions about Claude Code features, hooks, settings |

### Usage Guidelines

1. **Codebase Exploration**: Use `Explore` agent instead of multiple Glob/Grep calls
   - Example: "Where is authentication handled?" → Use Explore agent

2. **Code Location**: Use `code-finder` for specific feature searches
   - Example: "Find the duplicate detection logic" → Use code-finder agent

3. **Code Review**: Use `code-reviewer` before committing significant changes

4. **Error Analysis**: Use `error-extractor` for complex error logs

5. **Parallel Execution**: Launch multiple agents simultaneously for independent tasks

---

# Platypus - Photo Sharing & Organization App

## Overview
Photo sharing web app with photo import, group organization, friend sharing, and slideshow features.

## Tech Stack
- **Frontend**: Vanilla JS (ES6), Custom CSS, Phosphor Icons, Inter font, Korean UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS) - Direct frontend connection (serverless)
- **Hosting**: Render (Static Site, auto-deploy from Git)

---

## Features Summary

### 1. Authentication
- Email/password registration & login with session persistence
- Validation: Email format (duplicate check), Password (8+ chars, lower/number/special char), Username (3-20 chars, Korean/alphanumeric/_)
- Profile: name, username, email, avatar, join date, last scan date, stats
- **Account Deletion**: Deletes all user data (photos, groups, friendships) with confirmation modal

### 2. Photo Management
- **Import**: Incremental import (only new photos since last scan)
- **Gallery**: Responsive grid (2-5 cols), lazy loading, hover effects, pagination (20/page)
- **Sorting**: Two dropdown selectors for sort field and order
  - Sort Field: 촬영 시간 (`date_taken`) / 업로드 시간 (`created_at`)
  - Sort Order: 최신순 (`desc`) / 오래된순 (`asc`)
- **Detail Modal**: Metadata (taken date, upload date, location), group assignment, download, delete
- **Data Model**: `{ id, url, date, created_at, location, groupIds[], author? }`

### 3. Groups
- CRUD operations (no default groups - users create their own)
- Filter by group, assign photos from detail modal or bulk picker
- **Data Model**: `{ id (uuid), name }`

### 4. Search & Filter
- Location (case-insensitive partial match), date range picker

### 5. Social (Friend Request System)
- **Friend Request Flow**: Send request → receiver accepts/rejects → mutual friendship established
- Friends tab (friend photos only from accepted friendships)
- Add friend modal with user search, shows 4 states: 추가/요청됨/수락/친구
- Account tab layout (top to bottom): Profile Card → Logout/Delete buttons → Friends List → Received Requests → Sent Requests
- "받은 친구 요청" (accept/reject) and "보낸 친구 요청" (cancel) always visible below Friends List (show empty state message when no requests)
- "친구 요청 보내기" button in Sent Requests section header (same as Friends tab add friend button)
- Badge notification on Account tab for pending received requests
- Realtime updates for both sender and receiver of friend requests

### 6. Slideshow
- Play/Pause, Prev/Next, keyboard shortcuts (Arrow/Space/Escape)
- Sort modes: Latest, Chronological, Random
- Auto-hide controls (3s), 3s auto-advance

### 7. UI/UX
- 3 tabs: My Photos, Friends, Account
- Dark theme only (cyan primary #06b6d4, slate backgrounds)
- Components: Toast, Loading overlay, Confirm modal, Photo/Import/Group/Profile/Add Friend modals
- Random background image on login/signup page (configurable via `Frontend/background_image/images.json`)

---

## Database Schema (5 Tables)

> **Important**: Supabase uses two separate user tables:
> - `auth.users` - Managed by Supabase Auth (email, password, login)
> - `public.users` - App profile data (username, avatar, etc.)
>
> Login uses `auth.users`, but app features (groups, photos) reference `public.users.id` via foreign keys.

### users
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK, same as auth.users.id |
| email | text | UNIQUE, NOT NULL |
| username | text | NOT NULL, Display name |
| user_id | text | NOT NULL, UNIQUE handle (@username) |
| avatar_url | text | Profile image URL |
| created_at | timestamp | Join date |
| last_sync_at | timestamp | Last scan date |

### photos
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| url | text | Photo URL |
| date_taken | timestamp | Capture date |
| location | text | Location metadata |
| file_hash | text | SHA-256 hash for duplicate detection |
| created_at | timestamp | Upload date |

### groups
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| name | text | Group name |
| created_at | timestamp | Creation date |

### photo_groups (Junction)
- `photo_id` + `group_id` = Composite PK (N:M relationship)

### friendships
- `id`, `user_id` (requester), `friend_id` (receiver), `status` ('pending'|'accepted'), `created_at`
- UNIQUE constraint on (user_id, friend_id)
- Trigger prevents reverse-direction duplicates (if A→B exists, B→A insert is blocked)
- `status='pending'`: request sent, awaiting acceptance
- `status='accepted'`: mutual friendship established

**Auto-create user profile trigger** (required for new user registration):
```sql
-- Create trigger function (uses raw_user_meta_data for username, falls back to email prefix)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, username, user_id)
  values (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing auth users who don't have a public.users record
insert into public.users (id, email, username, user_id)
select id, email, split_part(email, '@', 1), split_part(email, '@', 1)
from auth.users
where id not in (select id from public.users);
```

---

## File Structure
```
Project_02_Platypus/
├── Frontend/                    # Web frontend (Vanilla JS)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── main.js              # App entry, state, event listeners
│   │   ├── services/
│   │   │   ├── api.js           # Supabase client & API
│   │   │   └── auth.js          # Supabase Auth
│   │   └── utils/
│   │       └── exif.js          # EXIF parser & reverse geocoding
│   └── background_image/
│       ├── images.json          # Background image list
│       └── *.png                # Background image files
├── app/                         # Mobile app (React Native + Expo)
│   ├── package.json             # Dependencies (Expo SDK 54)
│   ├── app.json                 # Expo config
│   ├── App.tsx                  # Entry point
│   ├── app_description.txt      # Mobile app documentation
│   └── src/                     # Source code (screens, services, components)
├── supabase_rls_setup.sql       # Table RLS policies
├── supabase_storage_setup.sql   # Storage policies (reference)
├── .gitignore                   # Excludes node_modules, .expo, dist
└── CLAUDE.md
```

---

## Supabase Config
```javascript
const SUPABASE_URL = 'https://vtpgatnkobvjqwvoqtad.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cGdhdG5rb2J2anF3dm9xdGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NzQxNzIsImV4cCI6MjA4NTM1MDE3Mn0.Tc_lFbbkBrUusy2fI4XpNwxTXTGI2qfksU82y6AFyAQ';
```
> **Security**: `anon key` is safe to expose publicly. RLS protects data. Keep `service_role key` secret.

**Dashboard**: https://supabase.com/dashboard/project/vtpgatnkobvjqwvoqtad

---

## Render Deployment
| Setting | Value |
|---------|-------|
| Type | Static Site |
| Branch | main |
| Build Command | (empty) |
| Publish Directory | `Frontend` |

Auto-deploys on push to main branch.

---

## API Reference

### api.js
```javascript
// Photos
getPhotos(userId, params)  // params: { sortField, sortOrder, limit, offset, location, startDate, endDate }
getPhoto(photoId), uploadPhoto(userId, file, metadata)
uploadPhotos(userId, photos), deletePhoto(photoId, userId), updatePhotoGroups(photoId, groupIds)

// Groups
getGroups(userId), createGroup(userId, name), updateGroup(groupId, userId, name), deleteGroup(groupId, userId)

// Friends (Bidirectional Friend Request System)
getFriends(userId), getFriendsPhotos(userId, params)  // Both query accepted friendships in BOTH directions
sendFriendRequest(userId, friendId)                     // Creates pending friendship (replaces addFriend)
acceptFriendRequest(userId, friendshipId)               // Receiver accepts → status='accepted'
rejectFriendRequest(userId, friendshipId)               // Receiver rejects → row deleted
cancelFriendRequest(userId, friendshipId)               // Sender cancels → row deleted
getPendingRequests(userId)                              // Returns { received: [...], sent: [...] }
getFriendshipStatuses(userId, otherUserIds)             // Batch status check for search results
removeFriend(userId, friendId), searchUsers(searchTerm)

// User
getUserProfile(userId), updateUserProfile(userId, updates), updateLastSync(userId), getUserStats(userId)
deleteUserAccount(userId)  // Deletes all user data (photos, groups, friendships, user profile)

// Realtime Subscriptions
subscribeToRealtimeChanges(userId, callbacks)  // Subscribe to photos, groups, friendships changes
subscribeToFriendPhotos(friendIds, callback)   // Subscribe to friends' new photo uploads
unsubscribeFromRealtime()                       // Cleanup all subscriptions (call on logout)
```

### auth.js
```javascript
initAuth(), login(email, password), register(email, password, username, displayName)
logout(), deleteAccount(), getCurrentUser(), getCurrentUserProfile(), onAuthStateChange(callback)
validateEmail(email), validatePassword(password), validateUsername(username)
```

### main.js (Key Functions)
```javascript
// Data Loading
loadAllUserData(showLoadingOverlay = true)  // Load photos, groups, friends data
loadPhotos(loadMore = false)                 // Load user's photos with pagination
loadFriendPhotos(loadMore = false)           // Load friends' photos with pagination

// UI State
updateUIForAuthenticatedUser(showLoadingOverlay = true)  // Setup UI after login
updateUIForUnauthenticatedUser()                          // Reset UI after logout

// Photo Import
openSyncModal()              // Open photo import modal
handleFileSelect(event)      // Handle file selection, extract EXIF data
renderSyncPreview()          // Render photo preview gallery
processReverseGeocoding()    // Convert GPS coordinates to location names (background)
importSelectedPhotos()       // Upload selected photos to Supabase (does NOT update last_sync_at)

// Photo Detail Modal
openPhotoModal(photoId)      // Open photo detail modal with taken date, upload date, location

// Account Deletion
confirmDeleteAccount()   // Show confirmation modal
handleDeleteAccount()    // Execute account deletion

// Sorting
handleSortFieldChange(field)  // Change sort field (date_taken/created_at)
handleSortOrderChange(order)  // Change sort order (asc/desc)

// Utility Functions
formatDate(dateString)        // Format date as "YYYY년 M월 D일" (Korean locale)
formatDateTime(dateString)    // Format datetime as "YYYY-MM-DD HH:mm" (exact time)

// Friend Requests
loadPendingRequests()              // Load received + sent pending requests
renderReceivedRequests()           // Render received requests with accept/reject buttons (always visible, shows empty message)
renderSentRequests()               // Render sent requests with cancel button (always visible, shows empty message)
handleAcceptRequest(friendshipId)  // Accept a received friend request
handleRejectRequest(friendshipId)  // Reject a received friend request
handleCancelRequest(friendshipId)  // Cancel a sent friend request
updateRequestBadges()              // Update badge count on Account tab

// Realtime (auto-called, no manual invocation needed)
setupRealtimeSubscriptions()       // Setup live DB sync (called after login), listens BOTH directions for friendships
setupFriendPhotosSubscription()    // Subscribe to friends' uploads
cleanupRealtimeSubscriptions()     // Cleanup on logout
```

### utils/exif.js
```javascript
extractExifData(file)                    // Extract date and GPS from image EXIF
reverseGeocode(latitude, longitude)      // Convert GPS to location name (OpenStreetMap Nominatim)
batchReverseGeocode(coordinates)         // Batch geocoding with rate limiting
getFileDate(file)                        // Get file's lastModified date as fallback
```

---

## Authentication Flow

### Loading Overlay Management
Designed so that the loading overlay is displayed **only once** consecutively during login/refresh.

**Core Principle:**
- When loading is started externally → call with `showLoadingOverlay = false` to prevent duplicate loading internally
- In `onAuthStateChange` callback, skip if app is already displayed

**On Page Refresh:**
```
init() → showLoading('Loading...')
       → initAuth() (check session)
       → updateUIForAuthenticatedUser(false) (without loading overlay)
       → hideLoading()
       → Show Toast
```

**On Login:**
```
handleAuthPageLogin() → showLoading('Logging in...')
                      → login()
                      → updateUIForAuthenticatedUser(false)
                      → hideLoading()
                      → Show Toast
```

**Duplicate Prevention (onAuthStateChange):**
```javascript
if (elements.appContainer.style.display === 'block') {
    return; // Skip if app is already displayed
}
```

### Photo Import Flow
Mobile-first photo upload workflow:

```
1. User clicks [사진 불러오기 (Import Photos)] button
       ↓
2. User selects photos from device gallery (input[type=file])
       ↓
3. App extracts EXIF data (date, GPS coordinates)
       ↓
4. Preview with all photos selected (user deselects unwanted)
       ↓
5. Background: Reverse geocoding (GPS → location name)
       ↓
6. User clicks [Import] → Hash-based duplicate check → Upload to Supabase Storage
       ↓
7. Refresh gallery (last_sync_at is NOT updated - only mobile app updates it)
```

**Note:** Web import does NOT update `last_sync_at`. Only mobile app gallery scan updates the last scan timestamp. Client-side date filtering was removed. Duplicate detection is now handled server-side via SHA-256 file hash comparison. This allows re-uploading previously deleted photos without browser refresh.

**EXIF Extraction:**
- Date: `DateTimeOriginal` > `DateTime` > file's `lastModified`
- Location: GPS coordinates extracted, then converted via Nominatim API

**Reverse Geocoding (OpenStreetMap Nominatim):**
- Free API, no key required
- Rate limited: 1 request/second
- Returns city/district level (e.g., "서울특별시, 강남구")
- Results cached to reduce API calls

**Browser Limitation:**
Web browsers cannot automatically access device gallery. Users must manually select files.
This is a security restriction in all browsers - only native apps can scan gallery automatically.

### Account Deletion Flow
Deletion sequence when clicking "Delete Account" button in Account tab:

```
confirmDeleteAccount() → handleDeleteAccount() → deleteAccount() (auth.js)
                                                → deleteUserAccount(userId) (api.js)
```

**Deletion Order (api.js - deleteUserAccount):**
1. Delete photo files from Storage
2. Delete photo_groups table (junction table)
3. Delete photos table
4. Delete groups table
5. Delete friendships table (both user_id and friend_id)
6. Delete public.users table
7. Delete auth.users (RPC function: `delete_user_auth()`)
8. Sign out

**Required RLS Policies:**
- `Users can delete own profile` (public.users)
- `Users can delete friendships as friend` (friendships - delete relationships where registered as friend_id)

---

## RLS Policies

### Table Policies (supabase_rls_setup.sql)
- **users**: All can read, only self can create/update/delete
- **photos**: Own photos CRUD, can read friend photos (accepted friendships only, bidirectional)
- **groups**: Own groups only
- **photo_groups**: Own photo-group links only
- **friendships**: SELECT both directions (user_id OR friend_id), INSERT as sender only, UPDATE as receiver only (accept), DELETE as sender or receiver

### Storage Policies
- **photos bucket**: Public
- INSERT/DELETE: Authenticated users in own folder only
- SELECT: Public bucket, no policy needed

---

## Implementation Status

### Completed
- Full UI/UX (gallery, modals, slideshow, tabs, dark theme, responsive)
- Supabase integration (Auth, Photos, Groups, Friends, User, Storage)
- RLS policy SQL files
- Profile edit, friend search/add, photo download, pagination
- Group filtering fix (dynamic DOM query for group chips)
- Account deletion - complete data removal including auth.users via RPC
- Photo import with EXIF extraction (date, GPS)
- Reverse geocoding (GPS → location name via OpenStreetMap)
- Upload progress indicator
- Last scan date tracking and filtering
- **Duplicate detection** - SHA-256 hash-based duplicate photo prevention (web & mobile)
- **Gallery sorting** - Sort by date_taken or created_at, ascending or descending (two dropdowns)
- **Korean datetime display** - Last scan date shows Korean format `YYYY년 M월 D일 오전/오후 H:MM` (e.g., "2024년 1월 20일 오후 2:30")
- **Photo re-upload fix** - Removed client-side date filtering; deleted photos can be re-uploaded without browser refresh
- **Upload date in detail modal** - Photo detail modal shows upload date (`created_at`) in "YYYY년 M월 D일" format below taken date
- **last_sync_at mobile-only** - Web photo import no longer updates `last_sync_at`; only mobile app gallery scan updates the last scan timestamp
- **Timezone handling fix** - Web date functions properly handle Supabase timestamps with/without timezone info (Z, +00:00, etc.)
- **Friends tab empty state** - Different empty message for Friends tab vs My Photos tab
- **Add Friend button moved** - Relocated from Account tab to Friends tab header for better UX
- **Supabase Realtime** - Live database sync without browser refresh (photos, groups, friendships auto-update)
- **Friend Request System** - Bidirectional friend requests with accept/reject/cancel; pending requests in Account tab; badge notifications; search shows request status
- **Account tab layout redesign** - Reordered: Profile Card → Logout/Delete → Friends List → Received Requests → Sent Requests. Request sections always visible with empty state messages. "친구 요청 보내기" button added to Sent Requests header.

### Required Setup
Run these in **Supabase SQL Editor** before using the app:

1. **User profile trigger** (see "Auto-create user profile trigger" above)
   - Creates `public.users` record when user signs up
   - Backfills existing `auth.users` who don't have profiles

2. **RLS policies** - Run `supabase_rls_setup.sql`
   - Enable RLS on all tables (users, photos, groups, photo_groups, friendships)

3. **Duplicate detection setup** (for hash-based duplicate photo prevention)
   ```sql
   -- Add file_hash column to photos table
   ALTER TABLE photos ADD COLUMN IF NOT EXISTS file_hash TEXT;

   -- Create index for fast duplicate lookup
   CREATE INDEX IF NOT EXISTS idx_photos_file_hash ON photos(user_id, file_hash);
   ```

4. **Account deletion RPC function** (for complete account deletion including auth.users)
   ```sql
   -- Drop if exists
   DROP FUNCTION IF EXISTS public.delete_user_auth();

   -- Create function to delete from auth.users
   CREATE OR REPLACE FUNCTION public.delete_user_auth()
   RETURNS void
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = auth, public
   AS $$
   BEGIN
     -- Delete the current user from auth.users
     -- Supabase handles cascading to related auth tables automatically
     DELETE FROM auth.users WHERE id = auth.uid();
   END;
   $$;

   -- Grant execute permission to authenticated users
   GRANT EXECUTE ON FUNCTION public.delete_user_auth() TO authenticated;
   ```

5. **Realtime setup** (for live database sync without browser refresh)
   - Go to **Supabase Dashboard** → **Database** → **Replication**
   - Enable Realtime for these tables:
     - `photos` ✅
     - `friendships` ✅
     - `groups` ✅
     - `photo_groups` ✅
   - Click **Save**

6. **Friend request system migration** (for bidirectional friend requests)
   - Run `supabase_friend_request_migration.sql` in Supabase SQL Editor
   - This adds `status` column to friendships, updates RLS policies, and creates duplicate prevention trigger
   - Existing friendships are auto-migrated to `status='accepted'`

---

## Auth Background Images

Login/signup page displays a random background image from `Frontend/background_image/` folder.

### How to Add/Remove Images
1. Add or remove image files in `Frontend/background_image/` folder
2. Edit `Frontend/background_image/images.json` to update the image list:
```json
{
  "images": [
    "000_nature.png",
    "001_city_night.png",
    "002_ruin.png"
  ]
}
```

### Implementation Details
- **CSS** (`styles.css`): `.auth-page` has `background-size: cover` with dark overlay (`::before` pseudo-element, 70% opacity)
- **JS** (`main.js`): `setRandomAuthBackground()` fetches `images.json` and randomly selects one image on page load

---

## Notes
- Photo storage: Supabase Storage (Public bucket, 50MB limit)
- RLS must be enabled for data security
- Email confirmation may be required (depends on Supabase settings)
- Groups use UUID as id (not string) - all group IDs from database are UUIDs
- No default groups are created automatically - users create their own groups

---

## UI Terminology (Korean)

The app uses Korean UI text. Key terminology:

| English | Korean (UI) | Notes |
|---------|-------------|-------|
| Import Photos | 사진 불러오기 | Main button to import photos |
| Select Photo Files | 사진 파일 선택 | File picker button |
| Last Scan | 마지막 스캔 | Korean datetime format: `YYYY년 M월 D일 오전/오후 H:MM` (e.g., "2024년 1월 20일 오후 2:30") |
| Gallery Scan | 갤러리 스캔 | Auto-scan photos after last scan date |
| Select from Gallery | 갤러리에서 선택 | Manual photo picker |
| Scan Complete | 스캔 완료 | Alert title after scanning |
| Photo Management App | 사진 관리 앱 | App subtitle on login screen |
| Permission Required | 갤러리 접근 권한 필요 | Permission modal title |
| Go to Settings | 설정으로 이동 | Permission modal button |
| I Understand | 알겠습니다 | Permission modal dismiss button |
| Sort | 정렬 | Sort dropdown label |
| Taken Time | 촬영 시간 | Sort by date_taken (photo capture/download time) |
| Upload Time | 업로드 시간 | Sort by created_at (upload timestamp) |
| Upload | 업로드 | Upload date in photo detail modal (format: "YYYY년 M월 D일") |
| Newest First | 최신순 | Descending order |
| Oldest First | 오래된순 | Ascending order |
| No Photos (My Photos) | 사진이 없습니다 | Empty state title |
| No Photos hint (My Photos) | 불러오기 버튼을 눌러 사진을 추가하거나 필터를 조정해보세요. | Empty state description for My Photos tab |
| No Photos hint (Friends) | 친구를 추가하거나<br>친구가 사진을 업로드할 때까지 기다려주세요. | Empty state description for Friends tab |
| No Received Requests | 받은 친구 요청이 없습니다 | Empty state for received requests section |
| No Sent Requests | 보낸 친구 요청이 없습니다 | Empty state for sent requests section |
| Send Friend Request | 친구 요청 보내기 | Button in sent requests section header |

**Note**: The word "동기화" (sync) is NOT used in the UI. Use "불러오기" (import/load) or "스캔" (scan) instead.

### Permission Modal (Mobile App)

Permission request modal that guides users to grant gallery access. Only shown when permission is denied after system dialog.

**UI Components:**
- Title: "갤러리 접근 권한 필요"
- Description: Explains why permission is needed
- Step-by-step guide box: "1. 권한 → 2. 사진 및 동영상 → 3. 허용"
- "설정으로 이동" button (primary, cyan) - Opens app settings via `Linking.openSettings()`
- "알겠습니다" button (secondary, gray text) - Closes modal
- Privacy note at bottom

**Permission Request Flow:**
1. User taps "갤러리 스캔" or "갤러리에서 선택" button
2. If permission not granted → System permission dialog appears first
3. If user grants permission → Proceed with gallery operation
4. If user denies permission → Show custom PermissionModal with settings guide
5. User can tap "설정으로 이동" to open app settings and grant permission manually
6. AppState listener re-checks permission when app returns to foreground

**Key Points:**
- No automatic modal on app launch (simpler UX)
- System permission dialog is shown first (standard Android/iOS behavior)
- Custom modal only appears after user denies system dialog (provides settings guidance)
- No AsyncStorage flags needed (stateless approach)

---

## Mobile App (Expo)

### Overview
React Native (Expo SDK 54) companion app for native gallery photo import.
See `app/app_description.txt` for detailed documentation.

### Key Features
- Login with existing Platypus account (Supabase Auth)
- Native gallery access (expo-media-library)
- **Tab-based UI** with two separate import modes:
  - **Gallery Scan Tab**: Auto-scan photos after last scan date, updates `last_sync_at` on upload
  - **Select from Gallery Tab**: Manual selection from entire gallery, does NOT update `last_sync_at`
- Pre-selected photos in scan mode (user deselects unwanted)
- Reverse geocoding (GPS → location name)
- **Last Sync Date Editor**: "수정" button to manually edit scan date (past to current time)

### Development Commands
```bash
cd app
npm install --legacy-peer-deps   # Install dependencies
npx expo start --tunnel          # Development server (QR code)
eas build --profile development --platform android  # Build dev APK
```

### EAS Build (Development APK)
Expo Go has limitations with media library access. Use EAS Build for full functionality:
```bash
npm install -g eas-cli           # Install EAS CLI
eas login                        # Login to Expo account
eas build:configure              # First-time setup
eas build --profile development --platform android  # Build APK
```
APK is downloaded from Expo dashboard after build completes.

### Known Issues (Windows)
- **node:sea error**: Expo SDK 50 had Windows path issues. Resolved by upgrading to SDK 54.
- **Port conflicts**: Kill all `node.exe` processes before restarting Expo.
- **Dependency conflicts**: Use `--legacy-peer-deps` flag when installing.
- **React Native version mismatch**: Expo Go requires matching React Native version. SDK 54 uses RN 0.81.5.
- **expo-file-system deprecated API**: Use `expo-file-system/legacy` for `readAsStringAsync`.

### Tech Stack
- Expo SDK 54.0.33
- React 19.1.0 + React Native 0.81.5
- TypeScript
- React Navigation v7
- SafeAreaProvider for proper layout
- EAS Build for development APK
- Same Supabase backend as web

### Android Permissions (app.json)
```json
"permissions": [
  "READ_EXTERNAL_STORAGE",
  "READ_MEDIA_IMAGES",
  "ACCESS_MEDIA_LOCATION",  // Required for GPS EXIF data
  ...
]
```
`isAccessMediaLocationEnabled: true` in expo-media-library plugin config.

### Current Status
- ✅ Login/Logout working
- ✅ Auth state persistence (AsyncStorage)
- ✅ **Permission Request Modal** - First-launch only (persisted via AsyncStorage)
- ✅ Gallery auto-scan (development build)
- ✅ Photo upload to Supabase
- ✅ EXIF extraction (date, GPS)
- ✅ Reverse geocoding (GPS → location name)
- ✅ **Tab-based UI** - Separate tabs for "Gallery Scan" and "Select from Gallery"
- ✅ **Gallery Picker** - Select photos from before last sync date
- ✅ **Date Range Filter** - Year/month direct selection for date filtering
- ✅ **Location Search** - Location name text search
- ✅ **All Albums Scan** - Includes Downloads, Telegram, WhatsApp, KakaoTalk folders
- ✅ **Downloaded Image Support** - Uses modificationTime for proper date handling
- ✅ **Duplicate Detection** - SHA-256 hash-based duplicate prevention (requires development build for expo-crypto)
- ✅ **GPS Location Fix** - Uses `assetInfo.location` (standard format) with EXIF fallback
- ✅ **Selective last_sync_at Update** - Only "Gallery Scan" tab updates last scan date; "Select from Gallery" does not
- ✅ **Custom Alert/Toast UI** - Dark theme custom alert modals and toast notifications (replaces system Alert.alert)
- ✅ **Last Sync Date Editor** - "수정" button to manually edit scan date (past to current time only)
- ❌ Background upload not planned (manual import only)

### Tab-Based Import UI

The mobile app uses a tab-based UI to clearly separate two import methods, each with independent photo lists and different behaviors.

**Tab UI Design:**
- Two tabs at the top: "갤러리 스캔" (Gallery Scan) / "갤러리에서 선택" (Select from Gallery)
- Active tab highlighted with cyan background
- Each tab maintains its own independent photo list
- Switching tabs preserves photos in each list

**Tab 1: Gallery Scan (갤러리 스캔)**
- Shows "마지막 스캔 날짜" (Last Scan Date) info box with "수정" (Edit) button for manual editing
- Date format: `YY년 M월 D일 오전/오후 H:MM` (e.g., "25년 1월 20일 오후 2:30")
- Auto-scans photos after last scan date using `modificationTime`
- Photos are PRE-SELECTED by default (user deselects unwanted)
- On upload: Updates `last_sync_at` to current time
- Button: "갤러리 스캔" / "다시 스캔" (Rescan)

**Tab 2: Select from Gallery (갤러리에서 선택)**
- Does NOT show last scan date (hidden intentionally)
- Opens GalleryPickerModal for manual photo selection
- Photos are NOT pre-selected (user selects wanted)
- On upload: Does NOT update `last_sync_at`
- Allows selecting photos from any date (before or after last scan)
- Button: "갤러리에서 선택" / "추가 선택" (Add More)

**Key Behavior Differences:**

| Feature | Gallery Scan Tab | Select from Gallery Tab |
|---------|-----------------|------------------------|
| Last scan date display | Shown | Hidden |
| Photo pre-selection | All selected | None selected |
| Date filtering | After last scan only | No restriction |
| Updates last_sync_at | ✅ Yes | ❌ No |

**Components:**
- `SyncScreen.tsx` - Main screen with tab UI and independent photo lists (`scanPhotos`, `pickerPhotos`)
- `GalleryPickerModal.tsx` - Full gallery modal (infinite scroll, filtering)
- `DateRangePicker.tsx` - Year/month direct selection (scroll list only)
- `FilterBar.tsx` - Collapsible filter UI (no icon)

**Filtering (in Gallery Picker Modal):**
- **Date Range**: Uses MediaLibrary API's `createdAfter`/`createdBefore` options (native level filtering)
- **Location Search**: Client-side text search (partial match)

**Date Picker UI:**
- Year/month scroll lists for direct selection
- Cancel button (red, left) / Confirm button (sky blue, right) at bottom
- No native modules required (works in Expo Go)

### Custom Alert & Toast (Mobile App)

Custom UI components that replace React Native's default `Alert.alert()` to match the app's dark theme.

**Why Custom Alert:**
- React Native's default Alert uses system styling (white background, black text)
- Does not match the app's dark theme (slate backgrounds, cyan accents)
- Custom components provide consistent visual experience

**Components (CustomAlert.tsx):**

| Component | Purpose | Auto-dismiss |
|-----------|---------|--------------|
| `CustomAlert` | Confirmation dialogs, error messages | No (requires button tap) |
| `Toast` | Success notifications (upload complete) | Yes (2.5 seconds) |

**CustomAlert Features:**
- Dark theme styling (`#1e293b` background, `#f1f5f9` text)
- Button styles: default (cyan), cancel (gray), destructive (red)
- Button order: action button on top, cancel button at bottom
- Fade animation on open/close

**Toast Features:**
- Appears at bottom of screen
- Auto-dismisses after 2.5 seconds
- Slide-up animation with fade
- Cyan border with checkmark icon
- Used for upload success messages

**Usage (Hooks):**
```typescript
// CustomAlert
const { showAlert, AlertComponent } = useCustomAlert();
showAlert('Title', 'Message', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'Confirm', onPress: handleConfirm },
]);

// Toast
const { showToast, ToastComponent } = useToast();
showToast('3장 업로드 완료');

// In JSX (must render components)
<AlertComponent />
<ToastComponent />
```

**Button Order in Dialogs:**
- Action button (Upload, Logout, OK) → **Top**
- Cancel button → **Bottom**

**Where Used:**
- `SyncScreen.tsx` - Upload confirmation, scan complete, errors, logout
- `LoginScreen.tsx` - Login errors, validation messages

### All Albums Scanning
Both auto-scan and gallery picker scan ALL albums including special folders:
- Downloads / 다운로드
- Telegram
- WhatsApp
- KakaoTalk

**Technical Details:**
- Uses `modificationTime` instead of `creationTime` for filtering
- Camera photos: modificationTime ≈ creationTime
- Downloaded images: modificationTime = download time
- Deduplicates photos across albums using Map

### Upload Date Handling
Date priority when uploading photos:
1. **EXIF DateTimeOriginal** - Camera photo capture time
2. **modificationTime** - Download/add time (for downloaded images)
3. **creationTime** - File creation time
4. **Current time** - Fallback if all timestamps invalid

This fixes the "1970-01-01" bug for downloaded images that lack EXIF data.

### GPS Location Extraction
expo-media-library returns GPS coordinates in two formats. The app checks both:

1. **Primary**: `assetInfo.location.latitude` / `assetInfo.location.longitude` (expo-media-library standard format)
2. **Fallback**: `assetInfo.exif.GPSLatitude` / `assetInfo.exif.GPSLongitude` (raw EXIF data)

This ensures location data is properly extracted and saved to the database for reverse geocoding.

### Duplicate Detection

SHA-256 hash-based duplicate photo prevention implemented on both web and mobile.

**How It Works:**
1. **Hash Calculation**: Before upload, calculate SHA-256 hash of each photo file
2. **Batch Query**: Send all hashes to database in a single query to check for existing photos
3. **Duplicate Filtering**: Skip photos whose hashes already exist in the database
4. **Upload with Hash**: Upload new photos with their hash stored in `file_hash` column

**Implementation:**

| Platform | Hash Library | Notes |
|----------|-------------|-------|
| Web | Web Crypto API (`crypto.subtle`) | Native browser API, fast |
| Mobile | expo-crypto | Requires development build (not available in Expo Go) |

**API Functions:**
```javascript
// Web (api.js)
calculateFileHash(file)              // Returns SHA-256 hex string
checkDuplicateHashes(userId, hashes) // Returns Set of existing hashes
uploadPhotos(userId, photos, onProgress) // Handles duplicate detection automatically

// Mobile (photos.ts)
calculateFileHash(uri)               // Returns SHA-256 hex string
checkDuplicateHashes(userId, hashes) // Returns Set of existing hashes
uploadPhotos(userId, photos, onProgress) // Handles duplicate detection automatically
```

**Progress Callback:**
```javascript
onProgress(current, total, status)
// status: 'hashing' | 'uploading'
```

**UI Feedback:**
- During hash calculation: "중복 검사 중... X/Y"
- During upload: "업로드 중... X/Y"
- Result: "3개 업로드 완료, 2개 중복 제외" or "모든 사진이 이미 업로드되어 있습니다"

**Database Requirement:**
```sql
-- Add file_hash column
ALTER TABLE photos ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create index for fast lookup (user_id + file_hash composite)
CREATE INDEX IF NOT EXISTS idx_photos_file_hash ON photos(user_id, file_hash);
```

**Performance:**
- Hash calculation: ~100-200ms per 5MB photo
- Batch query: ~50-100ms for 100 hashes (with index)
- Total overhead for 100 photos: ~2-3 seconds for hashing + <100ms for duplicate check
