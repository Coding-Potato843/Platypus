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
- **Backend**: Supabase (Free Plan) - 프론트엔드에서 직접 연결
  - PostgreSQL database
  - Real-time subscriptions
  - Row Level Security (RLS) for data protection
  - Built-in authentication
  - Storage for photo uploads
- **Frontend Hosting**: Render (Static Site)
  - Free tier available
  - Auto-deploy from Git
  - SSL certificates included

### Architecture (Serverless)
```
┌─────────────────┐      supabase-js      ┌─────────────────┐
│  Render         │ ───────────────────► │  Supabase       │
│  (Static Site)  │   Direct Connection   │  (Backend)      │
│  - HTML/CSS/JS  │                       │  - Database     │
│  - Frontend     │                       │  - Auth         │
└─────────────────┘                       │  - Storage      │
                                          └─────────────────┘
```
> Note: 별도의 Node.js 서버 없이 프론트엔드에서 Supabase에 직접 연결하는 서버리스 아키텍처

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
- **Edit profile functionality** (Profile Edit Modal)
  - Edit username (표시 이름)
  - Edit user ID (@username 형식)
  - Edit avatar URL (외부 이미지 URL)

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
- **Pagination** (Load More button)
  - 20 photos per page
  - "더 보기" button appears when more photos exist
  - Loading indicator while fetching
  - Works for both personal and friend photos

#### 2.3 Photo Detail Modal
- Full-size image view
- Display metadata:
  - Photo ID
  - Date taken (formatted)
  - Location
  - Author (for friend's photos)
- Manage group assignments from detail view
- **Download photo** (fetches image as blob and triggers browser download)
- Delete photo (with confirmation)

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
- **Add friend functionality** (Add Friend Modal)
  - Search users by username or user ID
  - Display search results with avatar, name, ID
  - One-click add friend button
  - Shows "친구" badge for existing friends

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
- **Profile Edit Modal**: Edit username, user ID, and avatar URL
- **Add Friend Modal**: Search users and add friends with one click
- **Load More Button**: Pagination for photo galleries (20 photos per page)

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

## Supabase API Usage

프론트엔드에서 Supabase 클라이언트를 직접 사용합니다.

### Supabase Client 설정 (api.js)
```javascript
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://vtpgatnkobvjqwvoqtad.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### Authentication (Supabase Auth)
```javascript
// 회원가입
const { data, error } = await supabase.auth.signUp({ email, password });

// 로그인
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// 로그아웃
const { error } = await supabase.auth.signOut();

// 현재 사용자
const { data: { user } } = await supabase.auth.getUser();
```

### Database Queries
```javascript
// 사진 조회
const { data, error } = await supabase.from('photos').select('*').eq('user_id', userId);

// 사진 추가
const { data, error } = await supabase.from('photos').insert({ url, user_id, location });

// 그룹 조회
const { data, error } = await supabase.from('groups').select('*').eq('user_id', userId);

// 친구 목록 조회
const { data, error } = await supabase
  .from('friendships')
  .select('friend_id, users!friendships_friend_id_fkey(username, user_id, avatar_url)')
  .eq('user_id', userId);
```

### Storage (Photo Upload)
```javascript
// 사진 업로드
const { data, error } = await supabase.storage
  .from('photos')
  .upload(`${userId}/${fileName}`, file);

// 공개 URL 가져오기
const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
```

---

## File Structure

```
Project_02_Platypus/
├── Frontend/                    # Render Static Site로 배포
│   ├── index.html               # Auth Modal 포함
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── main.js              # 앱 진입점, 상태 관리, 이벤트 리스너
│       └── services/
│           ├── api.js           # Supabase 클라이언트 및 API 함수
│           └── auth.js          # Supabase Auth 연동
├── supabase_rls_setup.sql       # 테이블 RLS 정책 SQL
├── supabase_storage_setup.sql   # Storage RLS 정책 SQL (참고용)
├── todolist.txt                 # 개발 진행 상황 추적
├── CLAUDE.md
└── 클로드.md
```

> Note: 별도의 Backend 폴더 없음 - Supabase가 백엔드 역할 수행

---

## Supabase Configuration

### 현재 설정 (api.js에 직접 작성)
```javascript
const SUPABASE_URL = 'https://vtpgatnkobvjqwvoqtad.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cGdhdG5rb2J2anF3dm9xdGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NzQxNzIsImV4cCI6MjA4NTM1MDE3Mn0.Tc_lFbbkBrUusy2fI4XpNwxTXTGI2qfksU82y6AFyAQ';
```

> **보안 참고**: `anon key`는 공개되어도 안전합니다. Supabase의 Row Level Security(RLS)가 데이터를 보호합니다. 비밀로 유지해야 하는 키는 `service_role key`입니다.

### Supabase Dashboard
- **URL**: https://supabase.com/dashboard/project/vtpgatnkobvjqwvoqtad
- **Settings > API**: URL 및 키 확인 가능

---

## Render Deployment (Static Site)

### 배포 설정
| 항목 | 설정값 |
|------|--------|
| **Type** | Static Site |
| **Branch** | main |
| **Build Command** | (비워두기) |
| **Publish Directory** | `Frontend` |
| **Environment Variables** | (비워두기 - 코드에 직접 설정) |

### 배포 단계
1. Render 대시보드에서 **New +** → **Static Site** 선택
2. GitHub 레포지토리 연결
3. 위 설정 입력
4. **Create Static Site** 클릭

### 자동 배포
- GitHub main 브랜치에 푸시하면 자동으로 재배포됩니다

---

## Auth Modal UI

index.html에 포함된 인증 모달:

```html
<!-- Auth Modal Structure -->
<div class="modal" id="authModal">
  <div class="modal-content auth-modal-content">
    <!-- Tab Navigation -->
    <div class="auth-tabs">
      <button class="auth-tab active" data-auth-tab="login">로그인</button>
      <button class="auth-tab" data-auth-tab="signup">회원가입</button>
    </div>

    <!-- Login Form -->
    <form id="loginForm" class="auth-form active">
      <input type="email" id="loginEmail" placeholder="이메일" required>
      <input type="password" id="loginPassword" placeholder="비밀번호" required>
      <button type="submit">로그인</button>
    </form>

    <!-- Signup Form -->
    <form id="signupForm" class="auth-form">
      <input type="email" id="signupEmail" placeholder="이메일" required>
      <input type="text" id="signupUsername" placeholder="사용자명" required>
      <input type="password" id="signupPassword" placeholder="비밀번호" required>
      <input type="password" id="signupPasswordConfirm" placeholder="비밀번호 확인" required>
      <button type="submit">회원가입</button>
    </form>
  </div>
</div>
```

---

## Notes

- Photo storage uses Supabase Storage (Public bucket)
- RLS 정책이 활성화되어야 데이터 보안이 적용됨
- `anon key`는 클라이언트에 노출되어도 안전 (RLS가 보호)
- 회원가입 후 이메일 확인이 필요할 수 있음 (Supabase 설정에 따라 다름)
- Mock 데이터는 fallback으로 유지 (API 실패 시)

---

## Implementation Status

### Completed (✅)

#### UI/UX
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
- [x] Auth Modal (로그인/회원가입 UI)

#### Supabase Integration
- [x] Supabase 클라이언트 설정 (api.js)
- [x] Supabase Auth 연동 (auth.js)
  - signUp, signInWithPassword, signOut, getUser
  - onAuthStateChange 리스너
  - 세션 자동 유지
- [x] Photos API (getPhotos, uploadPhoto, deletePhoto, updatePhotoGroups)
- [x] Groups API (getGroups, createGroup, updateGroup, deleteGroup)
- [x] Friends API (getFriends, addFriend, removeFriend, searchUsers)
- [x] User API (getUserProfile, updateUserProfile, getUserStats)
- [x] Storage 연동 (photo upload/delete with public URLs)

#### Security (RLS)
- [x] RLS 정책 SQL 파일 생성 (supabase_rls_setup.sql)
- [x] Storage 정책 SQL 파일 생성 (supabase_storage_setup.sql)
- [x] Photos Storage 버킷 설정 (Public)
- [x] Storage 정책 (INSERT, SELECT, DELETE)

### Pending (수동 설정 필요) ⚠️
- [ ] Supabase SQL Editor에서 supabase_rls_setup.sql 실행
- [ ] 테이블 RLS 정책 활성화 (users, photos, groups, photo_groups, friendships)

### Additional Features (✅ Completed)
- [x] 프로필 편집 기능 (Profile Edit Modal)
- [x] 친구 검색 및 추가 기능 (Add Friend Modal with Search)
- [x] 사진 다운로드 기능 (Photo Download)
- [x] 페이지네이션 구현 (Load More Button, 20 photos per page)

---

## JavaScript Module Structure

### main.js (앱 진입점)
```javascript
// State Management
const state = {
  photos: [],           // 사용자 사진
  friendPhotos: [],     // 친구 사진
  friends: [],          // 친구 목록
  groups: [],           // 그룹 목록
  currentTab: 'my-photos',
  currentGroup: 'all',
  pagination: {         // 페이지네이션 상태
    photosPerPage: 20,
    myPhotosOffset: 0,
    friendPhotosOffset: 0,
    hasMoreMyPhotos: true,
    hasMoreFriendPhotos: true,
    isLoadingMore: false,
  },
  // ...
};

// Data Loading (Supabase) - with Pagination
async function loadAllUserData()           // 모든 데이터 로드
async function loadPhotos(loadMore)        // 사진 로드 (페이지네이션 지원)
async function loadGroups()                // 그룹 로드
async function loadFriendPhotos(loadMore)  // 친구 사진 로드 (페이지네이션 지원)
async function loadFriends()               // 친구 목록 로드

// Auth Functions
async function handleLogin(e)      // 로그인 처리
async function handleSignup(e)     // 회원가입 처리
async function handleLogout()      // 로그아웃 처리
async function updateUIForAuthenticatedUser()   // 로그인 후 UI 업데이트
function updateUIForUnauthenticatedUser()       // 로그아웃 후 UI 업데이트

// Profile Edit Functions
async function openProfileEditModal()      // 프로필 편집 모달 열기
async function handleProfileEdit(e)        // 프로필 저장 처리

// Friend Search & Add Functions
function openAddFriendModal()              // 친구 추가 모달 열기
async function handleFriendSearch()        // 사용자 검색
async function addFriend(friendId, name, btn)  // 친구 추가

// Photo Functions
async function handlePhotoDownload()       // 사진 다운로드

// Rendering Functions
function renderMyPhotos()          // 내 사진 렌더링 (Load More 버튼 포함)
function renderFriendPhotos()      // 친구 사진 렌더링 (Load More 버튼 포함)
function renderGroupList()         // 그룹 목록 렌더링
function renderFriendsList()       // 친구 목록 렌더링
```

### services/api.js (Supabase API)
```javascript
// Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Photo API
export async function getPhotos(userId, params)
export async function getPhoto(photoId)
export async function uploadPhoto(userId, file, metadata)
export async function uploadPhotos(userId, photos)
export async function deletePhoto(photoId, userId)
export async function updatePhotoGroups(photoId, groupIds)

// Group API
export async function getGroups(userId)
export async function createGroup(userId, name)
export async function updateGroup(groupId, userId, name)
export async function deleteGroup(groupId, userId)

// Friends API
export async function getFriends(userId)
export async function getFriendsPhotos(userId, params)
export async function addFriend(userId, friendId)
export async function removeFriend(userId, friendId)
export async function searchUsers(searchTerm)

// User API
export async function getUserProfile(userId)
export async function updateUserProfile(userId, updates)
export async function updateLastSync(userId)
export async function getUserStats(userId)
```

### services/auth.js (Supabase Auth)
```javascript
// Auth Functions
export async function initAuth()                    // 세션 초기화
export async function login(email, password)        // 로그인
export async function register(email, password, username, displayName)  // 회원가입
export async function logout()                      // 로그아웃
export function getCurrentUser()                    // 현재 사용자 가져오기
export async function getCurrentUserProfile()       // 프로필 가져오기
export function onAuthStateChange(callback)         // 인증 상태 변경 리스너

// Validation
export function validateEmail(email)
export function validatePassword(password)
export function validateUsername(username)

// Custom Error
export class AuthError extends Error
```

---

## RLS Policy Files

### supabase_rls_setup.sql
테이블별 Row Level Security 정책을 설정하는 SQL 파일:
- users: 모든 사용자 조회 가능, 본인만 생성/수정
- photos: 본인 사진만 CRUD, 친구 사진 조회 가능
- groups: 본인 그룹만 CRUD
- photo_groups: 본인 사진-그룹 연결만 CRUD
- friendships: 본인 친구 관계만 CRUD

### supabase_storage_setup.sql
Storage 버킷 정책 (참고용, Dashboard에서 설정):
- photos 버킷: Public
- INSERT: 인증된 사용자가 자기 폴더에만 업로드
- DELETE: 인증된 사용자가 자기 파일만 삭제
- SELECT: Public 버킷이므로 정책 불필요

---

## Storage Configuration

### Photos 버킷 설정
| 설정 | 값 |
|------|-----|
| Bucket Name | photos |
| Public | Yes (체크) |
| File Size Limit | 50MB (기본값) |

### Storage Policies (3개)
| Policy Name | Operation | Definition |
|-------------|-----------|------------|
| User can upload photos | INSERT | `bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text` |
| User can delete own photos | DELETE | `bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text` |
| (Auto-created with DELETE) | SELECT | `bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text` |

> Note: Public 버킷이므로 SELECT 정책 없이도 이미지 조회 가능
