// ============================================================
//  js/rooms.js  —  All Supabase queries related to classrooms
// ============================================================
import { supabase } from './supabase.js';

// ── Fetch ALL classrooms ─────────────────────────────────────
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

// ── Search by room number, building, dept, section ───────────
export async function searchRooms(query) {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .or(
      `room_number.ilike.%${query}%,` +
      `building.ilike.%${query}%,` +
      `department.ilike.%${query}%,` +
      `section.ilike.%${query}%`
    );
  if (error) throw error;
  return data;
}

// ── Filter rooms ─────────────────────────────────────────────
export async function filterRooms({ building, department, status }) {
  let q = supabase.from('classrooms').select('*');
  if (building   && building   !== 'all') q = q.eq('building', building);
  if (department && department !== 'all') q = q.eq('department', department);
  if (status     && status     !== 'all') q = q.eq('status', status);
  const { data, error } = await q.order('room_number');
  if (error) throw error;
  return data;
}

// ── Dashboard stat counts ────────────────────────────────────
export async function getRoomStats() {
  const { data, error } = await supabase
    .from('classrooms')
    .select('status');
  if (error) throw error;
  return {
    total:    data.length,
    vacant:   data.filter(r => r.status === 'vacant').length,
    occupied: data.filter(r => r.status === 'occupied').length,
    freeSoon: data.filter(r => r.status === 'free_soon').length,
  };
}

// ── Update room status (teacher / CR only) ───────────────────
export async function updateRoomStatus(roomId, status, sessionInfo = null) {
  const updates = { status, updated_at: new Date().toISOString() };
  if (sessionInfo && status === 'occupied') {
    updates.current_subject = sessionInfo.subject || null;
    updates.current_faculty = sessionInfo.faculty || null;
    updates.session_start   = sessionInfo.start   || null;
    updates.session_end     = sessionInfo.end      || null;
  } else {
    updates.current_subject = null;
    updates.current_faculty = null;
    updates.session_start   = null;
    updates.session_end     = null;
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

// ── Real-time: fires callback whenever any classroom updates ─
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

// ── Today's schedule for a specific room ─────────────────────
export async function getRoomSchedule(roomId) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('room_id', roomId)
    .eq('day', today)
    .order('start_time');
  if (error) throw error;
  return data;
}
