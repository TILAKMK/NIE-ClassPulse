// ============================================================
//  js/rooms.js — FINAL FIXED VERSION
//  Key fix: session_end is ALWAYS set when marking occupied
//  so the scheduler lock always works
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
    updates.session_start   = sessionInfo.start ? sessionInfo.start + ':00' : null;

    // CRITICAL — always set session_end so scheduler lock works
    if (sessionInfo.end && sessionInfo.end.length >= 4) {
      updates.session_end = sessionInfo.end + ':00';
    } else if (sessionInfo.start && sessionInfo.start.length >= 4) {
      // Default: 1 hour after start
      const [h, m] = sessionInfo.start.split(':').map(Number);
      const endH = String((h + 1) % 24).padStart(2, '0');
      const endM = String(m).padStart(2, '0');
      updates.session_end = `${endH}:${endM}:00`;
    } else {
      // No times given — lock for 1 hour from now IST
      const now   = new Date();
      const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
      const ist   = new Date(utcMs + (5.5 * 60 * 60 * 1000) + (60 * 60 * 1000));
      updates.session_end = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}:00`;
    }
  } else {
    // Marking vacant — clear everything
    updates.current_subject = null;
    updates.current_faculty = null;
    updates.session_start   = null;
    updates.session_end     = null;
  }

  console.log('[rooms.js] Updating room:', roomId, updates);

  const { error } = await supabase
    .from('classrooms')
    .update(updates)
    .eq('id', roomId);

  if (error) {
    console.error('[rooms.js] Update error:', error.message);
    throw new Error(error.message);
  }
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
