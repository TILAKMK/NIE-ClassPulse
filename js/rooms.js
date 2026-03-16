// ============================================================
//  js/rooms.js — with occupancy_logs integration
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

    if (sessionInfo.end && sessionInfo.end.length >= 4) {
      updates.session_end = sessionInfo.end + ':00';
    } else if (sessionInfo.start && sessionInfo.start.length >= 4) {
      const [h, m] = sessionInfo.start.split(':').map(Number);
      const endH = String((h + 1) % 24).padStart(2, '0');
      const endM = String(m).padStart(2, '0');
      updates.session_end = `${endH}:${endM}:00`;
    } else {
      const now   = new Date();
      const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
      const ist   = new Date(utcMs + (5.5 * 60 * 60 * 1000) + (60 * 60 * 1000));
      updates.session_end = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}:00`;
    }
  } else {
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

  // ── Write to occupancy_logs ──────────────────────────
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const displayEmail = localStorage.getItem('staff_display_email') || user.email;

      const { data: roomRow } = await supabase
        .from('classrooms')
        .select('room_number')
        .eq('id', roomId)
        .single();

      const roomNumber = roomRow?.room_number || roomId;

      if (status === 'occupied') {
        await supabase.from('occupancy_logs').insert({
          room_id:     roomId,
          room_number: roomNumber,
          user_id:     user.id,
          user_name:   displayEmail,
          role:        'teacher',
          subject:     sessionInfo?.subject || null,
          start_time:  new Date().toISOString(),
          status:      'occupied'
        });
      } else {
        await supabase
          .from('occupancy_logs')
          .update({ status: 'released', end_time: new Date().toISOString() })
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .eq('status', 'occupied');
      }
    }
  } catch (logErr) {
    console.warn('[rooms.js] occupancy_logs write failed:', logErr.message);
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