> **Note**: This file must be written in English only. All documentation should be in English.

# Platypus - Photo Sharing & Organization App

## Overview
Photo sharing web app with device sync, group organization, friend sharing, and slideshow features.

## Tech Stack
- **Frontend**: Vanilla JS (ES6), Custom CSS, Phosphor Icons, Inter font, Korean UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS) - Direct frontend connection (serverless)
- **Hosting**: Render (Static Site, auto-deploy from Git)

---

## Features Summary

### 1. Authentication
- Email/password registration & login with session persistence
- Validation: Email format (duplicate check), Password (8+ chars, lower/number/special char), Username (3-20 chars, Korean/alphanumeric/_)
- Profile: name, username, email, avatar, join date, last sync, stats
- **Account Deletion**: Deletes all user data (photos, groups, friendships) with confirmation modal

### 2. Photo Management
- **Sync**: Incremental sync (only new photos since last sync)
- **Gallery**: Responsive grid (2-5 cols), lazy loading, hover effects, pagination (20/page)
- **Detail Modal**: Metadata, group assignment, download, delete
- **Data Model**: `{ id, url, date, location, groupIds[], author? }`

### 3. Groups
- CRUD operations (no default groups - users create their own)
- Filter by group, assign photos from detail modal or bulk picker
- **Data Model**: `{ id (uuid), name }`

### 4. Search & Filter
- Location (case-insensitive partial match), date range picker

### 5. Social
- Friends tab (friend photos only), friend list management
- Add friend modal with user search, "Friend" badge for existing friends

### 6. Slideshow
- Play/Pause, Prev/Next, keyboard shortcuts (Arrow/Space/Escape)
- Sort modes: Latest, Chronological, Random
- Auto-hide controls (3s), 3s auto-advance

### 7. UI/UX
- 3 tabs: My Photos, Friends, Account
- Dark theme only (cyan primary #06b6d4, slate backgrounds)
- Components: Toast, Loading overlay, Confirm modal, Photo/Sync/Group/Profile/Add Friend modals
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
| last_sync_at | timestamp | Last photo sync |

### photos
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| url | text | Photo URL |
| date_taken | timestamp | Capture date |
| location | text | Location metadata |
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
- `id`, `user_id`, `friend_id`, `created_at`
- UNIQUE constraint on (user_id, friend_id)

**Auto-create user profile trigger** (required for new user registration):
```sql
-- Create trigger function (extracts username from email)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, username, user_id)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1)
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
getPhotos(userId, params), getPhoto(photoId), uploadPhoto(userId, file, metadata)
uploadPhotos(userId, photos), deletePhoto(photoId, userId), updatePhotoGroups(photoId, groupIds)

// Groups
getGroups(userId), createGroup(userId, name), updateGroup(groupId, userId, name), deleteGroup(groupId, userId)

// Friends
getFriends(userId), getFriendsPhotos(userId, params), addFriend(userId, friendId)
removeFriend(userId, friendId), searchUsers(searchTerm)

// User
getUserProfile(userId), updateUserProfile(userId, updates), updateLastSync(userId), getUserStats(userId)
deleteUserAccount(userId)  // Deletes all user data (photos, groups, friendships, user profile)
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

// Photo Sync
openSyncModal()              // Open sync modal
handleFileSelect(event)      // Handle file selection, extract EXIF, filter by date
renderSyncPreview()          // Render photo preview gallery
processReverseGeocoding()    // Convert GPS coordinates to location names (background)
importSelectedPhotos()       // Upload selected photos to Supabase

// Account Deletion
confirmDeleteAccount()   // Show confirmation modal
handleDeleteAccount()    // Execute account deletion
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

### Photo Sync Flow
Mobile-first photo upload workflow:

```
1. User clicks [Sync] button
       ↓
2. User selects photos from device gallery (input[type=file])
       ↓
3. App extracts EXIF data (date, GPS coordinates)
       ↓
4. Filter: only photos newer than last sync date
       ↓
5. Preview with all photos selected (user deselects unwanted)
       ↓
6. Background: Reverse geocoding (GPS → location name)
       ↓
7. User clicks [Import] → Upload to Supabase Storage
       ↓
8. Update last_sync_at timestamp → Refresh gallery
```

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
- **photos**: Own photos CRUD, can read friend photos
- **groups**: Own groups only
- **photo_groups**: Own photo-group links only
- **friendships**: Own relationships only (+ delete as friend_id for account deletion)

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
- Photo sync with EXIF extraction (date, GPS)
- Reverse geocoding (GPS → location name via OpenStreetMap)
- Upload progress indicator
- Last sync time tracking and filtering

### Required Setup
Run these in **Supabase SQL Editor** before using the app:

1. **User profile trigger** (see "Auto-create user profile trigger" above)
   - Creates `public.users` record when user signs up
   - Backfills existing `auth.users` who don't have profiles

2. **RLS policies** - Run `supabase_rls_setup.sql`
   - Enable RLS on all tables (users, photos, groups, photo_groups, friendships)

3. **Account deletion RPC function** (for complete account deletion including auth.users)
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

## Mobile App (Expo)

### Overview
React Native (Expo SDK 54) companion app for native gallery sync.
See `app/app_description.txt` for detailed documentation.

### Key Features
- Login with existing Platypus account (Supabase Auth)
- Native gallery access (expo-media-library)
- Incremental sync (only photos after `last_sync_at`)
- Pre-selected photos (user deselects unwanted)
- Reverse geocoding (GPS → location name)

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
- ✅ Gallery auto-scan (development build)
- ✅ Photo upload to Supabase
- ✅ EXIF extraction (date, GPS)
- ✅ Reverse geocoding (GPS → location name)
- ✅ **Gallery Picker** - Select photos from before last sync date
- ✅ **Date Range Filter** - Year/month direct selection for date filtering
- ✅ **Location Search** - Location name text search
- ❌ Background sync not planned (manual sync only)

### Gallery Picker Feature (NEW)
Feature to manually select photos from the gallery, allowing upload of images from before `last_sync_at`.

**Two Sync Methods:**
1. **Gallery Scan** - Existing method. Auto-scans only photos after `last_sync_at`
2. **Select from Gallery** - Manual selection from entire gallery with date/location filtering

**Components:**
- `GalleryPickerModal.tsx` - Full gallery modal (infinite scroll, filtering)
- `DateRangePicker.tsx` - Year/month direct selection (scroll list + increment/decrement buttons)
- `FilterBar.tsx` - Collapsible filter UI

**Filtering:**
- **Date Range**: Uses MediaLibrary API's `createdAfter`/`createdBefore` options (native level filtering)
- **Location Search**: Client-side text search (partial match)

**Date Picker UI:**
- Year/month scroll lists for direct selection
- "-1 Year", "+1 Year", "-1 Month", "+1 Month" buttons for quick adjustment
- No native modules required (works in Expo Go)
