// ============================================================
//  js/auth.js
//  Login model: every teacher/CR registers with their own email
//  but ALL use the same shared password (set by admin).
//  Anyone who is logged in = staff. No role lookup needed.
// ============================================================
import { supabase } from './supabase.js';

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

// If logged in → 'teacher', if not → 'student'
// Simple: anyone who can log in with the shared password is staff
export async function getUserRole() {
  const user = await getUser();
  return user ? 'teacher' : 'student';
}

export function getDisplayEmail() {
  return localStorage.getItem('staff_display_email') || null;
}

export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('staff_display_email');
  window.location.href = '/';
}
