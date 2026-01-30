/**
 * Tabs Component
 * Handles tab navigation and content switching
 */

export class Tabs {
    constructor(options = {}) {
        this.tabButtons = document.querySelectorAll(options.buttonSelector || '.tab-btn');
        this.tabContents = document.querySelectorAll(options.contentSelector || '.tab-content');
        this.activeTab = options.defaultTab || null;
        this.onTabChange = options.onTabChange || (() => { });

        this.init();
    }

    /**
     * Initialize tabs
     */
    init() {
        // Set initial active tab
        if (!this.activeTab && this.tabButtons.length > 0) {
            this.activeTab = this.tabButtons[0].dataset.tab;
        }

        // Attach click handlers
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTo(btn.dataset.tab);
            });
        });

        // Set initial state
        this.updateUI();
    }

    /**
     * Switch to a specific tab
     */
    switchTo(tabId) {
        if (this.activeTab === tabId) return;

        const previousTab = this.activeTab;
        this.activeTab = tabId;

        this.updateUI();
        this.onTabChange(tabId, previousTab);
    }

    /**
     * Update UI to reflect current tab
     */
    updateUI() {
        // Update buttons
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === this.activeTab);
        });

        // Update contents
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === this.activeTab);
        });
    }

    /**
     * Get current active tab
     */
    getActiveTab() {
        return this.activeTab;
    }

    /**
     * Check if a specific tab is active
     */
    isActive(tabId) {
        return this.activeTab === tabId;
    }

    /**
     * Disable a tab
     */
    disableTab(tabId) {
        const btn = Array.from(this.tabButtons).find(b => b.dataset.tab === tabId);
        if (btn) {
            btn.disabled = true;
            btn.classList.add('disabled');
        }
    }

    /**
     * Enable a tab
     */
    enableTab(tabId) {
        const btn = Array.from(this.tabButtons).find(b => b.dataset.tab === tabId);
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('disabled');
        }
    }

    /**
     * Get all tab IDs
     */
    getAllTabs() {
        return Array.from(this.tabButtons).map(btn => btn.dataset.tab);
    }
}

/**
 * Group Filter Chips
 */
export class GroupFilter {
    constructor(containerSelector, options = {}) {
        this.container = document.querySelector(containerSelector);
        this.groups = [];
        this.activeGroup = 'all';
        this.onGroupChange = options.onGroupChange || (() => { });
    }

    /**
     * Set groups
     */
    setGroups(groups) {
        this.groups = groups;
        this.render();
    }

    /**
     * Add a group
     */
    addGroup(group) {
        this.groups.push(group);
        this.render();
    }

    /**
     * Remove a group
     */
    removeGroup(groupId) {
        this.groups = this.groups.filter(g => g.id !== groupId);

        if (this.activeGroup === groupId) {
            this.activeGroup = 'all';
        }

        this.render();
    }

    /**
     * Select a group
     */
    selectGroup(groupId) {
        this.activeGroup = groupId;
        this.updateActiveState();
        this.onGroupChange(groupId);
    }

    /**
     * Get active group
     */
    getActiveGroup() {
        return this.activeGroup;
    }

    /**
     * Render group chips
     */
    render() {
        if (!this.container) return;

        const defaultChip = `
            <button class="group-chip ${this.activeGroup === 'all' ? 'active' : ''}" data-group="all">
                <i class="ph ph-images"></i>
                <span>전체 사진</span>
            </button>
        `;

        const groupChips = this.groups.map(group => `
            <button class="group-chip ${this.activeGroup === group.id ? 'active' : ''}" data-group="${group.id}">
                <i class="ph ph-folder"></i>
                <span>${group.name}</span>
            </button>
        `).join('');

        this.container.innerHTML = defaultChip + groupChips;
        this.attachEventListeners();
    }

    /**
     * Update active state
     */
    updateActiveState() {
        if (!this.container) return;

        this.container.querySelectorAll('.group-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.group === this.activeGroup);
        });
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (!this.container) return;

        this.container.querySelectorAll('.group-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.selectGroup(chip.dataset.group);
            });
        });
    }

    /**
     * Reset to all photos
     */
    reset() {
        this.activeGroup = 'all';
        this.updateActiveState();
    }
}

export default { Tabs, GroupFilter };
