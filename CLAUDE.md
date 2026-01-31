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
- Validation: Email format, Password (8+ chars, lower/number/special char), Username (3-20 chars, alphanumeric/_)
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
│   └── js/
│       ├── main.js              # App entry, state, event listeners
│       └── services/
│           ├── api.js           # Supabase client & API
│           └── auth.js          # Supabase Auth
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

## Notes
- Photo storage: Supabase Storage (Public bucket, 50MB limit)
- RLS must be enabled for data security
- Email confirmation may be required (depends on Supabase settings)
- Mock data available as fallback when API fails
