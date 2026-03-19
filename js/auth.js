// ============================================================
//  auth.js — with getDashboardUrl helper
// ============================================================
import { supabase } from './supabase.js';

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getUserRole() {
  const user = await getUser();
  return user ? 'teacher' : 'student';
}

export function getDisplayEmail() {
  return localStorage.getItem('staff_display_email') || null;
}

export function getDashboardUrl(email) {
  const e = (email || '').toLowerCase();
  if (/^cr[._@]/.test(e) || e.includes('.cr@') || e.includes('cr.nie')) {
    return '/pages/user-dashboard.html?role=cr';
  }
  return '/pages/user-dashboard.html?role=teacher';
}

export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('staff_display_email');
  window.location.href = '/';
}