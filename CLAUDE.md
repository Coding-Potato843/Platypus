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

### 2. Photo Management
- **Sync**: Incremental sync (only new photos since last sync)
- **Gallery**: Responsive grid (2-5 cols), lazy loading, hover effects, pagination (20/page)
- **Detail Modal**: Metadata, group assignment, download, delete
- **Data Model**: `{ id, url, date, location, groupIds[], author? }`

### 3. Groups
- CRUD operations, default groups: Favorites, Travel, Family, Food
- Filter by group, assign photos from detail modal or bulk picker
- **Data Model**: `{ id, name }`

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

### users
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK, same as auth.users.id |
| email | text | UNIQUE, NOT NULL |
| username | text | Display name |
| user_id | text | UNIQUE handle (@username) |
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

**Auto-create user profile trigger:**
```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## File Structure
```
Project_02_Platypus/
├── Frontend/
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── main.js              # App entry, state, event listeners
│   │   └── services/
│   │       ├── api.js           # Supabase client & API
│   │       └── auth.js          # Supabase Auth
│   └── background_image/
│       ├── images.json          # Background image list (edit this to add/remove images)
│       └── *.png                # Background image files
├── supabase_rls_setup.sql       # Table RLS policies
├── supabase_storage_setup.sql   # Storage policies (reference)
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
```

### auth.js
```javascript
initAuth(), login(email, password), register(email, password, username, displayName)
logout(), getCurrentUser(), getCurrentUserProfile(), onAuthStateChange(callback)
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
```

---

## Authentication Flow

### Loading Overlay Management
로그인/새로고침 시 로딩 오버레이가 **한 번만** 연속으로 표시되도록 설계됨.

**핵심 원리:**
- 외부에서 로딩을 시작한 경우 → `showLoadingOverlay = false`로 호출하여 내부 중복 로딩 방지
- `onAuthStateChange` 콜백에서 앱이 이미 표시 중이면 중복 실행 건너뜀

**새로고침 시 흐름:**
```
init() → showLoading('로딩 중...')
       → initAuth() (세션 확인)
       → updateUIForAuthenticatedUser(false) (로딩 오버레이 없이)
       → hideLoading()
       → Toast 표시
```

**로그인 시 흐름:**
```
handleAuthPageLogin() → showLoading('로그인 중...')
                      → login()
                      → updateUIForAuthenticatedUser(false)
                      → hideLoading()
                      → Toast 표시
```

**중복 방지 (onAuthStateChange):**
```javascript
if (elements.appContainer.style.display === 'block') {
    return; // 이미 앱이 표시 중이면 건너뜀
}
```

---

## RLS Policies

### Table Policies (supabase_rls_setup.sql)
- **users**: All can read, only self can create/update
- **photos**: Own photos CRUD, can read friend photos
- **groups**: Own groups only
- **photo_groups**: Own photo-group links only
- **friendships**: Own relationships only

### Storage Policies
- **photos bucket**: Public
- INSERT/DELETE: Authenticated users in own folder only
- SELECT: Public bucket, no policy needed

---

## Implementation Status

### Completed ✅
- Full UI/UX (gallery, modals, slideshow, tabs, dark theme, responsive)
- Supabase integration (Auth, Photos, Groups, Friends, User, Storage)
- RLS policy SQL files
- Profile edit, friend search/add, photo download, pagination

### Pending ⚠️
- Run `supabase_rls_setup.sql` in Supabase SQL Editor
- Enable RLS on all tables (users, photos, groups, photo_groups, friendships)

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
