// ============================================================
//  js/auth.js  —  Login / logout / session helpers
// ============================================================
import { supabase } from './supabase.js';

// ── Login with email + password ──────────────────────────────
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

// ── Logout ───────────────────────────────────────────────────
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/pages/login.html';
}

// ── Get current session user ─────────────────────────────────
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Get role stored in public.profiles ───────────────────────
//    role can be: 'student' | 'teacher' | 'cr'
export async function getUserRole() {
  const user = await getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) return null;
  return data.role;   // 'student' | 'teacher' | 'cr'
}

// ── Protect a page: redirect to login if not signed in ───────
export async function requireAuth() {
  const user = await getUser();
  if (!user) window.location.href = '/pages/login.html';
  return user;
}

// ── Protect a page: redirect if not teacher or CR ────────────
export async function requireEditor() {
  const role = await getUserRole();
  if (!role || role === 'student') {
    alert('Access denied. Only teachers and CRs can perform this action.');
    window.location.href = '/index.html';
  }
  return role;
}
