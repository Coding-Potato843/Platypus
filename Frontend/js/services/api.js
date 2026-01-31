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
// Photo API (Supabase)
// ============================================

/**
 * Get user's photos from Supabase
 */
export async function getPhotos(userId, params = {}) {
    let query = supabase
        .from('photos')
        .select(`
            *,
            photo_groups (group_id)
        `)
        .eq('user_id', userId)
        .order('date_taken', { ascending: false });

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

    // Create photo record in database
    const { data: photoData, error: dbError } = await supabase
        .from('photos')
        .insert({
            user_id: userId,
            url: urlData.publicUrl,
            date_taken: metadata.date || new Date().toISOString(),
            location: metadata.location || null,
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
 * Upload multiple photos
 */
export async function uploadPhotos(userId, photos) {
    const results = [];
    const errors = [];

    for (const photo of photos) {
        try {
            const result = await uploadPhoto(userId, photo.file, {
                date: photo.date,
                location: photo.location,
            });
            results.push(result);
        } catch (error) {
            errors.push({ file: photo.file.name, error: error.message });
        }
    }

    return { uploaded: results, errors };
}

/**
 * Delete photo from Supabase
 */
export async function deletePhoto(photoId, userId) {
    // First get the photo to find the storage path
    const { data: photo, error: fetchError } = await supabase
        .from('photos')
        .select('url')
        .eq('id', photoId)
        .eq('user_id', userId)
        .single();

    if (fetchError) {
        throw new ApiError(404, 'Photo not found');
    }

    // Extract file path from URL
    const urlParts = photo.url.split('/photos/');
    const filePath = urlParts.length > 1 ? urlParts[1] : null;

    // Delete from database (cascade will handle photo_groups)
    const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', userId);

    if (dbError) {
        throw new ApiError(500, dbError.message);
    }

    // Delete from storage
    if (filePath) {
        await supabase.storage.from('photos').remove([filePath]);
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
// Friends API (Supabase)
// ============================================

/**
 * Get user's friends from Supabase
 */
export async function getFriends(userId) {
    const { data, error } = await supabase
        .from('friendships')
        .select(`
            friend_id,
            users!friendships_friend_id_fkey (
                id,
                username,
                user_id,
                avatar_url
            )
        `)
        .eq('user_id', userId);

    if (error) {
        throw new ApiError(500, error.message);
    }

    return data.map(f => ({
        id: f.friend_id,
        name: f.users?.username || 'Unknown',
        username: f.users?.user_id || '',
        avatar: f.users?.avatar_url || null,
    }));
}

/**
 * Get friends' photos from Supabase
 */
export async function getFriendsPhotos(userId, params = {}) {
    // First get friend IDs
    const { data: friendships, error: friendError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId);

    if (friendError) {
        throw new ApiError(500, friendError.message);
    }

    const friendIds = friendships.map(f => f.friend_id);

    if (friendIds.length === 0) {
        return [];
    }

    // Then get their photos
    let query = supabase
        .from('photos')
        .select(`
            *,
            users!photos_user_id_fkey (username)
        `)
        .in('user_id', friendIds)
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
        location: photo.location || '알 수 없음',
        groupIds: [],
        author: photo.users?.username || 'Unknown',
    }));
}

/**
 * Add friend in Supabase
 */
export async function addFriend(userId, friendId) {
    // Check if friend exists
    const { data: friendUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', friendId)
        .single();

    if (userError || !friendUser) {
        throw new ApiError(404, 'User not found');
    }

    // Check if already friends
    const { data: existing } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        .single();

    if (existing) {
        throw new ApiError(400, 'Already friends');
    }

    // Add friendship
    const { error } = await supabase
        .from('friendships')
        .insert({
            user_id: userId,
            friend_id: friendId,
        });

    if (error) {
        throw new ApiError(500, error.message);
    }

    return { success: true };
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
 * Remove friend from Supabase
 */
export async function removeFriend(userId, friendId) {
    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId);

    if (error) {
        throw new ApiError(500, error.message);
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
 * Get user stats (photo count, friend count, storage)
 */
export async function getUserStats(userId) {
    // Get photo count
    const { count: photoCount, error: photoError } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    // Get friend count
    const { count: friendCount, error: friendError } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (photoError || friendError) {
        console.warn('Error fetching stats:', photoError, friendError);
    }

    return {
        photoCount: photoCount || 0,
        friendCount: friendCount || 0,
        storageUsed: '계산 중...', // Storage calculation would require additional API
    };
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

    // Groups
    getGroups,
    createGroup,
    updateGroup,
    deleteGroup,

    // Friends
    getFriends,
    getFriendsPhotos,
    addFriend,
    removeFriend,
    searchUsers,

    // User
    getUserProfile,
    updateUserProfile,
    updateLastSync,
    getUserStats,
    deleteUserAccount,
};
