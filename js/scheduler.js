// ============================================================
//  js/scheduler.js — FINAL FIXED VERSION
//
//  Rules:
//  1. If room.manual_override is true AND current time < manual_override_until
//     → SKIP (staff lock is active)
//  2. If override is expired OR false
//     → Apply timetable logic (scheduler controls status)
//  3. Manual Vacate resets override immediately via rooms.js
// ============================================================
import { supabase } from './supabase.js';

const SLOTS = [
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:30', end: '12:30' },
  { start: '12:30', end: '13:30' },
  { start: '14:30', end: '15:30' },
  { start: '15:30', end: '16:30' },
  { start: '16:30', end: '17:30' },
];

function isLab(subject) {
  return /lab/i.test(subject || '');
}

// Get IST time, day, and date — works correctly on any server or device
function getIST() {
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(now);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { time, day, date };
}

// THE KEY FUNCTION — is this room manually locked by staff?
function isManuallyLocked(room) {
  if (!room.manual_override) return false;
  if (!room.manual_override_until) return false;

  const now = new Date().toISOString();
  // If current time is strictly BEFORE the override end time, it is locked
  return now < room.manual_override_until;
}

async function syncRoomStatuses() {
  const { time, day, date } = getIST();
  console.log(`[Scheduler] IST ${time} | ${day} | ${date}`);

  // Step 1 — fetch all rooms
  const { data: allRooms, error: roomErr } = await supabase
    .from('classrooms')
    .select('id, room_number, status, manual_override, manual_override_until');

  if (roomErr || !allRooms) {
    console.error('[Scheduler] Room fetch failed:', roomErr?.message);
    return;
  }

  // Step 2 — Handle Manual Overrides
  const unlocked = [];
  const locked   = [];

  for (const room of allRooms) {
    if (isManuallyLocked(room)) {
      locked.push(room);
    } else {
      // If it WAS manually overridden but is now expired, reset it in DB
      if (room.manual_override) {
        console.log(`[Scheduler] Override expired for ${room.room_number} — resetting flag`);
        await supabase.from('classrooms')
          .update({ manual_override: false, manual_override_until: null })
          .eq('id', room.id);
      }
      unlocked.push(room);
    }
  }

  if (unlocked.length === 0) {
    console.log('[Scheduler] All rooms manually locked — nothing to update');
    return;
  }

  // Step 3 — Fetch active bookings for current time
  const { data: bookings, error: bookErr } = await supabase
    .from('bookings')
    .select('room_id, room_number, subject, faculty, start_time, end_time')
    .eq('date', date)
    .lte('start_time', time + ':00')
    .gt('end_time', time + ':00');

  // Step 4 — Fetch active timetable schedules matching the current time
  let schedules = [];
  const { data, error } = await supabase
    .from('schedules')
    .select('room_id, room_number, subject, start_time, end_time')
    .eq('day', day)
    .lte('start_time', time + ':00')
    .gt('end_time', time + ':00');
  if (!error) schedules = data;

  if (bookErr) {
    console.error('[Scheduler] Booking fetch failed:', bookErr.message);
  }

  console.log(`[Scheduler] ${unlocked.length} rooms | ${bookings?.length ?? 0} bookings | ${schedules?.length ?? 0} classes`);

  // Step 5 — update only unlocked rooms
  for (const room of unlocked) {
    // Match by room_number to be safe against broken UUID links
    const book  = bookings?.find(b => b.room_number === room.room_number);
    const sched = schedules?.find(s => s.room_number === room.room_number);

    if (book) {
      // Booking takes precedence
      const { error: err } = await supabase.from('classrooms').update({
        status:          'occupied',
        current_subject: book.subject,
        current_faculty: book.faculty,
        current_section: book.section || null,
        session_start:   book.start_time,
        session_end:     book.end_time,
        updated_at:      new Date().toISOString(),
      }).eq('id', room.id);
      if (err) console.error(`[Scheduler] Update failed for ${room.room_number}:`, err.message);
    } else if (sched && !isLab(sched.subject)) {
      // Timetable class exists → occupied
      const { error: err } = await supabase.from('classrooms').update({
        status:          'occupied',
        current_subject: sched.subject,
        current_faculty: null,
        current_section: sched.section || null,
        session_start:   sched.start_time,
        session_end:     sched.end_time,
        updated_at:      new Date().toISOString(),
      }).eq('id', room.id);
      if (err) console.error(`[Scheduler] Update failed for ${room.room_number}:`, err.message);
    } else {
      // No class or lab OR between slots OR off hours → vacant
      const { error: err } = await supabase.from('classrooms').update({
        status:          'vacant',
        current_subject: null,
        current_faculty: null,
        current_section: null,
        session_start:   null,
        session_end:     null,
        updated_at:      new Date().toISOString(),
      }).eq('id', room.id);
      if (err) console.error(`[Scheduler] Update failed for ${room.room_number}:`, err.message);
    }
  }

  console.log(`[Scheduler] Done at IST ${time}`);
}

export function initScheduler() {
  console.log('[Scheduler] Started');
  syncRoomStatuses();
  setInterval(syncRoomStatuses, 60 * 1000);
}
