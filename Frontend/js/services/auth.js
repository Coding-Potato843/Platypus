/**
 * Auth Service
 * Handles authentication using Supabase Auth
 */

import { supabase } from './api.js';

// Current user state
let currentUser = null;

/**
 * Initialize auth - check for existing session
 * Handles invalid refresh token by clearing corrupted session
 */
export async function initAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Session error:', error);

            // Handle invalid refresh token - clear corrupted session and force re-login
            if (error.message?.includes('Refresh Token Not Found') ||
                error.message?.includes('Invalid Refresh Token')) {
                console.log('Invalid refresh token detected, signing out...');
                await supabase.auth.signOut();
            }

            return false;
        }

        if (session?.user) {
            currentUser = session.user;
            return true;
        }

        return false;
    } catch (error) {
        console.error('Init auth error:', error);
        return false;
    }
}

/**
 * Generate a unique user_id based on display name.
 * Converts to lowercase alphanumeric/underscore, appends random suffix,
 * and retries if a collision occurs.
 */
async function generateUniqueUserId(displayName) {
    // Convert display name to a base ID (lowercase, alphanumeric and underscore only)
    const base = displayName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 12) || 'user';

    for (let attempt = 0; attempt < 5; attempt++) {
        const suffix = Math.random().toString(36).slice(2, 6);
        const candidate = `${base}_${suffix}`;

        const { data } = await supabase
            .from('users')
            .select('id')
            .eq('user_id', candidate)
            .maybeSingle();

        if (!data) return candidate;
    }

    // Fallback: use timestamp for guaranteed uniqueness
    return `${base}_${Date.now().toString(36)}`;
}

/**
 * Register new user
 */
export async function register(email, password, displayName) {
    try {
        // 1. Generate unique user_id
        const userId = await generateUniqueUserId(displayName);

        // 2. Sign up with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: userId,
                    display_name: displayName,
                }
            }
        });

        if (error) {
            throw new AuthError(error.message);
        }

        if (!data.user) {
            throw new AuthError('회원가입에 실패했습니다.');
        }

        // 이미 존재하는 이메일인 경우 identities가 빈 배열로 반환됨
        if (data.user.identities?.length === 0) {
            throw new AuthError('이미 사용 중인 이메일입니다.');
        }

        // 3. Update user profile in public.users table
        // The handle_new_user trigger creates the record first,
        // so we upsert to overwrite with the actual display name and generated user_id.
        const { error: profileError } = await supabase
            .from('users')
            .upsert({
                id: data.user.id,
                email: email,
                username: displayName,
                user_id: userId,
            }, { onConflict: 'id' });

        if (profileError) {
            console.error('Profile creation error:', profileError);
        }

        currentUser = data.user;
        return data.user;

    } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError(error.message || '회원가입 중 오류가 발생했습니다.');
    }
}

/**
 * Login user
 */
export async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                throw new AuthError('이메일 또는 비밀번호가 올바르지 않습니다.');
            }
            throw new AuthError(error.message);
        }

        if (!data.user) {
            throw new AuthError('로그인에 실패했습니다.');
        }

        currentUser = data.user;
        return data.user;

    } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError(error.message || '로그인 중 오류가 발생했습니다.');
    }
}

/**
 * Logout user
 */
export async function logout() {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Logout error:', error);
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        currentUser = null;
    }
}

/**
 * Delete user account
 * Note: This deletes all user data from public tables.
 * The auth.users record requires admin privileges or RPC function to delete.
 */
export async function deleteAccount() {
    if (!currentUser) {
        throw new AuthError('로그인이 필요합니다.');
    }

    const userId = currentUser.id;

    try {
        // Import deleteUserAccount dynamically to avoid circular dependency
        const { deleteUserAccount } = await import('./api.js');

        // Delete all user data from public tables
        await deleteUserAccount(userId);

        // Sign out the user
        await supabase.auth.signOut();

        currentUser = null;

        return { success: true };
    } catch (error) {
        console.error('Delete account error:', error);
        throw new AuthError(error.message || '계정 삭제 중 오류가 발생했습니다.');
    }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    return !!currentUser;
}

/**
 * Get current user
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Get current user's profile from database
 */
export async function getCurrentUserProfile() {
    if (!currentUser) return null;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) {
            console.error('Profile fetch error:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Profile fetch error:', error);
        return null;
    }
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            currentUser = session.user;
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
        }
        callback(event, session);
    });
}

/**
 * Custom Auth Error
 */
export class AuthError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthError';
    }
}

/**
 * Password validation
 */
export function validatePassword(password) {
    const errors = [];

    if (password.length < 8) {
        errors.push('비밀번호는 최소 8자 이상이어야 합니다.');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('비밀번호에 특수문자가 포함되어야 합니다.');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('비밀번호에 소문자가 포함되어야 합니다.');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('비밀번호에 숫자가 포함되어야 합니다.');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Email validation
 */
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Username validation
 */
export function validateUsername(username) {
    const errors = [];

    if (username.length < 3) {
        errors.push('사용자명은 최소 3자 이상이어야 합니다.');
    }

    if (username.length > 20) {
        errors.push('사용자명은 최대 20자까지 가능합니다.');
    }

    if (!/^[a-zA-Z0-9_가-힣]+$/.test(username)) {
        errors.push('사용자명은 한글, 영문, 숫자, 밑줄(_)만 사용 가능합니다.');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

// ============================================
// Export all
// ============================================

export default {
    initAuth,
    register,
    login,
    logout,
    deleteAccount,
    isAuthenticated,
    getCurrentUser,
    getCurrentUserProfile,
    onAuthStateChange,
    AuthError,
    validatePassword,
    validateEmail,
    validateUsername,
};
