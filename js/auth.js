// ============================================================
//  auth.js — Simplified
//  Anyone logged in = has editor access
//  No role checks needed
// ============================================================
import { supabase } from './supabase.js';

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

// Anyone logged in = 'teacher' (editor access)
// Not logged in = 'student' (view only)
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
