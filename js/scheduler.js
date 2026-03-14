// ============================================================
//  js/scheduler.js — SIMPLIFIED & FIXED
//  Key rules:
//  1. Manual changes (session_end set) are NEVER overwritten
//  2. Weekends / off hours → only reset rooms with NO manual override
//  3. Timetable only applies to rooms with no active manual session
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

function getIST() {
  const now   = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const ist   = new Date(utcMs + 5.5 * 60 * 60 * 1000);
  const hh    = String(ist.getHours()).padStart(2, '0');
  const mm    = String(ist.getMinutes()).padStart(2, '0');
  const day   = ist.toLocaleDateString('en-US', { weekday: 'long' });
  return { time: `${hh}:${mm}`, day };
}

// A room is manually locked if:
// - It is currently occupied
// - It has a session_end time
// - Current IST time is before that session_end
function isLocked(room, currentTime) {
  if (room.status !== 'occupied') return false;
  if (!room.session_end) return false;
  const end = String(room.session_end).substring(0, 5);
  return currentTime < end;
}

async function syncRoomStatuses() {
  const { time, day } = getIST();
  console.log(`[Scheduler] IST: ${time} | ${day}`);

  // Fetch all rooms with their current status
  const { data: allRooms, error: roomErr } = await supabase
    .from('classrooms')
    .select('id, status, session_end, current_subject');

  if (roomErr || !allRooms) {
    console.error('[Scheduler] Cannot fetch rooms:', roomErr?.message);
    return;
  }

  // Separate locked rooms (manual) from free rooms (scheduler can touch)
  const lockedRooms = allRooms.filter(r => isLocked(r, time));
  const freeRooms   = allRooms.filter(r => !isLocked(r, time));

  console.log(`[Scheduler] Locked: ${lockedRooms.length} | Free to update: ${freeRooms.length}`);

  // If no free rooms, nothing to do
  if (freeRooms.length === 0) return;

  const isWeekend     = day === 'Saturday' || day === 'Sunday';
  const isBreak       = time >= '11:00' && time < '11:30';
  const isLunch       = time >= '13:30' && time < '14:30';
  const beforeCollege = time < '09:00';
  const afterCollege  = time >= '17:30';
  const isOffHours    = isWeekend || isBreak || isLunch || beforeCollege || afterCollege;

  if (isOffHours) {
    // Off hours — mark all NON-LOCKED rooms vacant
    for (const room of freeRooms) {
      await supabase.from('classrooms')
        .update({
          status: 'vacant',
          current_subject: null,
          current_faculty: null,
          session_start: null,
          session_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id);
    }
    console.log(`[Scheduler] Off hours — vacated ${freeRooms.length} rooms`);
    return;
  }

  // College hours — apply timetable to free rooms only
  const activeSlot = SLOTS.find(s => time >= s.start && time < s.end);

  if (!activeSlot) {
    // Between slots — do nothing, keep current state
    console.log(`[Scheduler] Between slots — no changes`);
    return;
  }

  // Fetch timetable for this slot
  const { data: schedules, error: schedErr } = await supabase
    .from('schedules')
    .select('room_id, subject, start_time, end_time')
    .eq('day', day)
    .eq('start_time', activeSlot.start + ':00');

  if (schedErr) {
    console.error('[Scheduler] Cannot fetch schedules:', schedErr?.message);
    return;
  }

  console.log(`[Scheduler] Timetable classes this slot: ${schedules?.length ?? 0}`);

  // Update only free rooms based on timetable
  for (const room of freeRooms) {
    const sched = schedules?.find(s => s.room_id === room.id);

    if (sched && !isLab(sched.subject)) {
      await supabase.from('classrooms')
        .update({
          status: 'occupied',
          current_subject: sched.subject,
          current_faculty: null,
          session_start: sched.start_time,
          session_end: sched.end_time,
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id);
    } else {
      await supabase.from('classrooms')
        .update({
          status: 'vacant',
          current_subject: null,
          current_faculty: null,
          session_start: null,
          session_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id);
    }
  }

  console.log(`[Scheduler] Done — ${day} ${time}`);
}

export function initScheduler() {
  console.log('[Scheduler] Started');
  syncRoomStatuses();
  setInterval(syncRoomStatuses, 60 * 1000);
}
