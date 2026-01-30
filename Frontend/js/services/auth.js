/**
 * Auth Service
 * Handles authentication and session management
 */

// Auth Configuration
const AUTH_CONFIG = {
    tokenKey: 'auth_token',
    userKey: 'auth_user',
    refreshTokenKey: 'refresh_token',
};

// Current user state
let currentUser = null;

/**
 * Initialize auth from stored session
 */
export function initAuth() {
    const storedUser = localStorage.getItem(AUTH_CONFIG.userKey);
    const storedToken = localStorage.getItem(AUTH_CONFIG.tokenKey);

    if (storedUser && storedToken) {
        try {
            currentUser = JSON.parse(storedUser);
            return true;
        } catch (e) {
            clearAuth();
            return false;
        }
    }

    return false;
}

/**
 * Register new user
 */
export async function register(email, password, username) {
    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new AuthError(error.message || '회원가입에 실패했습니다.');
        }

        const data = await response.json();
        setSession(data.user, data.token, data.refreshToken);

        return data.user;
    } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError('회원가입 중 오류가 발생했습니다.');
    }
}

/**
 * Login user
 */
export async function login(email, password) {
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new AuthError(error.message || '로그인에 실패했습니다.');
        }

        const data = await response.json();
        setSession(data.user, data.token, data.refreshToken);

        return data.user;
    } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError('로그인 중 오류가 발생했습니다.');
    }
}

/**
 * Logout user
 */
export async function logout() {
    try {
        const token = getToken();

        if (token) {
            await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        clearAuth();
    }
}

/**
 * Refresh access token
 */
export async function refreshToken() {
    const refreshToken = localStorage.getItem(AUTH_CONFIG.refreshTokenKey);

    if (!refreshToken) {
        throw new AuthError('리프레시 토큰이 없습니다.');
    }

    try {
        const response = await fetch('/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
            clearAuth();
            throw new AuthError('세션이 만료되었습니다. 다시 로그인해주세요.');
        }

        const data = await response.json();
        localStorage.setItem(AUTH_CONFIG.tokenKey, data.token);

        if (data.refreshToken) {
            localStorage.setItem(AUTH_CONFIG.refreshTokenKey, data.refreshToken);
        }

        return data.token;
    } catch (error) {
        clearAuth();
        throw new AuthError('세션이 만료되었습니다. 다시 로그인해주세요.');
    }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    return !!getToken() && !!currentUser;
}

/**
 * Get current user
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Get auth token
 */
export function getToken() {
    return localStorage.getItem(AUTH_CONFIG.tokenKey);
}

/**
 * Set session data
 */
function setSession(user, token, refreshToken = null) {
    currentUser = user;
    localStorage.setItem(AUTH_CONFIG.userKey, JSON.stringify(user));
    localStorage.setItem(AUTH_CONFIG.tokenKey, token);

    if (refreshToken) {
        localStorage.setItem(AUTH_CONFIG.refreshTokenKey, refreshToken);
    }
}

/**
 * Clear authentication data
 */
function clearAuth() {
    currentUser = null;
    localStorage.removeItem(AUTH_CONFIG.tokenKey);
    localStorage.removeItem(AUTH_CONFIG.userKey);
    localStorage.removeItem(AUTH_CONFIG.refreshTokenKey);
}

/**
 * Update current user data
 */
export function updateCurrentUser(updates) {
    if (currentUser) {
        currentUser = { ...currentUser, ...updates };
        localStorage.setItem(AUTH_CONFIG.userKey, JSON.stringify(currentUser));
    }
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

    if (!/[A-Z]/.test(password)) {
        errors.push('비밀번호에 대문자가 포함되어야 합니다.');
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

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errors.push('사용자명은 영문, 숫자, 밑줄(_)만 사용 가능합니다.');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

// ============================================
// Auth Guard for protected routes/actions
// ============================================

/**
 * Auth guard - redirects to login if not authenticated
 */
export function requireAuth(redirectUrl = '/login') {
    if (!isAuthenticated()) {
        // Store intended destination
        sessionStorage.setItem('auth_redirect', window.location.href);
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

/**
 * Handle post-login redirect
 */
export function handleLoginRedirect() {
    const redirect = sessionStorage.getItem('auth_redirect');
    sessionStorage.removeItem('auth_redirect');

    if (redirect) {
        window.location.href = redirect;
    } else {
        window.location.href = '/';
    }
}

// ============================================
// Export all
// ============================================

export default {
    initAuth,
    register,
    login,
    logout,
    refreshToken,
    isAuthenticated,
    getCurrentUser,
    getToken,
    updateCurrentUser,
    AuthError,
    validatePassword,
    validateEmail,
    validateUsername,
    requireAuth,
    handleLoginRedirect,
};
