# Platypus - Photo Sharing & Organization App

## Project Overview

Platypus is a photo sharing and organization web application that allows users to sync photos from their devices, organize them into groups, and share with friends. The app features a modern, responsive UI with slideshow capabilities.

## Tech Stack

### Frontend
- **Framework**: Vanilla JavaScript (ES6 Modules)
- **Styling**: Custom CSS with CSS Variables
- **Icons**: Phosphor Icons
- **Font**: Inter (Google Fonts)
- **Language**: Korean (한국어) UI

> Note: The original plan was React + Chakra UI, but the implementation uses vanilla JavaScript for simplicity and performance.

### Backend & Infrastructure
- **Database**: Supabase (Free Plan)
  - PostgreSQL database
  - Real-time subscriptions
  - Row Level Security (RLS) for data protection
  - Built-in authentication
- **Server/Hosting**: Render
  - Free tier available
  - Auto-deploy from Git
  - SSL certificates included

---

## Features

### 1. Authentication & User Management

#### 1.1 User Registration
- Email/password registration
- Username selection with unique ID (@username format)
- Avatar selection/upload
- **Validation Rules**:
  - Email: Valid email format required
  - Password: Min 8 chars, must include uppercase, lowercase, and number
  - Username: 3-20 chars, alphanumeric and underscore only

#### 1.2 User Login
- Email/password login
- Session persistence (localStorage)
- Refresh token support
- Logout functionality

#### 1.3 User Profile (Account Tab)
- Display user info: name, username, email, avatar
- Show join date
- **Show last sync time** (when photos were last synced)
- Display stats: photo count, friend count, storage used
- Edit profile functionality

---

### 2. Photo Management

#### 2.1 Photo Sync
- Sync button to import photos from device
- **Incremental sync**: Only fetches photos added/taken after the last sync time (not all photos)
- First sync: Fetches all photos (or from a default past date)
- Subsequent syncs: Only fetches new photos since last sync
- Sync modal displays candidate photos for selection
- Select/deselect individual photos to import
- Bulk import selected photos
- Track and update last sync time after each sync

#### 2.2 Photo Gallery
- Grid layout display (responsive: 2-5 columns based on screen size)
- Lazy loading for images
- Hover effects with overlay
- Show location badge on hover
- Show author badge for friend's photos
- Group indicator icon for categorized photos

#### 2.3 Photo Detail Modal
- Full-size image view
- Display metadata:
  - Photo ID
  - Date taken (formatted)
  - Location
  - Author (for friend's photos)
- Manage group assignments from detail view

#### 2.4 Photo Data Model
```typescript
interface Photo {
  id: string;
  url: string;
  date: string;        // ISO date string
  location: string;
  groupIds: string[];  // Array of group IDs
  author?: string;     // undefined = current user's photo
}
```

---

### 3. Group Management

#### 3.1 Create Groups
- Input field for new group name
- Create button
- Default groups: 즐겨찾기(Favorites), 여행(Travel), 가족(Family), 음식(Food)

#### 3.2 Edit Groups
- Edit button (pencil icon) per group in group management modal
- Inline editing with input field
- Save/Cancel buttons or Enter/Escape keys
- Updates group name and refreshes all UI elements

#### 3.3 Delete Groups
- Delete button per group
- Confirmation before deletion
- Auto-remove group ID from all photos when deleted

#### 3.4 Group Filtering
- "All Photos" filter (default)
- Filter by specific group
- Group filter chips/buttons in horizontal scroll

#### 3.5 Assign Photos to Groups
- Toggle groups from photo detail modal
- Bulk add photos to group via Photo Picker Modal
- Visual indicator (checkmark) for assigned groups

#### 3.6 Group Data Model
```typescript
interface Group {
  id: string;
  name: string;
}
```

---

### 4. Search & Filter

#### 4.1 Location Filter
- Text input for location search
- Case-insensitive partial matching

#### 4.2 Date Range Filter
- Start date picker
- End date picker
- Filter photos within date range

#### 4.3 Filter Data Model
```typescript
interface SearchFilters {
  location: string;
  startDate: string;
  endDate: string;
}
```

---

### 5. Social Features

#### 5.1 Friends Tab
- Display photos from friends only
- Filter by friends in your friend list
- Show author badge on each photo

#### 5.2 Friends List Management
- View all friends in Account tab
- Remove friend functionality (with confirmation)
- Display friend avatar (initial-based), name, and ID

#### 5.3 Friend Photo Integration
- Friend photos visible in Friends tab
- Friend photos can be added to personal groups
- Friend photos appear in group view when assigned

---

### 6. Slideshow Mode

#### 6.1 Playback Controls
- Play/Pause toggle
- Previous/Next navigation
- Keyboard shortcuts:
  - Arrow Left/Right: Navigate
  - Space: Play/Pause
  - Escape: Close slideshow

#### 6.2 Slideshow Settings
- Sort mode selection:
  - Latest (newest first)
  - Chronological (oldest first)
  - Random (shuffled)
- Group filter within slideshow

#### 6.3 Slideshow UI
- Fullscreen black background
- Photo info overlay (location, date)
- Progress bar showing position
- Auto-hide controls after 3 seconds of inactivity
- 3-second auto-advance interval

#### 6.4 Sort Mode
```javascript
// Implemented as JavaScript object
const SortMode = {
  LATEST: 'latest',
  CHRONOLOGICAL: 'chronological',
  RANDOM: 'random',
};
```

---

### 7. UI/UX Features

#### 7.1 Tab Navigation
- Three main tabs:
  - My Photos (personal)
  - Friends
  - Account
- Active tab indicator
- Reset group filter on tab change

#### 7.2 Responsive Design
- Mobile-first approach
- Adaptive grid columns
- Mobile floating action button for slideshow
- Collapsible group management panel

#### 7.3 Visual Feedback
- Loading spinner on sync
- Hover effects on photos
- Smooth transitions and animations
- Backdrop blur on modals

#### 7.4 Theme
- **Dark theme only** (default)
- Color palette: Cyan primary (#06b6d4), slate grays for text
- Dark slate backgrounds (#0f172a, #1e293b)
- Subtle glow effects and borders for depth

#### 7.5 UI Components (Implemented)
- **Toast Notifications**: Success, error, warning, info types with auto-dismiss (3s)
- **Loading Overlay**: Full-screen spinner with customizable text
- **Confirm Modal**: Reusable confirmation dialog for destructive actions
- **Photo Modal**: Full photo view with metadata and group management
- **Sync Modal**: Photo selection interface for importing photos
- **Group Modal**: Group management with create, edit, delete functionality

#### 7.6 CSS Architecture
```css
/* CSS Variables (Dark Theme) */
--primary-500: #06b6d4;        /* Cyan primary */
--bg-primary: #0f172a;         /* Main background */
--bg-secondary: #020617;       /* Darker background */
--bg-tertiary: #1e293b;        /* Elevated surfaces */
--text-primary: #f1f5f9;       /* Main text */
--text-secondary: #94a3b8;     /* Secondary text */
--border-color: #334155;       /* Borders */
--shadow-glow: 0 0 20px rgb(6 182 212 / 0.15);
```

---

## Database Schema (Supabase)

### Supabase 인증 구조

Supabase는 내장 인증 시스템을 제공하며, 두 개의 스키마를 사용합니다:

```
Supabase 데이터베이스
│
├── auth (스키마) ← Supabase 자동 관리
│   └── users ← 인증 정보 (이메일, 비밀번호 해시, 토큰 등)
│
└── public (스키마) ← 개발자가 직접 관리
    ├── users ← 프로필 정보 (username, avatar 등)
    ├── photos
    ├── groups
    ├── photo_groups
    └── friendships
```

- `auth.users`: Supabase가 자동 생성/관리. 직접 수정 불가.
- `public.users`: 앱에서 사용할 추가 사용자 정보 저장. `id`는 `auth.users.id`와 동일한 값 사용.

회원가입 시 `public.users`에 자동으로 레코드를 생성하려면 트리거 사용:
```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

### Tables (총 5개)

#### 1. users (사용자 프로필)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | auth.users.id와 동일 |
| email | text | UNIQUE, NOT NULL | 이메일 주소 |
| username | text | NOT NULL | 표시 이름 |
| user_id | text | UNIQUE, NOT NULL | 고유 핸들 (@username) |
| avatar_url | text | NULL 허용 | 프로필 이미지 URL |
| created_at | timestamp | DEFAULT now() | 가입 일시 |
| last_sync_at | timestamp | NULL 허용 | 마지막 사진 동기화 시간 |

#### 2. photos (사진)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | 기본 키 |
| user_id | uuid | FOREIGN KEY → users.id, NOT NULL | 소유자 |
| url | text | NOT NULL | 사진 URL/경로 |
| date_taken | timestamp | NULL 허용 | 촬영 일시 |
| location | text | NULL 허용 | 위치 메타데이터 |
| created_at | timestamp | DEFAULT now() | 업로드 일시 |

#### 3. groups (그룹/앨범)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | 기본 키 |
| user_id | uuid | FOREIGN KEY → users.id, NOT NULL | 소유자 |
| name | text | NOT NULL | 그룹 이름 |
| created_at | timestamp | DEFAULT now() | 생성 일시 |

#### 4. photo_groups (사진-그룹 연결, Junction Table)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| photo_id | uuid | FOREIGN KEY → photos.id | 사진 ID |
| group_id | uuid | FOREIGN KEY → groups.id | 그룹 ID |

- **복합 기본 키**: `PRIMARY KEY (photo_id, group_id)`
- 별도의 id 열 없음
- 하나의 사진이 여러 그룹에 속할 수 있는 다대다(N:M) 관계

#### 5. friendships (친구 관계)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | 기본 키 |
| user_id | uuid | FOREIGN KEY → users.id, NOT NULL | 사용자 |
| friend_id | uuid | FOREIGN KEY → users.id, NOT NULL | 친구 |
| created_at | timestamp | DEFAULT now() | 친구 추가 일시 |

- **복합 고유 제약**: `UNIQUE (user_id, friend_id)` - 중복 친구 관계 방지

---

### 테이블 관계도 (ERD)

```
┌─────────────────┐
│   auth.users    │ (Supabase 자동 관리)
│─────────────────│
│ id (PK)         │
│ email           │
│ encrypted_pwd   │
└────────┬────────┘
         │ 동일한 id 사용
         ▼
┌─────────────────┐
│  public.users   │
│─────────────────│
│ id (PK/FK)      │───────────────────────────────┐
│ email           │                               │
│ username        │                               │
│ user_id         │                               │
│ avatar_url      │                               │
│ created_at      │                               │
│ last_sync_at    │                               │
└────────┬────────┘                               │
         │                                        │
         │ 1:N                                    │ 1:N (자기참조)
         ▼                                        ▼
┌─────────────────┐                    ┌─────────────────┐
│     photos      │                    │   friendships   │
│─────────────────│                    │─────────────────│
│ id (PK)         │                    │ id (PK)         │
│ user_id (FK)    │                    │ user_id (FK)    │
│ url             │                    │ friend_id (FK)  │
│ date_taken      │                    │ created_at      │
│ location        │                    └─────────────────┘
│ created_at      │
└────────┬────────┘
         │
         │ N:M
         ▼
┌─────────────────┐         ┌─────────────────┐
│  photo_groups   │         │     groups      │
│─────────────────│         │─────────────────│
│ photo_id (PK/FK)│────────▶│ id (PK)         │
│ group_id (PK/FK)│◀────────│ user_id (FK)    │
└─────────────────┘         │ name            │
                            │ created_at      │
                            └─────────────────┘
```

---

## API Endpoints (Render Backend)

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user
- `POST /auth/refresh` - Refresh access token

### Photos
- `GET /photos` - Get user's photos (supports query params: groupId, location, startDate, endDate, limit, offset)
- `POST /photos` - Upload new photo(s)
- `GET /photos/:id` - Get single photo
- `DELETE /photos/:id` - Delete photo
- `PUT /photos/:id/groups` - Update photo's groups
- `POST /photos/sync` - Sync selected photos from device

### Groups
- `GET /groups` - Get user's groups
- `POST /groups` - Create new group
- `PUT /groups/:id` - Update group name
- `DELETE /groups/:id` - Delete group

### Friends
- `GET /friends` - Get user's friends
- `GET /friends/photos` - Get friends' photos
- `POST /friends/:userId` - Add friend
- `DELETE /friends/:userId` - Remove friend

### User
- `GET /user/profile` - Get current user profile
- `PUT /user/profile` - Update profile
- `POST /user/sync` - Update last sync timestamp

---

## File Structure

```
Project_02_Platypus/
├── Frontend/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── main.js
│       ├── components/
│       │   ├── gallery.js
│       │   ├── slideshow.js
│       │   ├── modals.js
│       │   └── tabs.js
│       └── services/
│           ├── api.js
│           └── auth.js
├── Backend/
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   └── middleware/
├── CLAUDE.md
└── todo list.txt
```

---

## Environment Variables

### Frontend
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
API_BASE_URL=your_render_api_url
```

### Backend (Render)
```
DATABASE_URL=your_supabase_connection_string
JWT_SECRET=your_jwt_secret
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

---

## Notes

- The reference implementation in `Google_AI_Studio/` uses mock data - actual implementation should connect to Supabase
- Photo storage can use Supabase Storage or external services like Cloudinary
- Consider implementing pagination for large photo libraries
- Friend photo sharing requires proper privacy controls via Supabase RLS

---

## Frontend Implementation Status

### Completed (✅)
- [x] App layout with sticky header and tab navigation
- [x] Photo gallery with responsive grid (2-5 columns)
- [x] Photo detail modal with metadata display
- [x] Group management (create, edit, delete)
- [x] Group filtering with chips
- [x] Search bar with location and date filters
- [x] Slideshow with play/pause, navigation, sorting
- [x] Account tab with profile display
- [x] Friends list display
- [x] Toast notification system
- [x] Loading overlay
- [x] Confirm modal for destructive actions
- [x] Keyboard shortcuts for slideshow
- [x] Dark theme with cyan accent
- [x] Responsive design (mobile-friendly)
- [x] ES6 module-based component architecture
- [x] API service with full endpoint coverage
- [x] Auth service with token management

### Pending (Backend Required)
- [ ] Actual API integration (currently using mock data)
- [ ] User registration/login screens
- [ ] Real photo upload from device
- [ ] Friend search and add functionality
- [ ] Profile editing
- [ ] Photo download functionality

---

## JavaScript Module Structure

```javascript
// main.js - App entry point
// - State management
// - Event listeners setup
// - Initial render

// components/gallery.js
export class Gallery {
  setPhotos(photos)
  setFilter(key, value)
  render()
}

// components/slideshow.js
export class Slideshow {
  open(photos)
  close()
  next() / prev()
  play() / stop()
}

// components/modals.js
export class Modal { open() / close() }
export class PhotoModal extends Modal
export class SyncModal extends Modal
export class GroupModal extends Modal
export class ConfirmModal extends Modal
export class ToastManager

// components/tabs.js
export class Tabs { switchTo(tabId) }
export class GroupFilter { selectGroup(groupId) }

// services/api.js
export async function getPhotos(params)
export async function uploadPhotos(photos)
export async function getGroups()
// ... etc

// services/auth.js
export async function login(email, password)
export async function logout()
export function isAuthenticated()
// ... etc
```
