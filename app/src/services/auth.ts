import { supabase } from '../config/supabase';
import { User, UserProfile } from '../types';

/**
 * Login user with email and password
 */
export async function login(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('로그인에 실패했습니다.');
  }

  return data.user as User;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout error:', error);
  }
}

/**
 * Get current session
 * Handles invalid refresh token by clearing corrupted session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Session error:', error);

    // Handle invalid refresh token - clear corrupted session and force re-login
    if (error.message?.includes('Refresh Token Not Found') ||
        error.message?.includes('Invalid Refresh Token')) {
      console.log('Invalid refresh token detected, signing out...');
      await supabase.auth.signOut();
    }

    return null;
  }

  return session;
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user as User | null;
}

/**
 * Get user profile from public.users table
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Profile fetch error:', error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Update last sync timestamp
 */
export async function updateLastSync(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('Update last sync error:', error);
    throw new Error('스캔 시간 업데이트에 실패했습니다.');
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
