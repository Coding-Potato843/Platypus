/**
 * API Service
 * Handles all API communication with the backend
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ============================================
// Supabase Configuration
// ============================================
const SUPABASE_URL = 'https://vtpgatnkobvjqwvoqtad.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cGdhdG5rb2J2anF3dm9xdGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NzQxNzIsImV4cCI6MjA4NTM1MDE3Mn0.Tc_lFbbkBrUusy2fI4XpNwxTXTGI2qfksU82y6AFyAQ';

// Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// Legacy API Configuration (for gradual migration)
// ============================================
const API_CONFIG = {
    baseUrl: '', // Will be set from environment
    timeout: 30000,
};

/**
 * Initialize API with configuration
 */
export function initApi(config = {}) {
    Object.assign(API_CONFIG, config);
}

/**
 * Get full API URL
 */
function getUrl(endpoint) {
    return `${API_CONFIG.baseUrl}${endpoint}`;
}

/**
 * Get auth headers
 */
function getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Make API request
 */
async function request(endpoint, options = {}) {
    const url = getUrl(endpoint);

    const config = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...options.headers,
        },
        ...options,
    };

    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new ApiError(response.status, error.message || 'API request failed');
        }

        return await response.json();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(0, error.message || 'Network error');
    }
}

/**
 * Custom API Error
 */
export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }

    isUnauthorized() {
        return this.status === 401;
    }

    isForbidden() {
        return this.status === 403;
    }

    isNotFound() {
        return this.status === 404;
    }

    isServerError() {
        return this.status >= 500;
    }
}

// ============================================
// Photo API
// ============================================

/**
 * Get user's photos
 */
export async function getPhotos(params = {}) {
    const queryParams = new URLSearchParams();

    if (params.groupId) queryParams.append('groupId', params.groupId);
    if (params.location) queryParams.append('location', params.location);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);

    const query = queryParams.toString();
    return request(`/photos${query ? `?${query}` : ''}`);
}

/**
 * Get single photo by ID
 */
export async function getPhoto(photoId) {
    return request(`/photos/${photoId}`);
}

/**
 * Upload photos
 */
export async function uploadPhotos(photos) {
    const formData = new FormData();

    photos.forEach((photo, index) => {
        formData.append(`photos[${index}]`, photo.file);
        if (photo.location) formData.append(`locations[${index}]`, photo.location);
        if (photo.date) formData.append(`dates[${index}]`, photo.date);
    });

    return request('/photos', {
        method: 'POST',
        headers: {}, // Let browser set content-type for FormData
        body: formData,
    });
}

/**
 * Delete photo
 */
export async function deletePhoto(photoId) {
    return request(`/photos/${photoId}`, { method: 'DELETE' });
}

/**
 * Update photo's groups
 */
export async function updatePhotoGroups(photoId, groupIds) {
    return request(`/photos/${photoId}/groups`, {
        method: 'PUT',
        body: { groupIds },
    });
}

// ============================================
// Group API
// ============================================

/**
 * Get user's groups
 */
export async function getGroups() {
    return request('/groups');
}

/**
 * Create new group
 */
export async function createGroup(name) {
    return request('/groups', {
        method: 'POST',
        body: { name },
    });
}

/**
 * Delete group
 */
export async function deleteGroup(groupId) {
    return request(`/groups/${groupId}`, { method: 'DELETE' });
}

// ============================================
// Friends API
// ============================================

/**
 * Get user's friends
 */
export async function getFriends() {
    return request('/friends');
}

/**
 * Get friends' photos
 */
export async function getFriendsPhotos(params = {}) {
    const queryParams = new URLSearchParams();

    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);

    const query = queryParams.toString();
    return request(`/friends/photos${query ? `?${query}` : ''}`);
}

/**
 * Add friend
 */
export async function addFriend(userId) {
    return request(`/friends/${userId}`, { method: 'POST' });
}

/**
 * Remove friend
 */
export async function removeFriend(userId) {
    return request(`/friends/${userId}`, { method: 'DELETE' });
}

// ============================================
// User API
// ============================================

/**
 * Get current user profile
 */
export async function getUserProfile() {
    return request('/user/profile');
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates) {
    return request('/user/profile', {
        method: 'PUT',
        body: updates,
    });
}

/**
 * Update last sync time
 */
export async function updateLastSync() {
    return request('/user/sync', { method: 'POST' });
}

// ============================================
// Sync API
// ============================================

/**
 * Get photos available for sync (from device)
 * This would typically interface with device APIs
 */
export async function getDevicePhotos(lastSyncTime = null) {
    // In a real implementation, this would:
    // 1. Access device's photo library
    // 2. Filter photos taken after lastSyncTime
    // 3. Return photo metadata

    // For now, return mock data
    return Promise.resolve([]);
}

/**
 * Sync selected photos to server
 */
export async function syncPhotos(photoIds) {
    return request('/photos/sync', {
        method: 'POST',
        body: { photoIds },
    });
}

// ============================================
// Export all
// ============================================

export default {
    initApi,
    ApiError,

    // Photos
    getPhotos,
    getPhoto,
    uploadPhotos,
    deletePhoto,
    updatePhotoGroups,

    // Groups
    getGroups,
    createGroup,
    deleteGroup,

    // Friends
    getFriends,
    getFriendsPhotos,
    addFriend,
    removeFriend,

    // User
    getUserProfile,
    updateUserProfile,
    updateLastSync,

    // Sync
    getDevicePhotos,
    syncPhotos,
};
