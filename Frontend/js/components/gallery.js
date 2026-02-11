/**
 * Gallery Component
 * Handles photo gallery rendering and interactions
 */

export class Gallery {
    constructor(containerSelector, options = {}) {
        this.container = document.querySelector(containerSelector);
        this.photos = [];
        this.filters = {
            group: 'all',
            location: '',
            startDate: '',
            endDate: '',
        };
        this.onPhotoClick = options.onPhotoClick || (() => { });
    }

    /**
     * Set photos data
     */
    setPhotos(photos) {
        this.photos = photos;
        this.render();
    }

    /**
     * Set filter
     */
    setFilter(key, value) {
        this.filters[key] = value;
        this.render();
    }

    /**
     * Get filtered photos
     */
    getFilteredPhotos() {
        let filtered = [...this.photos];

        // Filter by group
        if (this.filters.group !== 'all') {
            filtered = filtered.filter(photo =>
                photo.groupIds && photo.groupIds.includes(this.filters.group)
            );
        }

        // Filter by location
        if (this.filters.location) {
            const searchTerm = this.filters.location.toLowerCase();
            filtered = filtered.filter(photo =>
                photo.location && photo.location.toLowerCase().includes(searchTerm)
            );
        }

        // Filter by date range
        if (this.filters.startDate) {
            filtered = filtered.filter(photo =>
                new Date(photo.date) >= new Date(this.filters.startDate)
            );
        }

        if (this.filters.endDate) {
            filtered = filtered.filter(photo =>
                new Date(photo.date) <= new Date(this.filters.endDate)
            );
        }

        return filtered;
    }

    /**
     * Render gallery
     */
    render() {
        if (!this.container) return;

        const filtered = this.getFilteredPhotos();

        if (filtered.length === 0) {
            this.container.innerHTML = this.renderEmptyState();
            return;
        }

        this.container.innerHTML = filtered.map(photo => this.renderPhotoItem(photo)).join('');
        this.attachEventListeners();
    }

    /**
     * Render single photo item
     */
    renderPhotoItem(photo) {
        const hasGroups = photo.groupIds && photo.groupIds.length > 0;
        const hasAuthor = !!photo.author;

        return `
            <div class="gallery-item" data-photo-id="${photo.id}">
                <img src="${photo.url}" alt="Photo ${photo.id}" loading="lazy">
                <div class="gallery-overlay">
                    <div class="gallery-location">
                        <i class="ph ph-map-pin"></i>
                        <span>${photo.location || '알 수 없음'}</span>
                    </div>
                </div>
                <div class="gallery-badges">
                    ${hasGroups ? '<span class="badge badge-group"><i class="ph-fill ph-folder"></i></span>' : ''}
                    ${hasAuthor ? `<span class="badge badge-author">${photo.authorAvatar ? `<img src="${photo.authorAvatar}" alt="${photo.author}">` : `<i class="ph-fill ph-user"></i>`}</span>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="gallery-empty">
                <i class="ph ph-camera-slash"></i>
                <h3>사진이 없습니다</h3>
                <p>불러오기 버튼을 눌러 사진을 추가하거나 필터를 조정해보세요.</p>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        this.container.querySelectorAll('.gallery-item').forEach(item => {
            item.addEventListener('click', () => {
                const photoId = item.dataset.photoId;
                this.onPhotoClick(photoId);
            });
        });
    }

    /**
     * Get photo by ID
     */
    getPhotoById(id) {
        return this.photos.find(photo => photo.id === id);
    }

    /**
     * Update photo
     */
    updatePhoto(photoId, updates) {
        const index = this.photos.findIndex(p => p.id === photoId);
        if (index !== -1) {
            this.photos[index] = { ...this.photos[index], ...updates };
            this.render();
        }
    }

    /**
     * Remove photo
     */
    removePhoto(photoId) {
        this.photos = this.photos.filter(p => p.id !== photoId);
        this.render();
    }

    /**
     * Add photos
     */
    addPhotos(newPhotos) {
        this.photos = [...newPhotos, ...this.photos];
        this.render();
    }
}

export default Gallery;
