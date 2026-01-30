/**
 * Platypus - Photo Sharing & Organization App
 * Main JavaScript Module
 */

// ============================================
// Mock Data (Replace with API calls)
// ============================================
const mockPhotos = [
    { id: '1', url: 'https://picsum.photos/seed/1/400/400', date: '2024-01-15', location: '서울, 한국', groupIds: ['favorites'], author: null },
    { id: '2', url: 'https://picsum.photos/seed/2/400/400', date: '2024-01-10', location: '부산, 한국', groupIds: ['travel'], author: null },
    { id: '3', url: 'https://picsum.photos/seed/3/400/400', date: '2024-01-05', location: '제주도, 한국', groupIds: ['travel', 'favorites'], author: null },
    { id: '4', url: 'https://picsum.photos/seed/4/400/400', date: '2023-12-25', location: '도쿄, 일본', groupIds: ['travel'], author: null },
    { id: '5', url: 'https://picsum.photos/seed/5/400/400', date: '2023-12-20', location: '집', groupIds: ['family'], author: null },
    { id: '6', url: 'https://picsum.photos/seed/6/400/400', date: '2023-12-15', location: '강남 레스토랑', groupIds: ['food'], author: null },
    { id: '7', url: 'https://picsum.photos/seed/7/400/400', date: '2023-12-10', location: '홍대', groupIds: [], author: null },
    { id: '8', url: 'https://picsum.photos/seed/8/400/400', date: '2023-12-05', location: '인사동', groupIds: ['favorites'], author: null },
];

const mockFriendPhotos = [
    { id: 'f1', url: 'https://picsum.photos/seed/f1/400/400', date: '2024-01-12', location: '오사카, 일본', groupIds: [], author: '김철수' },
    { id: 'f2', url: 'https://picsum.photos/seed/f2/400/400', date: '2024-01-08', location: '파리, 프랑스', groupIds: [], author: '이영희' },
    { id: 'f3', url: 'https://picsum.photos/seed/f3/400/400', date: '2024-01-03', location: '뉴욕, 미국', groupIds: [], author: '박지민' },
];

const mockSyncPhotos = [
    { id: 's1', url: 'https://picsum.photos/seed/s1/400/400', date: '2024-01-20' },
    { id: 's2', url: 'https://picsum.photos/seed/s2/400/400', date: '2024-01-19' },
    { id: 's3', url: 'https://picsum.photos/seed/s3/400/400', date: '2024-01-18' },
    { id: 's4', url: 'https://picsum.photos/seed/s4/400/400', date: '2024-01-17' },
    { id: 's5', url: 'https://picsum.photos/seed/s5/400/400', date: '2024-01-16' },
    { id: 's6', url: 'https://picsum.photos/seed/s6/400/400', date: '2024-01-15' },
];

const mockUser = {
    id: 'user123',
    name: '홍길동',
    username: 'hong_gd',
    email: 'hong@example.com',
    avatar: null,
    joinDate: '2023-06-15',
    lastSync: '2024-01-20T14:30:00',
    photoCount: 156,
    friendCount: 12,
    storageUsed: '1.2 GB',
};

const mockFriends = [
    { id: 'u1', name: '김철수', username: 'kim_cs' },
    { id: 'u2', name: '이영희', username: 'lee_yh' },
    { id: 'u3', name: '박지민', username: 'park_jm' },
];

// ============================================
// State Management
// ============================================
const state = {
    photos: [...mockPhotos],
    friendPhotos: [...mockFriendPhotos],
    groups: [
        { id: 'favorites', name: '즐겨찾기' },
        { id: 'travel', name: '여행' },
        { id: 'family', name: '가족' },
        { id: 'food', name: '음식' },
    ],
    currentTab: 'my-photos',
    currentGroup: 'all',
    filters: {
        location: '',
        startDate: '',
        endDate: '',
    },
    slideshow: {
        isPlaying: false,
        currentIndex: 0,
        photos: [],
        sortMode: 'latest',
        groupFilter: 'all',
        intervalId: null,
        hideControlsTimeout: null,
    },
    selectedSyncPhotos: new Set(),
    currentPhotoId: null,
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Header
    searchToggle: document.getElementById('searchToggle'),
    searchBar: document.getElementById('searchBar'),
    syncBtn: document.getElementById('syncBtn'),
    locationSearch: document.getElementById('locationSearch'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    clearFilters: document.getElementById('clearFilters'),

    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Gallery
    gallery: document.getElementById('gallery'),
    friendsGallery: document.getElementById('friendsGallery'),
    groupChips: document.querySelectorAll('.group-chip'),
    manageGroupsBtn: document.getElementById('manageGroupsBtn'),

    // FAB
    slideshowBtn: document.getElementById('slideshowBtn'),

    // Modals
    photoModal: document.getElementById('photoModal'),
    syncModal: document.getElementById('syncModal'),
    groupModal: document.getElementById('groupModal'),
    slideshowModal: document.getElementById('slideshowModal'),
    confirmModal: document.getElementById('confirmModal'),

    // Photo Modal Elements
    modalPhoto: document.getElementById('modalPhoto'),
    photoId: document.getElementById('photoId'),
    photoDate: document.getElementById('photoDate'),
    photoLocation: document.getElementById('photoLocation'),
    photoAuthorItem: document.getElementById('photoAuthorItem'),
    photoAuthor: document.getElementById('photoAuthor'),
    groupToggleList: document.getElementById('groupToggleList'),
    deletePhotoBtn: document.getElementById('deletePhotoBtn'),
    downloadPhotoBtn: document.getElementById('downloadPhotoBtn'),

    // Sync Modal Elements
    syncGallery: document.getElementById('syncGallery'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    deselectAllBtn: document.getElementById('deselectAllBtn'),
    importPhotosBtn: document.getElementById('importPhotosBtn'),

    // Group Modal Elements
    newGroupName: document.getElementById('newGroupName'),
    createGroupBtn: document.getElementById('createGroupBtn'),
    groupList: document.getElementById('groupList'),

    // Slideshow Elements
    slideshowPhoto: document.getElementById('slideshowPhoto'),
    slideshowLocation: document.getElementById('slideshowLocation'),
    slideshowDate: document.getElementById('slideshowDate'),
    slideshowControls: document.getElementById('slideshowControls'),
    closeSlideshowBtn: document.getElementById('closeSlideshowBtn'),
    prevSlideBtn: document.getElementById('prevSlideBtn'),
    nextSlideBtn: document.getElementById('nextSlideBtn'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    playIcon: document.getElementById('playIcon'),
    pauseIcon: document.getElementById('pauseIcon'),
    slideshowProgressBar: document.getElementById('slideshowProgressBar'),
    sortModeSelect: document.getElementById('sortModeSelect'),
    slideshowGroupFilter: document.getElementById('slideshowGroupFilter'),

    // Confirm Modal
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmActionBtn: document.getElementById('confirmActionBtn'),

    // Account Elements
    userName: document.getElementById('userName'),
    userId: document.getElementById('userId'),
    userEmail: document.getElementById('userEmail'),
    joinDate: document.getElementById('joinDate'),
    lastSync: document.getElementById('lastSync'),
    photoCount: document.getElementById('photoCount'),
    friendCount: document.getElementById('friendCount'),
    storageUsed: document.getElementById('storageUsed'),
    friendsList: document.getElementById('friendsList'),
    logoutBtn: document.getElementById('logoutBtn'),
    addFriendBtn: document.getElementById('addFriendBtn'),
    editProfileBtn: document.getElementById('editProfileBtn'),

    // Other
    loadingOverlay: document.getElementById('loadingOverlay'),
    toastContainer: document.getElementById('toastContainer'),
};

// ============================================
// Utility Functions
// ============================================
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('ko-KR', options);
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;

    return formatDate(dateString);
}

function getInitials(name) {
    return name.charAt(0).toUpperCase();
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'x-circle';
    if (type === 'warning') icon = 'warning';

    toast.innerHTML = `
        <i class="ph-fill ph-${icon}"></i>
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// Loading State
// ============================================
function showLoading(text = '로딩 중...') {
    elements.loadingOverlay.querySelector('.loading-text').textContent = text;
    elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('active');
}

// ============================================
// Modal Functions
// ============================================
function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function closeAllModals() {
    document.querySelectorAll('.modal, .slideshow-modal').forEach(modal => {
        modal.classList.remove('active');
    });
    document.body.style.overflow = '';
}

// Setup modal close handlers
document.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) closeModal(modal);
    });
});

// ============================================
// Photo Rendering
// ============================================
function getFilteredPhotos(photos) {
    let filtered = [...photos];

    // Filter by group
    if (state.currentGroup !== 'all') {
        filtered = filtered.filter(photo =>
            photo.groupIds.includes(state.currentGroup)
        );
    }

    // Filter by location
    if (state.filters.location) {
        const searchTerm = state.filters.location.toLowerCase();
        filtered = filtered.filter(photo =>
            photo.location.toLowerCase().includes(searchTerm)
        );
    }

    // Filter by date range
    if (state.filters.startDate) {
        filtered = filtered.filter(photo =>
            new Date(photo.date) >= new Date(state.filters.startDate)
        );
    }

    if (state.filters.endDate) {
        filtered = filtered.filter(photo =>
            new Date(photo.date) <= new Date(state.filters.endDate)
        );
    }

    return filtered;
}

function renderGallery(galleryElement, photos) {
    const filtered = getFilteredPhotos(photos);

    if (filtered.length === 0) {
        galleryElement.innerHTML = `
            <div class="gallery-empty">
                <i class="ph ph-camera-slash"></i>
                <h3>사진이 없습니다</h3>
                <p>동기화 버튼을 눌러 사진을 추가하거나 필터를 조정해보세요.</p>
            </div>
        `;
        return;
    }

    galleryElement.innerHTML = filtered.map(photo => `
        <div class="gallery-item" data-photo-id="${photo.id}">
            <img src="${photo.url}" alt="Photo ${photo.id}" loading="lazy">
            <div class="gallery-overlay">
                <div class="gallery-location">
                    <i class="ph ph-map-pin"></i>
                    <span>${photo.location}</span>
                </div>
            </div>
            <div class="gallery-badges">
                ${photo.groupIds.length > 0 ? '<span class="badge badge-group"><i class="ph-fill ph-folder"></i></span>' : ''}
                ${photo.author ? '<span class="badge badge-author"><i class="ph-fill ph-user"></i></span>' : ''}
            </div>
        </div>
    `).join('');

    // Add click handlers
    galleryElement.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const photoId = item.dataset.photoId;
            openPhotoModal(photoId);
        });
    });
}

function renderMyPhotos() {
    renderGallery(elements.gallery, state.photos);
}

function renderFriendPhotos() {
    renderGallery(elements.friendsGallery, state.friendPhotos);
}

// ============================================
// Tab Navigation
// ============================================
function switchTab(tabId) {
    state.currentTab = tabId;
    state.currentGroup = 'all';

    // Update tab buttons
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update tab contents
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });

    // Reset group chips
    elements.groupChips.forEach(chip => {
        chip.classList.toggle('active', chip.dataset.group === 'all');
    });

    // Render appropriate gallery
    if (tabId === 'my-photos') {
        renderMyPhotos();
    } else if (tabId === 'friends') {
        renderFriendPhotos();
    }
}

// ============================================
// Group Filtering
// ============================================
function filterByGroup(groupId) {
    state.currentGroup = groupId;

    elements.groupChips.forEach(chip => {
        chip.classList.toggle('active', chip.dataset.group === groupId);
    });

    renderMyPhotos();
}

// ============================================
// Photo Modal
// ============================================
function openPhotoModal(photoId) {
    const allPhotos = [...state.photos, ...state.friendPhotos];
    const photo = allPhotos.find(p => p.id === photoId);

    if (!photo) return;

    state.currentPhotoId = photoId;

    // Update modal content
    elements.modalPhoto.src = photo.url;
    elements.photoId.textContent = `ID: ${photo.id}`;
    elements.photoDate.textContent = `날짜: ${formatDate(photo.date)}`;
    elements.photoLocation.textContent = `위치: ${photo.location}`;

    // Show/hide author
    if (photo.author) {
        elements.photoAuthorItem.style.display = 'flex';
        elements.photoAuthor.textContent = `작성자: ${photo.author}`;
    } else {
        elements.photoAuthorItem.style.display = 'none';
    }

    // Render group toggles
    renderGroupToggles(photo);

    openModal(elements.photoModal);
}

function renderGroupToggles(photo) {
    elements.groupToggleList.innerHTML = state.groups.map(group => `
        <div class="group-toggle-item ${photo.groupIds.includes(group.id) ? 'active' : ''}" 
             data-group-id="${group.id}">
            <span class="check"><i class="ph-bold ph-check"></i></span>
            <span>${group.name}</span>
        </div>
    `).join('');

    // Add click handlers
    elements.groupToggleList.querySelectorAll('.group-toggle-item').forEach(item => {
        item.addEventListener('click', () => {
            const groupId = item.dataset.groupId;
            togglePhotoGroup(state.currentPhotoId, groupId);
        });
    });
}

function togglePhotoGroup(photoId, groupId) {
    const photo = state.photos.find(p => p.id === photoId);
    if (!photo) return;

    const index = photo.groupIds.indexOf(groupId);
    if (index > -1) {
        photo.groupIds.splice(index, 1);
    } else {
        photo.groupIds.push(groupId);
    }

    // Re-render group toggles
    renderGroupToggles(photo);

    // Re-render gallery (in case filtering is active)
    renderMyPhotos();

    showToast('그룹이 업데이트되었습니다', 'success');
}

// ============================================
// Photo Sync
// ============================================
function openSyncModal() {
    state.selectedSyncPhotos.clear();

    elements.syncGallery.innerHTML = mockSyncPhotos.map(photo => `
        <div class="sync-photo-item" data-photo-id="${photo.id}">
            <img src="${photo.url}" alt="Sync Photo">
            <div class="sync-check">
                <i class="ph-bold ph-check"></i>
            </div>
        </div>
    `).join('');

    // Add click handlers
    elements.syncGallery.querySelectorAll('.sync-photo-item').forEach(item => {
        item.addEventListener('click', () => {
            const photoId = item.dataset.photoId;
            toggleSyncPhoto(photoId, item);
        });
    });

    openModal(elements.syncModal);
}

function toggleSyncPhoto(photoId, element) {
    if (state.selectedSyncPhotos.has(photoId)) {
        state.selectedSyncPhotos.delete(photoId);
        element.classList.remove('selected');
    } else {
        state.selectedSyncPhotos.add(photoId);
        element.classList.add('selected');
    }
}

function selectAllSyncPhotos() {
    elements.syncGallery.querySelectorAll('.sync-photo-item').forEach(item => {
        const photoId = item.dataset.photoId;
        state.selectedSyncPhotos.add(photoId);
        item.classList.add('selected');
    });
}

function deselectAllSyncPhotos() {
    state.selectedSyncPhotos.clear();
    elements.syncGallery.querySelectorAll('.sync-photo-item').forEach(item => {
        item.classList.remove('selected');
    });
}

function importSelectedPhotos() {
    if (state.selectedSyncPhotos.size === 0) {
        showToast('사진을 선택해주세요', 'warning');
        return;
    }

    showLoading('사진을 가져오는 중...');

    // Simulate import delay
    setTimeout(() => {
        const imported = mockSyncPhotos
            .filter(p => state.selectedSyncPhotos.has(p.id))
            .map(p => ({
                ...p,
                id: `imported_${p.id}`,
                location: '알 수 없음',
                groupIds: [],
                author: null,
            }));

        state.photos = [...imported, ...state.photos];

        hideLoading();
        closeModal(elements.syncModal);
        renderMyPhotos();

        showToast(`${imported.length}개의 사진을 가져왔습니다`, 'success');
    }, 1500);
}

// ============================================
// Group Management
// ============================================
function openGroupModal() {
    renderGroupList();
    openModal(elements.groupModal);
}

function renderGroupList() {
    elements.groupList.innerHTML = state.groups.map(group => `
        <div class="group-list-item" data-group-id="${group.id}">
            <div class="group-list-item-info">
                <i class="ph-fill ph-folder"></i>
                <span class="group-name-text">${group.name}</span>
            </div>
            <div class="group-list-item-actions">
                <button class="group-edit-btn" aria-label="그룹 수정">
                    <i class="ph ph-pencil-simple"></i>
                </button>
                <button class="group-delete-btn" aria-label="그룹 삭제">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Add edit handlers
    elements.groupList.querySelectorAll('.group-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const groupId = btn.closest('.group-list-item').dataset.groupId;
            startEditGroup(groupId);
        });
    });

    // Add delete handlers
    elements.groupList.querySelectorAll('.group-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const groupId = btn.closest('.group-list-item').dataset.groupId;
            confirmDeleteGroup(groupId);
        });
    });
}

function startEditGroup(groupId) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;

    const listItem = document.querySelector(`.group-list-item[data-group-id="${groupId}"]`);
    if (!listItem) return;

    // Replace content with edit form
    listItem.classList.add('editing');
    listItem.innerHTML = `
        <div class="group-list-item-info">
            <i class="ph-fill ph-folder"></i>
            <input type="text" class="group-edit-input" value="${group.name}" data-group-id="${groupId}">
        </div>
        <div class="group-list-item-actions">
            <button class="group-save-btn" data-group-id="${groupId}">저장</button>
            <button class="group-cancel-btn" data-group-id="${groupId}">취소</button>
        </div>
    `;

    // Focus input
    const input = listItem.querySelector('.group-edit-input');
    input.focus();
    input.select();

    // Add event listeners
    listItem.querySelector('.group-save-btn').addEventListener('click', () => {
        saveGroupEdit(groupId, input.value);
    });

    listItem.querySelector('.group-cancel-btn').addEventListener('click', () => {
        renderGroupList();
    });

    // Save on Enter, cancel on Escape
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveGroupEdit(groupId, input.value);
        } else if (e.key === 'Escape') {
            renderGroupList();
        }
    });
}

function saveGroupEdit(groupId, newName) {
    const trimmedName = newName.trim();

    if (!trimmedName) {
        showToast('그룹 이름을 입력하세요', 'warning');
        return;
    }

    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;

    group.name = trimmedName;

    renderGroupList();
    updateGroupChips();

    showToast('그룹 이름이 수정되었습니다', 'success');
}

function createGroup() {
    const name = elements.newGroupName.value.trim();

    if (!name) {
        showToast('그룹 이름을 입력하세요', 'warning');
        return;
    }

    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    state.groups.push({ id, name });

    elements.newGroupName.value = '';
    renderGroupList();
    updateGroupChips();

    showToast('새 그룹이 생성되었습니다', 'success');
}

function confirmDeleteGroup(groupId) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;

    elements.confirmTitle.textContent = '그룹 삭제';
    elements.confirmMessage.textContent = `"${group.name}" 그룹을 삭제하시겠습니까? 사진에서 이 그룹 지정이 해제됩니다.`;

    elements.confirmActionBtn.onclick = () => {
        deleteGroup(groupId);
        closeModal(elements.confirmModal);
    };

    openModal(elements.confirmModal);
}

function deleteGroup(groupId) {
    // Remove group from list
    state.groups = state.groups.filter(g => g.id !== groupId);

    // Remove group from all photos
    state.photos.forEach(photo => {
        photo.groupIds = photo.groupIds.filter(id => id !== groupId);
    });

    renderGroupList();
    updateGroupChips();

    if (state.currentGroup === groupId) {
        filterByGroup('all');
    }

    showToast('그룹이 삭제되었습니다', 'success');
}

function updateGroupChips() {
    const container = document.querySelector('.group-filter-scroll');
    const defaultChips = `
        <button class="group-chip ${state.currentGroup === 'all' ? 'active' : ''}" data-group="all">
            <i class="ph ph-images"></i>
            <span>전체 사진</span>
        </button>
    `;

    const groupChips = state.groups.map(group => `
        <button class="group-chip ${state.currentGroup === group.id ? 'active' : ''}" data-group="${group.id}">
            <i class="ph ph-folder"></i>
            <span>${group.name}</span>
        </button>
    `).join('');

    container.innerHTML = defaultChips + groupChips;

    // Re-attach click handlers
    container.querySelectorAll('.group-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            filterByGroup(chip.dataset.group);
        });
    });
}

// ============================================
// Slideshow
// ============================================
function openSlideshow() {
    const photosToShow = getSlideshowPhotos();

    if (photosToShow.length === 0) {
        showToast('표시할 사진이 없습니다', 'warning');
        return;
    }

    state.slideshow.photos = photosToShow;
    state.slideshow.currentIndex = 0;

    updateSlideshowGroupFilter();
    updateSlideshow();

    elements.slideshowModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    setupSlideshowControls();
}

function getSlideshowPhotos() {
    let photos = [...state.photos];

    // Filter by group
    if (state.slideshow.groupFilter !== 'all') {
        photos = photos.filter(p => p.groupIds.includes(state.slideshow.groupFilter));
    }

    // Sort
    switch (state.slideshow.sortMode) {
        case 'latest':
            photos.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'chronological':
            photos.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'random':
            photos = shuffleArray(photos);
            break;
    }

    return photos;
}

function updateSlideshowGroupFilter() {
    elements.slideshowGroupFilter.innerHTML = `
        <option value="all">전체 사진</option>
        ${state.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
    `;
    elements.slideshowGroupFilter.value = state.slideshow.groupFilter;
}

function updateSlideshow() {
    const photo = state.slideshow.photos[state.slideshow.currentIndex];
    if (!photo) return;

    elements.slideshowPhoto.src = photo.url;
    elements.slideshowLocation.textContent = photo.location;
    elements.slideshowDate.textContent = formatDate(photo.date);

    // Update progress bar
    const progress = ((state.slideshow.currentIndex + 1) / state.slideshow.photos.length) * 100;
    elements.slideshowProgressBar.style.width = `${progress}%`;
}

function nextSlide() {
    state.slideshow.currentIndex =
        (state.slideshow.currentIndex + 1) % state.slideshow.photos.length;
    updateSlideshow();
}

function prevSlide() {
    state.slideshow.currentIndex =
        (state.slideshow.currentIndex - 1 + state.slideshow.photos.length) % state.slideshow.photos.length;
    updateSlideshow();
}

function togglePlayPause() {
    state.slideshow.isPlaying = !state.slideshow.isPlaying;

    if (state.slideshow.isPlaying) {
        elements.playIcon.style.display = 'none';
        elements.pauseIcon.style.display = 'inline';
        state.slideshow.intervalId = setInterval(nextSlide, 3000);
    } else {
        elements.playIcon.style.display = 'inline';
        elements.pauseIcon.style.display = 'none';
        clearInterval(state.slideshow.intervalId);
    }
}

function closeSlideshow() {
    if (state.slideshow.isPlaying) {
        togglePlayPause();
    }

    elements.slideshowModal.classList.remove('active');
    document.body.style.overflow = '';
}

function setupSlideshowControls() {
    // Auto-hide controls
    let controlsTimeout;

    function showControls() {
        elements.slideshowControls.classList.remove('hidden');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (state.slideshow.isPlaying) {
                elements.slideshowControls.classList.add('hidden');
            }
        }, 3000);
    }

    elements.slideshowModal.addEventListener('mousemove', showControls);
    elements.slideshowModal.addEventListener('touchstart', showControls);
}

// ============================================
// Account Tab
// ============================================
function renderAccountInfo() {
    elements.userName.textContent = mockUser.name;
    elements.userId.textContent = `@${mockUser.username}`;
    elements.userEmail.textContent = mockUser.email;
    elements.joinDate.textContent = `가입일: ${formatDate(mockUser.joinDate)}`;
    elements.lastSync.textContent = `마지막 동기화: ${formatDateTime(mockUser.lastSync)}`;
    elements.photoCount.textContent = mockUser.photoCount;
    elements.friendCount.textContent = mockUser.friendCount;
    elements.storageUsed.textContent = mockUser.storageUsed;

    renderFriendsList();
}

function renderFriendsList() {
    if (mockFriends.length === 0) {
        elements.friendsList.innerHTML = `
            <div class="gallery-empty">
                <i class="ph ph-users"></i>
                <p>아직 친구가 없습니다</p>
            </div>
        `;
        return;
    }

    elements.friendsList.innerHTML = mockFriends.map(friend => `
        <div class="friend-item" data-friend-id="${friend.id}">
            <div class="friend-avatar">${getInitials(friend.name)}</div>
            <div class="friend-info">
                <div class="friend-name">${friend.name}</div>
                <div class="friend-id">@${friend.username}</div>
            </div>
            <button class="friend-remove-btn" aria-label="친구 삭제">
                <i class="ph ph-x"></i>
            </button>
        </div>
    `).join('');

    // Add remove handlers
    elements.friendsList.querySelectorAll('.friend-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const friendId = btn.closest('.friend-item').dataset.friendId;
            confirmRemoveFriend(friendId);
        });
    });
}

function confirmRemoveFriend(friendId) {
    const friend = mockFriends.find(f => f.id === friendId);
    if (!friend) return;

    elements.confirmTitle.textContent = '친구 삭제';
    elements.confirmMessage.textContent = `${friend.name}님을 친구에서 삭제하시겠습니까?`;

    elements.confirmActionBtn.onclick = () => {
        // In real app, make API call here
        showToast('친구가 삭제되었습니다', 'success');
        closeModal(elements.confirmModal);
    };

    openModal(elements.confirmModal);
}

// ============================================
// Search & Filters
// ============================================
function toggleSearchBar() {
    elements.searchBar.classList.toggle('active');
}

function applyFilters() {
    state.filters.location = elements.locationSearch.value;
    state.filters.startDate = elements.startDate.value;
    state.filters.endDate = elements.endDate.value;

    if (state.currentTab === 'my-photos') {
        renderMyPhotos();
    } else if (state.currentTab === 'friends') {
        renderFriendPhotos();
    }
}

function clearFilters() {
    elements.locationSearch.value = '';
    elements.startDate.value = '';
    elements.endDate.value = '';

    state.filters = {
        location: '',
        startDate: '',
        endDate: '',
    };

    if (state.currentTab === 'my-photos') {
        renderMyPhotos();
    } else if (state.currentTab === 'friends') {
        renderFriendPhotos();
    }

    showToast('필터가 초기화되었습니다', 'success');
}

// ============================================
// Keyboard Shortcuts
// ============================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only handle when slideshow is active
        if (!elements.slideshowModal.classList.contains('active')) return;

        switch (e.code) {
            case 'ArrowLeft':
                prevSlide();
                break;
            case 'ArrowRight':
                nextSlide();
                break;
            case 'Space':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'Escape':
                closeSlideshow();
                break;
        }
    });
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Header
    elements.searchToggle.addEventListener('click', toggleSearchBar);
    elements.syncBtn.addEventListener('click', openSyncModal);
    elements.clearFilters.addEventListener('click', clearFilters);

    // Search inputs
    elements.locationSearch.addEventListener('input', applyFilters);
    elements.startDate.addEventListener('change', applyFilters);
    elements.endDate.addEventListener('change', applyFilters);

    // Tab navigation
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Group chips
    elements.groupChips.forEach(chip => {
        chip.addEventListener('click', () => filterByGroup(chip.dataset.group));
    });

    // Group management
    elements.manageGroupsBtn.addEventListener('click', openGroupModal);
    elements.createGroupBtn.addEventListener('click', createGroup);

    // New group input enter key
    elements.newGroupName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createGroup();
    });

    // Sync modal
    elements.selectAllBtn.addEventListener('click', selectAllSyncPhotos);
    elements.deselectAllBtn.addEventListener('click', deselectAllSyncPhotos);
    elements.importPhotosBtn.addEventListener('click', importSelectedPhotos);

    // Photo modal buttons
    elements.downloadPhotoBtn.addEventListener('click', () => {
        showToast('다운로드 기능은 백엔드 연결 후 사용 가능합니다', 'info');
    });

    elements.deletePhotoBtn.addEventListener('click', () => {
        if (state.currentPhotoId) {
            elements.confirmTitle.textContent = '사진 삭제';
            elements.confirmMessage.textContent = '이 사진을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.';

            elements.confirmActionBtn.onclick = () => {
                state.photos = state.photos.filter(p => p.id !== state.currentPhotoId);
                closeModal(elements.confirmModal);
                closeModal(elements.photoModal);
                renderMyPhotos();
                showToast('사진이 삭제되었습니다', 'success');
            };

            openModal(elements.confirmModal);
        }
    });

    // FAB - Slideshow
    elements.slideshowBtn.addEventListener('click', openSlideshow);

    // Slideshow controls
    elements.closeSlideshowBtn.addEventListener('click', closeSlideshow);
    elements.prevSlideBtn.addEventListener('click', prevSlide);
    elements.nextSlideBtn.addEventListener('click', nextSlide);
    elements.playPauseBtn.addEventListener('click', togglePlayPause);

    elements.sortModeSelect.addEventListener('change', (e) => {
        state.slideshow.sortMode = e.target.value;
        state.slideshow.photos = getSlideshowPhotos();
        state.slideshow.currentIndex = 0;
        updateSlideshow();
    });

    elements.slideshowGroupFilter.addEventListener('change', (e) => {
        state.slideshow.groupFilter = e.target.value;
        state.slideshow.photos = getSlideshowPhotos();
        state.slideshow.currentIndex = 0;
        updateSlideshow();
    });

    // Account
    elements.logoutBtn.addEventListener('click', () => {
        showToast('로그아웃 기능은 백엔드 연결 후 사용 가능합니다', 'info');
    });

    elements.addFriendBtn.addEventListener('click', () => {
        showToast('친구 추가 기능은 백엔드 연결 후 사용 가능합니다', 'info');
    });

    elements.editProfileBtn.addEventListener('click', () => {
        showToast('프로필 수정 기능은 백엔드 연결 후 사용 가능합니다', 'info');
    });

    // Keyboard shortcuts
    setupKeyboardShortcuts();
}

// ============================================
// Initialize App
// ============================================
function init() {
    console.log('🎉 Platypus App Initialized');

    // Setup event listeners
    setupEventListeners();

    // Render initial content
    renderMyPhotos();
    renderFriendPhotos();
    renderAccountInfo();

    // Show welcome toast
    showToast('Platypus에 오신 것을 환영합니다! 🎉', 'success');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
