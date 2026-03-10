// ============================================================
//  js/rooms.js  —  All Supabase queries related to classrooms
// ============================================================
import { supabase } from './supabase.js';

// ── Fetch ALL classrooms (with current status) ───────────────
export async function getAllRooms() {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .order('room_number');
  if (error) throw error;
  return data;
}

// ── Fetch one room by ID ─────────────────────────────────────
export async function getRoomById(id) {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// ── Search by room number or building ────────────────────────
export async function searchRooms(query) {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .or(`room_number.ilike.%${query}%,building.ilike.%${query}%,department.ilike.%${query}%`);
  if (error) throw error;
  return data;
}

// ── Filter rooms ─────────────────────────────────────────────
export async function filterRooms({ building, department, status }) {
  let query = supabase.from('classrooms').select('*');
  if (building   && building   !== 'all') query = query.eq('building', building);
  if (department && department !== 'all') query = query.eq('department', department);
  if (status     && status     !== 'all') query = query.eq('status', status);
  const { data, error } = await query.order('room_number');
  if (error) throw error;
  return data;
}

// ── Dashboard counts ─────────────────────────────────────────
export async function getRoomStats() {
  const { data, error } = await supabase.from('classrooms').select('status');
  if (error) throw error;
  const total    = data.length;
  const vacant   = data.filter(r => r.status === 'vacant').length;
  const occupied = data.filter(r => r.status === 'occupied').length;
  const freeSoon = data.filter(r => r.status === 'free_soon').length;
  return { total, vacant, occupied, freeSoon };
}

// ── Update room status (teacher / CR only) ───────────────────
export async function updateRoomStatus(roomId, status, sessionInfo = null) {
  const updates = { status, updated_at: new Date().toISOString() };
  if (sessionInfo) {
    updates.current_subject  = sessionInfo.subject  || null;
    updates.current_faculty  = sessionInfo.faculty  || null;
    updates.session_start    = sessionInfo.start    || null;
    updates.session_end      = sessionInfo.end      || null;
  } else {
    // Clearing a room
    updates.current_subject  = null;
    updates.current_faculty  = null;
    updates.session_start    = null;
    updates.session_end      = null;
  }
  const { data, error } = await supabase
    .from('classrooms')
    .update(updates)
    .eq('id', roomId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Subscribe to real-time status changes ────────────────────
//    callback receives the updated row
export function subscribeToRoomChanges(callback) {
  return supabase
    .channel('classrooms-realtime')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'classrooms' },
      (payload) => callback(payload.new)
    )
    .subscribe();
}

// ── Get today's schedule for a room ──────────────────────────
export async function getRoomSchedule(roomId) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }); // e.g. "Monday"
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('room_id', roomId)
    .eq('day', today)
    .order('start_time');
  if (error) throw error;
  return data;
}
