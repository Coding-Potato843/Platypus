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
// Hash Utilities (Duplicate Detection)
// ============================================

/**
 * Calculate SHA-256 hash of a file using Web Crypto API
 * @param {File} file - File object to hash
 * @returns {Promise<string>} - Hex string of hash
 */
export async function calculateFileHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check which hashes already exist in database (batch query)
 * @param {string} userId - User ID
 * @param {string[]} hashes - Array of file hashes to check
 * @returns {Promise<Set<string>>} - Set of existing hashes
 */
export async function checkDuplicateHashes(userId, hashes) {
    console.log('[checkDuplicateHashes] Checking for userId:', userId, 'hashes count:', hashes?.length);

    if (!hashes || hashes.length === 0) {
        return new Set();
    }

    const { data, error } = await supabase
        .from('photos')
        .select('file_hash')
        .eq('user_id', userId)
        .in('file_hash', hashes);

    console.log('[checkDuplicateHashes] Result - data:', data, 'error:', error);

    if (error) {
        console.error('Error checking duplicate hashes:', error);
        return new Set();
    }

    const existingHashes = new Set(data.map(row => row.file_hash));
    console.log('[checkDuplicateHashes] Found existing hashes:', existingHashes.size);
    return existingHashes;
}

// ============================================
// Photo API (Supabase)
// ============================================

/**
 * Get user's photos from Supabase
 * @param {string} userId - User ID
 * @param {Object} params - Query parameters
 * @param {string} params.sortField - Sort field: 'date_taken' (촬영/다운로드 시간) or 'created_at' (업로드 시간)
 * @param {string} params.sortOrder - Sort order: 'asc' (오름차순) or 'desc' (내림차순)
 */
export async function getPhotos(userId, params = {}) {
    // Determine sort field and order
    const sortField = params.sortField || 'date_taken';
    const sortOrder = params.sortOrder || 'desc';
    const ascending = sortOrder === 'asc';

    let query = supabase
        .from('photos')
        .select(`
            *,
            photo_groups (group_id)
        `)
        .eq('user_id', userId)
        .order(sortField, { ascending });

    // Filter by location (partial match)
    if (params.location) {
        query = query.ilike('location', `%${params.location}%`);
    }

    // Filter by date range
    if (params.startDate) {
        query = query.gte('date_taken', params.startDate);
    }
    if (params.endDate) {
        query = query.lte('date_taken', params.endDate);
    }

    // Pagination - use range for offset+limit, otherwise just limit
    if (params.offset !== undefined && params.offset > 0) {
        const limit = params.limit || 50;
        query = query.range(params.offset, params.offset + limit - 1);
    } else if (params.limit) {
        query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) {
        throw new ApiError(500, error.message);
    }

    // Transform data to include groupIds array
    return data.map(photo => ({
        id: photo.id,
        url: photo.url,
        date: photo.date_taken,
        created_at: photo.created_at,
        location: photo.location || '알 수 없음',
        groupIds: photo.photo_groups?.map(pg => pg.group_id) || [],
        author: null, // Own photos have no author
    }));
}

/**
 * Get single photo by ID from Supabase
 */
export async function getPhoto(photoId) {
    const { data, error } = await supabase
        .from('photos')
        .select(`
            *,
            photo_groups (group_id)
        `)
        .eq('id', photoId)
        .single();

    if (error) {
        throw new ApiError(error.code === 'PGRST116' ? 404 : 500, error.message);
    }

    return {
        id: data.id,
        url: data.url,
        date: data.date_taken,
        location: data.location || '알 수 없음',
        groupIds: data.photo_groups?.map(pg => pg.group_id) || [],
        author: null,
    };
}

/**
 * Upload photo to Supabase Storage and create record
 * @param {string} userId - User ID
 * @param {File} file - File to upload
 * @param {Object} metadata - Photo metadata (date, location, fileHash)
 */
export async function uploadPhoto(userId, file, metadata = {}) {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file);

    if (uploadError) {
        throw new ApiError(500, `Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

    // Create photo record in database (with file_hash for duplicate detection)
    const { data: photoData, error: dbError } = await supabase
        .from('photos')
        .insert({
            user_id: userId,
            url: urlData.publicUrl,
            date_taken: metadata.date || new Date().toISOString(),
            location: metadata.location || null,
            file_hash: metadata.fileHash || null,
        })
        .select()
        .single();

    if (dbError) {
        // Rollback: delete uploaded file if DB insert fails
        await supabase.storage.from('photos').remove([fileName]);
        throw new ApiError(500, `Database error: ${dbError.message}`);
    }

    return {
        id: photoData.id,
        url: photoData.url,
        date: photoData.date_taken,
        location: photoData.location || '알 수 없음',
        groupIds: [],
        author: null,
    };
}

/**
 * Upload multiple photos with duplicate detection
 * @param {string} userId - User ID
 * @param {Array} photos - Array of {file, date, location} objects
 * @param {Function} onProgress - Progress callback (current, total, status)
 * @returns {Object} - { uploaded, errors, skipped }
 */
export async function uploadPhotos(userId, photos, onProgress) {
    const results = [];
    const errors = [];
    const skipped = [];

    // Step 1: Calculate hashes for all photos
    onProgress?.(0, photos.length, 'hashing');
    const photosWithHash = [];
    for (let i = 0; i < photos.length; i++) {
        try {
            const hash = await calculateFileHash(photos[i].file);
            photosWithHash.push({ ...photos[i], fileHash: hash });
        } catch (err) {
            console.warn(`Hash calculation failed for ${photos[i].file.name}:`, err);
            photosWithHash.push({ ...photos[i], fileHash: null });
        }
        onProgress?.(i + 1, photos.length, 'hashing');
    }

    // Step 2: Check for duplicates (batch query)
    const hashes = photosWithHash
        .map(p => p.fileHash)
        .filter(h => h !== null);
    const existingHashes = await checkDuplicateHashes(userId, hashes);

    // Step 3: Filter out duplicates
    const photosToUpload = [];
    for (const photo of photosWithHash) {
        if (photo.fileHash && existingHashes.has(photo.fileHash)) {
            skipped.push({ file: photo.file.name, reason: 'duplicate' });
        } else {
            photosToUpload.push(photo);
        }
    }

    // Step 4: Upload non-duplicate photos
    for (let i = 0; i < photosToUpload.length; i++) {
        const photo = photosToUpload[i];
        try {
            const result = await uploadPhoto(userId, photo.file, {
                date: photo.date,
                location: photo.location,
                fileHash: photo.fileHash,
            });
            results.push(result);
        } catch (error) {
            errors.push({ file: photo.file.name, error: error.message });
        }
        onProgress?.(i + 1, photosToUpload.length, 'uploading');
    }

    return { uploaded: results, errors, skipped };
}

/**
 * Delete photo from Supabase
 */
export async function deletePhoto(photoId, userId) {
    console.log('[deletePhoto] Starting delete for photoId:', photoId, 'userId:', userId);

    // First get the photo to find the storage path
    const { data: photo, error: fetchError } = await supabase
        .from('photos')
        .select('url')
        .eq('id', photoId)
        .eq('user_id', userId)
        .single();

    if (fetchError) {
        console.error('[deletePhoto] Fetch error:', fetchError);
        throw new ApiError(404, 'Photo not found');
    }

    console.log('[deletePhoto] Found photo:', photo);

    // Extract file path from URL
    const urlParts = photo.url.split('/photos/');
    const filePath = urlParts.length > 1 ? urlParts[1] : null;

    // Delete from database (cascade will handle photo_groups)
    const { data: deleteData, error: dbError, count } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', userId)
        .select();

    console.log('[deletePhoto] Delete result - data:', deleteData, 'error:', dbError, 'count:', count);

    if (dbError) {
        console.error('[deletePhoto] Database delete error:', dbError);
        throw new ApiError(500, dbError.message);
    }

    // Delete from storage
    if (filePath) {
        const { error: storageError } = await supabase.storage.from('photos').remove([filePath]);
        console.log('[deletePhoto] Storage delete result - error:', storageError);
    }

    return { success: true };
}

/**
 * Update photo's groups in Supabase
 */
export async function updatePhotoGroups(photoId, groupIds) {
    // Delete existing group assignments
    const { error: deleteError } = await supabase
        .from('photo_groups')
        .delete()
        .eq('photo_id', photoId);

    if (deleteError) {
        throw new ApiError(500, deleteError.message);
    }

    // Insert new group assignments
    if (groupIds.length > 0) {
        const insertData = groupIds.map(groupId => ({
            photo_id: photoId,
            group_id: groupId,
        }));

        const { error: insertError } = await supabase
            .from('photo_groups')
            .insert(insertData);

        if (insertError) {
            throw new ApiError(500, insertError.message);
        }
    }

    return { success: true };
}

/**
 * Add multiple photos to a group (batch operation)
 * @param {string} groupId - Target group ID
 * @param {string[]} photoIds - Array of photo IDs to add
 * @returns {Promise<Object>} - { success: true, added: number }
 */
export async function addPhotosToGroup(groupId, photoIds) {
    if (!photoIds || photoIds.length === 0) {
        return { success: true, added: 0 };
    }

    // Create insert data (photo_groups junction table)
    const insertData = photoIds.map(photoId => ({
        photo_id: photoId,
        group_id: groupId,
    }));

    // Use upsert to handle potential duplicates gracefully
    const { error } = await supabase
        .from('photo_groups')
        .upsert(insertData, { onConflict: 'photo_id,group_id' });

    if (error) {
        throw new ApiError(500, error.message);
    }

    return { success: true, added: photoIds.length };
}

// ============================================
// Group API (Supabase)
// ============================================

/**
 * Get user's groups from Supabase
 */
export async function getGroups(userId) {
    const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        throw new ApiError(500, error.message);
    }

    return data.map(group => ({
        id: group.id,
        name: group.name,
    }));
}

/**
 * Create new group in Supabase
 */
export async function createGroup(userId, name) {
    const { data, error } = await supabase
        .from('groups')
        .insert({
            user_id: userId,
            name: name,
        })
        .select()
        .single();

    if (error) {
        throw new ApiError(500, error.message);
    }

    return {
        id: data.id,
        name: data.name,
    };
}

/**
 * Update group name in Supabase
 */
export async function updateGroup(groupId, userId, name) {
    const { data, error } = await supabase
        .from('groups')
        .update({ name })
        .eq('id', groupId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) {
        throw new ApiError(500, error.message);
    }

    return {
        id: data.id,
        name: data.name,
    };
}

/**
 * Delete group from Supabase
 */
export async function deleteGroup(groupId, userId) {
    // photo_groups entries will be deleted by cascade or we delete them first
    const { error: pgError } = await supabase
        .from('photo_groups')
        .delete()
        .eq('group_id', groupId);

    if (pgError) {
        console.warn('Error deleting photo_groups:', pgError);
    }

    const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId)
        .eq('user_id', userId);

    if (error) {
        throw new ApiError(500, error.message);
    }

    return { success: true };
}

// ============================================
// Friends API (Supabase) - Bidirectional Friend Request System
// ============================================

/**
 * Get user's accepted friends from Supabase (bidirectional)
 * Returns friends from both directions where status is 'accepted'
 */
export async function getFriends(userId) {
    // Get friendships where user is the sender
    const { data: sentData, error: sentError } = await supabase
        .from('friendships')
        .select(`
            friend_id,
            users!friendships_friend_id_fkey (
                id, username, user_id, avatar_url
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

    // Get friendships where user is the receiver
    const { data: receivedData, error: receivedError } = await supabase
        .from('friendships')
        .select(`
            user_id,
            users!friendships_user_id_fkey (
                id, username, user_id, avatar_url
            )
        `)
        .eq('friend_id', userId)
        .eq('status', 'accepted');

    if (sentError) throw new ApiError(500, sentError.message);
    if (receivedError) throw new ApiError(500, receivedError.message);

    const friends = [
        ...(sentData || []).map(f => ({
            id: f.friend_id,
            name: f.users?.username || 'Unknown',
            username: f.users?.user_id || '',
            avatar: f.users?.avatar_url || null,
        })),
        ...(receivedData || []).map(f => ({
            id: f.user_id,
            name: f.users?.username || 'Unknown',
            username: f.users?.user_id || '',
            avatar: f.users?.avatar_url || null,
        })),
    ];

    // Deduplicate by id
    const seen = new Set();
    return friends.filter(f => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
    });
}

/**
 * Get friends' photos from Supabase (bidirectional)
 */
export async function getFriendsPhotos(userId, params = {}) {
    // Get accepted friend IDs with usernames (both directions)
    const { data: sent, error: e1 } = await supabase
        .from('friendships')
        .select(`
            friend_id,
            users!friendships_friend_id_fkey (username)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

    const { data: received, error: e2 } = await supabase
        .from('friendships')
        .select(`
            user_id,
            users!friendships_user_id_fkey (username)
        `)
        .eq('friend_id', userId)
        .eq('status', 'accepted');

    if (e1) throw new ApiError(500, e1.message);
    if (e2) throw new ApiError(500, e2.message);

    // Build friendId → username map
    const friendNameMap = {};
    const friendIds = [];

    (sent || []).forEach(f => {
        friendIds.push(f.friend_id);
        friendNameMap[f.friend_id] = f.users?.username || 'Unknown';
    });
    (received || []).forEach(f => {
        friendIds.push(f.user_id);
        friendNameMap[f.user_id] = f.users?.username || 'Unknown';
    });

    const uniqueFriendIds = [...new Set(friendIds)];

    if (uniqueFriendIds.length === 0) {
        return [];
    }

    // Get photos without FK join on users (avoids dependency on photos_user_id_fkey)
    let query = supabase
        .from('photos')
        .select('*')
        .in('user_id', uniqueFriendIds)
        .order('date_taken', { ascending: false });

    // Pagination - use range for offset+limit, otherwise just limit
    if (params.offset !== undefined && params.offset > 0) {
        const limit = params.limit || 50;
        query = query.range(params.offset, params.offset + limit - 1);
    } else if (params.limit) {
        query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) {
        throw new ApiError(500, error.message);
    }

    return data.map(photo => ({
        id: photo.id,
        url: photo.url,
        date: photo.date_taken,
        created_at: photo.created_at,
        location: photo.location || '알 수 없음',
        groupIds: [],
        author: friendNameMap[photo.user_id] || 'Unknown',
    }));
}

/**
 * Send a friend request (creates pending friendship)
 */
export async function sendFriendRequest(userId, friendId) {
    // Check if friend user exists
    const { data: friendUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', friendId)
        .single();

    if (userError || !friendUser) {
        throw new ApiError(404, 'User not found');
    }

    // Check if friendship exists in EITHER direction
    const { data: existing1 } = await supabase
        .from('friendships')
        .select('id, status')
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        .maybeSingle();

    if (existing1) {
        if (existing1.status === 'accepted') throw new ApiError(400, 'Already friends');
        throw new ApiError(400, 'Request already sent');
    }

    const { data: existing2 } = await supabase
        .from('friendships')
        .select('id, status')
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .maybeSingle();

    if (existing2) {
        if (existing2.status === 'accepted') throw new ApiError(400, 'Already friends');
        throw new ApiError(400, 'They already sent you a request');
    }

    // Insert with pending status
    const { error } = await supabase
        .from('friendships')
        .insert({
            user_id: userId,
            friend_id: friendId,
            status: 'pending',
        });

    if (error) {
        throw new ApiError(500, error.message);
    }

    return { success: true };
}

/**
 * Accept a friend request (only the receiver can accept)
 */
export async function acceptFriendRequest(userId, friendshipId) {
    const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)
        .eq('friend_id', userId)
        .eq('status', 'pending');

    if (error) {
        throw new ApiError(500, error.message);
    }

    return { success: true };
}

/**
 * Reject a friend request (only the receiver can reject)
 */
export async function rejectFriendRequest(userId, friendshipId) {
    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .eq('friend_id', userId);

    if (error) {
        throw new ApiError(500, error.message);
    }

    return { success: true };
}

/**
 * Cancel a sent friend request (only the sender can cancel)
 */
export async function cancelFriendRequest(userId, friendshipId) {
    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .eq('user_id', userId)
        .eq('status', 'pending');

    if (error) {
        throw new ApiError(500, error.message);
    }

    return { success: true };
}

/**
 * Get pending friend requests (both sent and received)
 */
export async function getPendingRequests(userId) {
    // Received requests (others sent to me)
    const { data: received, error: e1 } = await supabase
        .from('friendships')
        .select(`
            id,
            user_id,
            created_at,
            users!friendships_user_id_fkey (
                id, username, user_id, avatar_url
            )
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    // Sent requests (I sent to others)
    const { data: sent, error: e2 } = await supabase
        .from('friendships')
        .select(`
            id,
            friend_id,
            created_at,
            users!friendships_friend_id_fkey (
                id, username, user_id, avatar_url
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (e1) throw new ApiError(500, e1.message);
    if (e2) throw new ApiError(500, e2.message);

    return {
        received: (received || []).map(r => ({
            friendshipId: r.id,
            userId: r.user_id,
            name: r.users?.username || 'Unknown',
            username: r.users?.user_id || '',
            avatar: r.users?.avatar_url || null,
            createdAt: r.created_at,
        })),
        sent: (sent || []).map(s => ({
            friendshipId: s.id,
            userId: s.friend_id,
            name: s.users?.username || 'Unknown',
            username: s.users?.user_id || '',
            avatar: s.users?.avatar_url || null,
            createdAt: s.created_at,
        })),
    };
}

/**
 * Get friendship statuses for multiple users (batch query for search results)
 */
export async function getFriendshipStatuses(userId, otherUserIds) {
    if (!otherUserIds || otherUserIds.length === 0) return {};

    // Check sent requests/friendships
    const { data: sent } = await supabase
        .from('friendships')
        .select('id, friend_id, status')
        .eq('user_id', userId)
        .in('friend_id', otherUserIds);

    // Check received requests/friendships
    const { data: received } = await supabase
        .from('friendships')
        .select('id, user_id, status')
        .eq('friend_id', userId)
        .in('user_id', otherUserIds);

    const statusMap = {};
    (sent || []).forEach(r => {
        statusMap[r.friend_id] = { friendshipId: r.id, status: r.status, direction: 'sent' };
    });
    (received || []).forEach(r => {
        statusMap[r.user_id] = { friendshipId: r.id, status: r.status, direction: 'received' };
    });
    return statusMap;
}

/**
 * Search users by username or user_id
 */
export async function searchUsers(searchTerm) {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, user_id, avatar_url')
        .or(`username.ilike.%${searchTerm}%,user_id.ilike.%${searchTerm}%`)
        .limit(10);

    if (error) {
        throw new ApiError(500, error.message);
    }

    return data.map(user => ({
        id: user.id,
        name: user.username,
        username: user.user_id,
        avatar: user.avatar_url,
    }));
}

/**
 * Remove an accepted friend (bidirectional - tries both directions)
 */
export async function removeFriend(userId, friendId) {
    // Try deleting where user is user_id
    const { error: error1 } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        .eq('status', 'accepted');

    // Try deleting where user is friend_id
    const { error: error2 } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .eq('status', 'accepted');

    if (error1 && error2) {
        throw new ApiError(500, error1.message);
    }

    return { success: true };
}

// ============================================
// User API (Supabase)
// ============================================

/**
 * Get user profile from Supabase
 */
export async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        throw new ApiError(error.code === 'PGRST116' ? 404 : 500, error.message);
    }

    return data;
}

/**
 * Update user profile in Supabase
 */
export async function updateUserProfile(userId, updates) {
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new ApiError(500, error.message);
    }

    return data;
}

/**
 * Update last sync time in Supabase
 */
export async function updateLastSync(userId) {
    const { data, error } = await supabase
        .from('users')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new ApiError(500, error.message);
    }

    return data;
}

/**
 * Delete user account and all associated data from Supabase
 * This deletes: photos (storage + db), groups, photo_groups, friendships, users record
 */
export async function deleteUserAccount(userId) {
    // 1. Get all user's photos (for storage deletion and photo_groups)
    const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('id, url')
        .eq('user_id', userId);

    if (photosError) {
        console.error('Error fetching photos for deletion:', photosError);
    }

    // 2. Delete photos from storage
    if (photos && photos.length > 0) {
        const filePaths = photos
            .map(photo => {
                const urlParts = photo.url.split('/photos/');
                return urlParts.length > 1 ? urlParts[1] : null;
            })
            .filter(path => path !== null);

        if (filePaths.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('photos')
                .remove(filePaths);

            if (storageError) {
                console.error('Error deleting photos from storage:', storageError);
            }
        }

        // 3. Delete photo_groups (junction table) using photo IDs
        const photoIds = photos.map(p => p.id);
        if (photoIds.length > 0) {
            const { error: pgError } = await supabase
                .from('photo_groups')
                .delete()
                .in('photo_id', photoIds);

            if (pgError) {
                console.warn('Error deleting photo_groups:', pgError);
            }
        }
    }

    // 4. Delete photos from database
    const { error: photosDbError } = await supabase
        .from('photos')
        .delete()
        .eq('user_id', userId);

    if (photosDbError) {
        throw new ApiError(500, `Failed to delete photos: ${photosDbError.message}`);
    }

    // 5. Delete groups
    const { error: groupsError } = await supabase
        .from('groups')
        .delete()
        .eq('user_id', userId);

    if (groupsError) {
        throw new ApiError(500, `Failed to delete groups: ${groupsError.message}`);
    }

    // 6. Delete friendships (where user is the owner)
    const { error: friendships1Error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', userId);

    if (friendships1Error) {
        console.warn('Error deleting friendships (user_id):', friendships1Error);
    }

    // 7. Delete friendships (where user is the friend)
    const { error: friendships2Error } = await supabase
        .from('friendships')
        .delete()
        .eq('friend_id', userId);

    if (friendships2Error) {
        console.warn('Error deleting friendships (friend_id):', friendships2Error);
    }

    // 8. Delete user profile from public.users
    const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

    if (userError) {
        throw new ApiError(500, `Failed to delete user profile: ${userError.message}`);
    }

    // 9. Delete from auth.users via RPC function
    const { error: authError } = await supabase.rpc('delete_user_auth');

    if (authError) {
        console.warn('Error deleting auth user (RPC may not exist):', authError);
        // Don't throw - public data is already deleted
    }

    return { success: true };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 MB';

    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);

    return `${value.toFixed(1)} ${units[i]}`;
}

/**
 * Get user stats (photo count, friend count, storage)
 */
export async function getUserStats(userId) {
    // Get photo count
    const { count: photoCount, error: photoError } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    // Get friend count (bidirectional - accepted only)
    const { count: sentCount, error: sentFriendError } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'accepted');

    const { count: receivedCount, error: receivedFriendError } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', userId)
        .eq('status', 'accepted');

    const friendCount = (sentCount || 0) + (receivedCount || 0);
    const friendError = sentFriendError || receivedFriendError;

    // Get storage used from user's folder
    let storageUsed = '0 MB';
    try {
        const { data: files, error: storageError } = await supabase.storage
            .from('photos')
            .list(userId, { limit: 1000 });

        if (!storageError && files) {
            const totalBytes = files.reduce((sum, file) => {
                return sum + (file.metadata?.size || 0);
            }, 0);
            storageUsed = formatBytes(totalBytes);
        }
    } catch (e) {
        console.warn('Error calculating storage:', e);
    }

    if (photoError || friendError) {
        console.warn('Error fetching stats:', photoError, friendError);
    }

    return {
        photoCount: photoCount || 0,
        friendCount: friendCount || 0,
        storageUsed,
    };
}

// ============================================
// Realtime Subscriptions
// ============================================

// Store active subscriptions for cleanup
let realtimeChannel = null;

/**
 * Subscribe to realtime database changes
 * @param {string} userId - Current user ID
 * @param {Object} callbacks - Callback functions for each event type
 * @param {Function} callbacks.onPhotosChange - Called when photos table changes
 * @param {Function} callbacks.onFriendshipsChange - Called when friendships table changes
 * @param {Function} callbacks.onGroupsChange - Called when groups table changes
 * @param {Function} callbacks.onPhotoGroupsChange - Called when photo_groups table changes
 * @returns {Object} - Subscription channel for cleanup
 */
export function subscribeToRealtimeChanges(userId, callbacks = {}) {
    // Unsubscribe from existing channel if any
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    const channel = supabase.channel('db-changes');

    // Subscribe to photos table changes (own photos)
    if (callbacks.onPhotosChange) {
        channel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'photos',
                filter: `user_id=eq.${userId}`
            },
            (payload) => {
                console.log('📸 Photos change detected:', payload.eventType);
                callbacks.onPhotosChange(payload);
            }
        );
    }

    // Subscribe to friendships table changes (as sender)
    if (callbacks.onFriendshipsChange) {
        channel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'friendships',
                filter: `user_id=eq.${userId}`
            },
            (payload) => {
                console.log('👥 Friendships change (sent) detected:', payload.eventType);
                callbacks.onFriendshipsChange(payload);
            }
        );

        // Subscribe to friendships table changes (as receiver)
        channel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'friendships',
                filter: `friend_id=eq.${userId}`
            },
            (payload) => {
                console.log('👥 Friendships change (received) detected:', payload.eventType);
                callbacks.onFriendshipsChange(payload);
            }
        );
    }

    // Subscribe to groups table changes
    if (callbacks.onGroupsChange) {
        channel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'groups',
                filter: `user_id=eq.${userId}`
            },
            (payload) => {
                console.log('📁 Groups change detected:', payload.eventType);
                callbacks.onGroupsChange(payload);
            }
        );
    }

    // Subscribe to photo_groups table changes (for group assignments)
    if (callbacks.onPhotoGroupsChange) {
        channel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'photo_groups'
            },
            (payload) => {
                console.log('🔗 Photo-Groups change detected:', payload.eventType);
                callbacks.onPhotoGroupsChange(payload);
            }
        );
    }

    // Subscribe to the channel
    channel.subscribe((status) => {
        console.log('🔌 Realtime subscription status:', status);
    });

    realtimeChannel = channel;
    return channel;
}

/**
 * Subscribe to friends' photos changes
 * This requires a separate subscription since we need to watch multiple user_ids
 * @param {Array<string>} friendIds - Array of friend user IDs
 * @param {Function} onFriendPhotosChange - Callback when friend uploads a photo
 * @returns {Object} - Subscription channel
 */
let friendPhotosChannel = null;

export function subscribeToFriendPhotos(friendIds, onFriendPhotosChange) {
    // Unsubscribe from existing channel if any
    if (friendPhotosChannel) {
        supabase.removeChannel(friendPhotosChannel);
        friendPhotosChannel = null;
    }

    if (!friendIds || friendIds.length === 0) {
        return null;
    }

    const channel = supabase.channel('friend-photos-changes');

    // Subscribe to each friend's photos
    // Note: Supabase realtime filter supports `in` operator
    channel.on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'photos',
            filter: `user_id=in.(${friendIds.join(',')})`
        },
        (payload) => {
            console.log('📸 Friend photo added:', payload);
            if (onFriendPhotosChange) {
                onFriendPhotosChange(payload);
            }
        }
    );

    channel.subscribe((status) => {
        console.log('🔌 Friend photos subscription status:', status);
    });

    friendPhotosChannel = channel;
    return channel;
}

/**
 * Unsubscribe from all realtime channels
 */
export function unsubscribeFromRealtime() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
        console.log('🔌 Unsubscribed from main realtime channel');
    }
    if (friendPhotosChannel) {
        supabase.removeChannel(friendPhotosChannel);
        friendPhotosChannel = null;
        console.log('🔌 Unsubscribed from friend photos channel');
    }
}

// ============================================
// Export all
// ============================================

export default {
    supabase,
    ApiError,

    // Photos
    getPhotos,
    getPhoto,
    uploadPhoto,
    uploadPhotos,
    deletePhoto,
    updatePhotoGroups,
    addPhotosToGroup,

    // Hash utilities
    calculateFileHash,
    checkDuplicateHashes,

    // Groups
    getGroups,
    createGroup,
    updateGroup,
    deleteGroup,

    // Friends
    getFriends,
    getFriendsPhotos,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    getPendingRequests,
    getFriendshipStatuses,
    removeFriend,
    searchUsers,

    // User
    getUserProfile,
    updateUserProfile,
    updateLastSync,
    getUserStats,
    deleteUserAccount,

    // Realtime
    subscribeToRealtimeChanges,
    subscribeToFriendPhotos,
    unsubscribeFromRealtime,
};
