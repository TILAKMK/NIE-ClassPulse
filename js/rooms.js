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
  
  await overlayActiveSchedules(data);
  return data;
}

export async function getRoomById(id) {
  let { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('id', id)
    .single();
  
  // Fallback to room_number if ID lookup fails or finds nothing
  if (error || !data) {
    console.log('[rooms.js] ID lookup failed, trying room_number:', id);
    const { data: alt, error: altErr } = await supabase
      .from('classrooms')
      .select('*')
      .eq('room_number', id)
      .single();
    
    if (altErr) {
      console.error('[rooms.js] Both ID and room_number lookups failed:', altErr.message);
      throw altErr;
    }
    data = alt;
  }
  
  if (data) await overlayActiveSchedules([data]);
  return data;
}

// Helper to overlay active timetable/bookings so we don't rely on client-side DB writes
async function overlayActiveSchedules(roomsArray) {
  try {
    const now = new Date();
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(now);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('room_number, subject, faculty, start_time, end_time, section')
      .eq('date', date)
      .lte('start_time', time + ':00')
      .gt('end_time', time + ':00');

    const { data: schedules } = await supabase
      .from('schedules')
      .select('room_number, subject, start_time, end_time, section')
      .eq('day', day)
      .lte('start_time', time + ':00')
      .gt('end_time', time + ':00');

    roomsArray.forEach(room => {
      let isLocked = false;
      if (room.manual_override && room.manual_override_until) {
        if (new Date().toISOString() < room.manual_override_until) isLocked = true;
      }
      
      if (!isLocked) {
        const book = bookings?.find(b => b.room_number === room.room_number);
        const sched = schedules?.find(s => s.room_number === room.room_number);
        
        if (book) {
          room.status = 'occupied';
          room.current_subject = book.subject;
          room.current_faculty = book.faculty;
          room.current_section = book.section || null;
          room.session_start = book.start_time;
          room.session_end = book.end_time;
        } else if (sched && !/lab/i.test(sched.subject || '')) {
          room.status = 'occupied';
          room.current_subject = sched.subject;
          room.current_faculty = null;
          room.current_section = sched.section || null;
          room.session_start = sched.start_time;
          room.session_end = sched.end_time;
        } else {
          room.status = 'vacant';
          room.current_subject = null;
          room.current_faculty = null;
          room.current_section = null;
          room.session_start = null;
          room.session_end = null;
        }
      }
    });
  } catch (err) {
    console.error('[rooms.js] Error overlaying schedules:', err);
  }
}

export async function getRoomStats() {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*');
  if (error) throw error;
  
  // Apply dynamic overlays so we have the true session_start and session_end
  await overlayActiveSchedules(data);
  
  // Apply time-based status logic to calculate actual occupied/vacant counts
  // This must match the logic used in room cards (getActualRoomStatus)
  let vacant = 0;
  let occupied = 0;
  
  data.forEach(room => {
    const actualStatus = getActualRoomStatus(room);
    if (actualStatus === 'VACANT') {
      vacant++;
    } else if (actualStatus === 'OCCUPIED') {
      occupied++;
    }
  });
  
  return {
    total:    data.length,
    vacant:   vacant,
    occupied: occupied,
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
    updates.current_section = sessionInfo.section || null;
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

    // Set manual override
    updates.manual_override = true;
    if (updates.session_end) {
      const [h, m] = updates.session_end.split(':').map(Number);
      
      let overrideUntil;
      if (sessionInfo.date) {
        // Use provided date
        const [yyyy, mm, dd] = sessionInfo.date.split('-').map(Number);
        overrideUntil = new Date(yyyy, mm - 1, dd, h, m, 0);
      } else {
        // Use today
        const d = new Date();
        overrideUntil = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0);
        // If end time is earlier than now without a specific date, it's likely for the next day
        if (overrideUntil < d) overrideUntil.setDate(overrideUntil.getDate() + 1);
      }
      
      updates.manual_override_until = overrideUntil.toISOString();
    }
  } else {
    updates.current_subject = null;
    updates.current_faculty = null;
    updates.current_section = null;
    updates.session_start   = null;
    updates.session_end     = null;
    updates.manual_override = false;
    updates.manual_override_until = null;
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

// ──────────────────────────────────────────────────────
// Utility: Calculate actual room status based on current time
// Returns: 'VACANT' | 'OCCUPIED'
// Logic:
//   - OCCUPIED if current time is within ANY session (timetable or reservation)
//   - VACANT otherwise (future or past bookings don't affect current status)
// ──────────────────────────────────────────────────────
export function getActualRoomStatus(room) {
  // If no session times, return database status
  if (!room.session_start || !room.session_end) {
    return room.status === 'vacant' ? 'VACANT' : 'OCCUPIED';
  }

  // Get current time in IST (India Standard Time)
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  const currentTimeStr = new Intl.DateTimeFormat('en-GB', options).format(new Date());

  // Parse session start and end times (format: HH:MM:SS or HH:MM)
  const startTimeStr = room.session_start.substring(0, 5);
  const endTimeStr = room.session_end.substring(0, 5);

  // Check if current time falls within the session (timetable or reservation)
  if (currentTimeStr >= startTimeStr && currentTimeStr < endTimeStr) {
    return 'OCCUPIED';
  }
  
  return 'VACANT';
}