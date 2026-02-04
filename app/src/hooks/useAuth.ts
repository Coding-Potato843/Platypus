import { useState, useEffect, useCallback } from 'react';
import { User, UserProfile } from '../types';
import {
  getSession,
  getCurrentUser,
  getUserProfile,
  login as authLogin,
  logout as authLogout,
  onAuthStateChange
} from '../services/auth';

interface UseAuthReturn {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load profile for user
  const loadProfile = useCallback(async (userId: string) => {
    const userProfile = await getUserProfile(userId);
    setProfile(userProfile);
  }, []);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const session = await getSession();
        if (session?.user && mounted) {
          setUser(session.user as User);
          await loadProfile(session.user.id);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user as User);
        await loadProfile(session.user.id);
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        // TOKEN_REFRESHED with no session means refresh failed
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const loggedInUser = await authLogin(email, password);
      setUser(loggedInUser);
      await loadProfile(loggedInUser.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  // Logout function
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authLogout();
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    profile,
    loading,
    error,
    login,
    logout,
    refreshProfile,
  };
}
