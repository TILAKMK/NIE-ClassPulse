// ============================================================
//  js/rooms.js  —  All Supabase queries related to classrooms
// ============================================================
import { supabase } from './supabase.js';

export async function getAllRooms() {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .order('room_number');
  if (error) throw error;
  return data;
}

export async function getRoomById(id) {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function searchRooms(query) {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .or(
      `room_number.ilike.%${query}%,` +
      `building.ilike.%${query}%`
    );
  if (error) throw error;
  return data;
}

export async function filterRooms({ building, status }) {
  let q = supabase.from('classrooms').select('*');
  if (building && building !== 'all') q = q.eq('building', building);
  if (status   && status   !== 'all') q = q.eq('status', status);
  const { data, error } = await q.order('room_number');
  if (error) throw error;
  return data;
}

export async function getRoomStats() {
  const { data, error } = await supabase
    .from('classrooms')
    .select('status');
  if (error) throw error;
  return {
    total:    data.length,
    vacant:   data.filter(r => r.status === 'vacant').length,
    occupied: data.filter(r => r.status === 'occupied').length,
    freeSoon: 0,
  };
}

// ── Update room status — FIXED: removed .single() which caused JSON error
export async function updateRoomStatus(roomId, status, sessionInfo = null) {
  const updates = { status, updated_at: new Date().toISOString() };

  if (status === 'occupied' && sessionInfo) {
    updates.current_subject = sessionInfo.subject || null;
    updates.current_faculty = sessionInfo.faculty || null;
    updates.session_start   = sessionInfo.start   ? sessionInfo.start + ':00' : null;
    updates.session_end     = sessionInfo.end      ? sessionInfo.end   + ':00' : null;
  } else {
    updates.current_subject = null;
    updates.current_faculty = null;
    updates.session_start   = null;
    updates.session_end     = null;
  }

  // NO .single() — that's what caused "Cannot coerce to single JSON object"
  const { error } = await supabase
    .from('classrooms')
    .update(updates)
    .eq('id', roomId);

  if (error) throw new Error(error.message);
  return true;
}

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
