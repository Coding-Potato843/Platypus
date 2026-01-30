/**
 * Slideshow Component
 * Handles slideshow functionality with auto-play and navigation
 */

export const SortMode = {
    LATEST: 'latest',
    CHRONOLOGICAL: 'chronological',
    RANDOM: 'random',
};

export class Slideshow {
    constructor(options = {}) {
        this.photos = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.sortMode = SortMode.LATEST;
        this.groupFilter = 'all';
        this.intervalId = null;
        this.autoHideTimeout = null;
        this.intervalDuration = options.intervalDuration || 3000;
        this.autoHideDuration = options.autoHideDuration || 3000;

        // Callbacks
        this.onPhotoChange = options.onPhotoChange || (() => { });
        this.onPlayStateChange = options.onPlayStateChange || (() => { });
        this.onClose = options.onClose || (() => { });

        // DOM Elements
        this.modal = document.getElementById('slideshowModal');
        this.photoElement = document.getElementById('slideshowPhoto');
        this.controls = document.getElementById('slideshowControls');
        this.progressBar = document.getElementById('slideshowProgressBar');

        this.setupKeyboardShortcuts();
        this.setupMouseEvents();
    }

    /**
     * Open slideshow with photos
     */
    open(photos) {
        if (!photos || photos.length === 0) {
            console.warn('No photos to display');
            return false;
        }

        this.photos = this.sortPhotos([...photos]);
        this.currentIndex = 0;
        this.isPlaying = false;

        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        this.updateDisplay();
        return true;
    }

    /**
     * Close slideshow
     */
    close() {
        this.stop();
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.onClose();
    }

    /**
     * Sort photos based on current sort mode
     */
    sortPhotos(photos) {
        switch (this.sortMode) {
            case SortMode.LATEST:
                return photos.sort((a, b) => new Date(b.date) - new Date(a.date));
            case SortMode.CHRONOLOGICAL:
                return photos.sort((a, b) => new Date(a.date) - new Date(b.date));
            case SortMode.RANDOM:
                return this.shuffleArray(photos);
            default:
                return photos;
        }
    }

    /**
     * Shuffle array randomly
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Filter photos by group
     */
    filterByGroup(photos, groupId) {
        if (groupId === 'all') return photos;
        return photos.filter(p => p.groupIds && p.groupIds.includes(groupId));
    }

    /**
     * Go to next photo
     */
    next() {
        this.currentIndex = (this.currentIndex + 1) % this.photos.length;
        this.updateDisplay();
    }

    /**
     * Go to previous photo
     */
    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.photos.length) % this.photos.length;
        this.updateDisplay();
    }

    /**
     * Start auto-play
     */
    play() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.intervalId = setInterval(() => this.next(), this.intervalDuration);
        this.onPlayStateChange(true);
    }

    /**
     * Stop auto-play
     */
    stop() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.onPlayStateChange(false);
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }

    /**
     * Set sort mode
     */
    setSortMode(mode) {
        this.sortMode = mode;
        this.photos = this.sortPhotos([...this.photos]);
        this.currentIndex = 0;
        this.updateDisplay();
    }

    /**
     * Set group filter
     */
    setGroupFilter(groupId, allPhotos) {
        this.groupFilter = groupId;
        const filtered = this.filterByGroup(allPhotos, groupId);
        this.photos = this.sortPhotos(filtered);
        this.currentIndex = 0;
        this.updateDisplay();
    }

    /**
     * Update display with current photo
     */
    updateDisplay() {
        const photo = this.photos[this.currentIndex];
        if (!photo) return;

        if (this.photoElement) {
            this.photoElement.src = photo.url;
        }

        // Update progress bar
        if (this.progressBar) {
            const progress = ((this.currentIndex + 1) / this.photos.length) * 100;
            this.progressBar.style.width = `${progress}%`;
        }

        this.onPhotoChange(photo, this.currentIndex, this.photos.length);
    }

    /**
     * Get current photo
     */
    getCurrentPhoto() {
        return this.photos[this.currentIndex];
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.modal.classList.contains('active')) return;

            switch (e.code) {
                case 'ArrowLeft':
                    this.prev();
                    break;
                case 'ArrowRight':
                    this.next();
                    break;
                case 'Space':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'Escape':
                    this.close();
                    break;
            }
        });
    }

    /**
     * Setup mouse events for auto-hiding controls
     */
    setupMouseEvents() {
        if (!this.modal || !this.controls) return;

        const showControls = () => {
            this.controls.classList.remove('hidden');
            clearTimeout(this.autoHideTimeout);

            if (this.isPlaying) {
                this.autoHideTimeout = setTimeout(() => {
                    this.controls.classList.add('hidden');
                }, this.autoHideDuration);
            }
        };

        this.modal.addEventListener('mousemove', showControls);
        this.modal.addEventListener('touchstart', showControls);
    }
}

export default Slideshow;
