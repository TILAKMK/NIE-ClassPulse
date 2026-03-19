// ============================================================
//  js/rooms.js
//  FIXED: updateRoomStatus always sets session_end
//         so scheduler lock works even if teacher skips end time
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
    .or(`room_number.ilike.%${query}%,building.ilike.%${query}%`);
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
  };
}

export async function updateRoomStatus(roomId, status, sessionInfo = null) {
  const updates = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'occupied' && sessionInfo) {
    updates.current_subject = sessionInfo.subject || null;
    updates.current_faculty = sessionInfo.faculty || null;

    // Always store start time
    updates.session_start = sessionInfo.start ? sessionInfo.start + ':00' : null;

    // CRITICAL FIX: Always store an end time for scheduler lock to work
    // If teacher didn't enter end time → default to 1 hour from now
    if (sessionInfo.end) {
      updates.session_end = sessionInfo.end + ':00';
    } else if (sessionInfo.start) {
      // Add 1 hour to start time as default end
      const [h, m] = sessionInfo.start.split(':').map(Number);
      const endH = String((h + 1) % 24).padStart(2, '0');
      updates.session_end = `${endH}:${String(m).padStart(2,'0')}:00`;
    } else {
      // No times at all — lock for 1 hour from now IST
      const now = new Date();
      const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
      const istMs = utcMs + (5.5 * 60 * 60 * 1000);
      const ist = new Date(istMs + 60 * 60 * 1000); // +1 hour
      updates.session_end = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}:00`;
    }
  } else {
    // Marking vacant — clear everything
    updates.current_subject = null;
    updates.current_faculty = null;
    updates.session_start   = null;
    updates.session_end     = null;
  }

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
