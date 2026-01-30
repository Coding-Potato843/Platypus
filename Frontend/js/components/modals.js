/**
 * Modals Component
 * Handles modal dialogs and overlays
 */

export class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.isOpen = false;

        if (this.modal) {
            this.setupCloseHandlers();
        }
    }

    /**
     * Open modal
     */
    open() {
        if (!this.modal) return;

        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.isOpen = true;

        // Trigger custom event
        this.modal.dispatchEvent(new CustomEvent('modal:open'));
    }

    /**
     * Close modal
     */
    close() {
        if (!this.modal) return;

        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.isOpen = false;

        // Trigger custom event
        this.modal.dispatchEvent(new CustomEvent('modal:close'));
    }

    /**
     * Toggle modal
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Setup close handlers
     */
    setupCloseHandlers() {
        // Close on overlay click
        this.modal.querySelectorAll('[data-close-modal]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target === el) {
                    this.close();
                }
            });
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Get modal element
     */
    getElement() {
        return this.modal;
    }
}

/**
 * Photo Detail Modal
 */
export class PhotoModal extends Modal {
    constructor() {
        super('photoModal');

        this.photoElement = document.getElementById('modalPhoto');
        this.photoId = document.getElementById('photoId');
        this.photoDate = document.getElementById('photoDate');
        this.photoLocation = document.getElementById('photoLocation');
        this.photoAuthorItem = document.getElementById('photoAuthorItem');
        this.photoAuthor = document.getElementById('photoAuthor');
        this.groupToggleList = document.getElementById('groupToggleList');

        this.currentPhotoId = null;
        this.onGroupToggle = () => { };
        this.onDelete = () => { };
        this.onDownload = () => { };
    }

    /**
     * Show photo details
     */
    showPhoto(photo, groups = []) {
        if (!photo) return;

        this.currentPhotoId = photo.id;

        // Update content
        if (this.photoElement) this.photoElement.src = photo.url;
        if (this.photoId) this.photoId.textContent = `ID: ${photo.id}`;
        if (this.photoDate) this.photoDate.textContent = `날짜: ${this.formatDate(photo.date)}`;
        if (this.photoLocation) this.photoLocation.textContent = `위치: ${photo.location || '알 수 없음'}`;

        // Show/hide author
        if (photo.author) {
            if (this.photoAuthorItem) this.photoAuthorItem.style.display = 'flex';
            if (this.photoAuthor) this.photoAuthor.textContent = `작성자: ${photo.author}`;
        } else {
            if (this.photoAuthorItem) this.photoAuthorItem.style.display = 'none';
        }

        // Render group toggles
        this.renderGroupToggles(photo, groups);

        this.open();
    }

    /**
     * Render group toggle list
     */
    renderGroupToggles(photo, groups) {
        if (!this.groupToggleList) return;

        this.groupToggleList.innerHTML = groups.map(group => `
            <div class="group-toggle-item ${photo.groupIds && photo.groupIds.includes(group.id) ? 'active' : ''}" 
                 data-group-id="${group.id}">
                <span class="check"><i class="ph-bold ph-check"></i></span>
                <span>${group.name}</span>
            </div>
        `).join('');

        // Attach click handlers
        this.groupToggleList.querySelectorAll('.group-toggle-item').forEach(item => {
            item.addEventListener('click', () => {
                const groupId = item.dataset.groupId;
                this.onGroupToggle(this.currentPhotoId, groupId);
            });
        });
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('ko-KR', options);
    }

    /**
     * Get current photo ID
     */
    getCurrentPhotoId() {
        return this.currentPhotoId;
    }
}

/**
 * Sync Modal
 */
export class SyncModal extends Modal {
    constructor() {
        super('syncModal');

        this.syncGallery = document.getElementById('syncGallery');
        this.selectedPhotos = new Set();
        this.onImport = () => { };
    }

    /**
     * Show sync photos
     */
    showPhotos(photos) {
        this.selectedPhotos.clear();

        if (!this.syncGallery) return;

        this.syncGallery.innerHTML = photos.map(photo => `
            <div class="sync-photo-item" data-photo-id="${photo.id}">
                <img src="${photo.url}" alt="Sync Photo">
                <div class="sync-check">
                    <i class="ph-bold ph-check"></i>
                </div>
            </div>
        `).join('');

        // Attach click handlers
        this.syncGallery.querySelectorAll('.sync-photo-item').forEach(item => {
            item.addEventListener('click', () => {
                this.togglePhoto(item.dataset.photoId, item);
            });
        });

        this.open();
    }

    /**
     * Toggle photo selection
     */
    togglePhoto(photoId, element) {
        if (this.selectedPhotos.has(photoId)) {
            this.selectedPhotos.delete(photoId);
            element.classList.remove('selected');
        } else {
            this.selectedPhotos.add(photoId);
            element.classList.add('selected');
        }
    }

    /**
     * Select all photos
     */
    selectAll() {
        if (!this.syncGallery) return;

        this.syncGallery.querySelectorAll('.sync-photo-item').forEach(item => {
            const photoId = item.dataset.photoId;
            this.selectedPhotos.add(photoId);
            item.classList.add('selected');
        });
    }

    /**
     * Deselect all photos
     */
    deselectAll() {
        this.selectedPhotos.clear();

        if (!this.syncGallery) return;

        this.syncGallery.querySelectorAll('.sync-photo-item').forEach(item => {
            item.classList.remove('selected');
        });
    }

    /**
     * Get selected photo IDs
     */
    getSelectedIds() {
        return Array.from(this.selectedPhotos);
    }

    /**
     * Get selected count
     */
    getSelectedCount() {
        return this.selectedPhotos.size;
    }
}

/**
 * Group Management Modal
 */
export class GroupModal extends Modal {
    constructor() {
        super('groupModal');

        this.groupList = document.getElementById('groupList');
        this.newGroupInput = document.getElementById('newGroupName');

        this.onCreate = () => { };
        this.onDelete = () => { };
    }

    /**
     * Render group list
     */
    renderGroups(groups) {
        if (!this.groupList) return;

        this.groupList.innerHTML = groups.map(group => `
            <div class="group-list-item" data-group-id="${group.id}">
                <div class="group-list-item-info">
                    <i class="ph-fill ph-folder"></i>
                    <span>${group.name}</span>
                </div>
                <button class="group-delete-btn" aria-label="그룹 삭제">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        `).join('');

        // Attach delete handlers
        this.groupList.querySelectorAll('.group-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupId = btn.closest('.group-list-item').dataset.groupId;
                this.onDelete(groupId);
            });
        });
    }

    /**
     * Get new group name
     */
    getNewGroupName() {
        return this.newGroupInput ? this.newGroupInput.value.trim() : '';
    }

    /**
     * Clear input
     */
    clearInput() {
        if (this.newGroupInput) {
            this.newGroupInput.value = '';
        }
    }
}

/**
 * Confirm Modal
 */
export class ConfirmModal extends Modal {
    constructor() {
        super('confirmModal');

        this.titleElement = document.getElementById('confirmTitle');
        this.messageElement = document.getElementById('confirmMessage');
        this.actionBtn = document.getElementById('confirmActionBtn');

        this.onConfirm = () => { };
    }

    /**
     * Show confirmation dialog
     */
    show(title, message, onConfirm) {
        if (this.titleElement) this.titleElement.textContent = title;
        if (this.messageElement) this.messageElement.textContent = message;

        this.onConfirm = onConfirm;

        if (this.actionBtn) {
            this.actionBtn.onclick = () => {
                this.onConfirm();
                this.close();
            };
        }

        this.open();
    }
}

/**
 * Toast Notification Manager
 */
export class ToastManager {
    constructor(containerId = 'toastContainer') {
        this.container = document.getElementById(containerId);
        this.duration = 3000;
    }

    /**
     * Show toast notification
     */
    show(message, type = 'info') {
        if (!this.container) return;

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

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, this.duration);
    }

    /**
     * Shorthand methods
     */
    success(message) {
        this.show(message, 'success');
    }

    error(message) {
        this.show(message, 'error');
    }

    warning(message) {
        this.show(message, 'warning');
    }

    info(message) {
        this.show(message, 'info');
    }
}

export default {
    Modal,
    PhotoModal,
    SyncModal,
    GroupModal,
    ConfirmModal,
    ToastManager,
};
