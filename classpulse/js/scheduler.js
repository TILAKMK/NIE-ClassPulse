// ============================================================
//  js/scheduler.js
//  FIXED:
//  1. Timezone — always uses IST correctly regardless of device
//  2. Manual override protection — uses session_end not faculty name
//  3. Scheduler only touches a room after its manual session_end passes
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

function isLabSubject(subject) {
  return /lab/i.test(subject || '');
}

// Always returns IST time as "HH:MM" — works correctly on any server/device
function nowIST() {
  const now = new Date();
  // IST = UTC + 5:30 — always add fixed offset to UTC
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000); // convert to UTC
  const istMs = utcMs + (5.5 * 60 * 60 * 1000);                        // add IST offset
  const ist   = new Date(istMs);
  const hh    = String(ist.getHours()).padStart(2, '0');
  const mm    = String(ist.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function todayIST() {
  const now   = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const istMs = utcMs + (5.5 * 60 * 60 * 1000);
  const ist   = new Date(istMs);
  return ist.toLocaleDateString('en-US', { weekday: 'long' });
}

function isInSlot(slot, current) {
  return current >= slot.start && current < slot.end;
}

// FIXED: Check manual override using session_end only (not faculty name)
// If a room has session_end set AND current time is before that end time
// → it was manually set → scheduler should NOT touch it
function isManuallyLocked(room, current) {
  if (!room.session_end) return false;
  // session_end from DB comes as "HH:MM:SS" — take first 5 chars
  const endTime = String(room.session_end).substring(0, 5);
  if (!endTime || endTime === 'null') return false;
  // Only lock if status is occupied (if already vacant, scheduler can work)
  if (room.status !== 'occupied') return false;
  return current < endTime;
}

async function syncRoomStatuses() {
  const today   = todayIST();
  const current = nowIST();

  console.log(`[ClassPulse] IST: ${current} | Day: ${today}`);

  const isWeekend     = today === 'Saturday' || today === 'Sunday';
  const isBreak       = current >= '11:00' && current < '11:30';
  const isLunch       = current >= '13:30' && current < '14:30';
  const beforeCollege = current < '09:00';
  const afterCollege  = current >= '17:30';

  // Fetch all rooms first — needed for manual lock check
  const { data: allRooms, error: roomErr } = await supabase
    .from('classrooms')
    .select('id, status, session_end, current_subject, current_faculty');

  if (roomErr || !allRooms) {
    console.error('[Scheduler] Failed to fetch rooms:', roomErr);
    return;
  }

  // During off hours — mark all non-locked rooms vacant
  if (isWeekend || isBreak || isLunch || beforeCollege || afterCollege) {
    const toVacate = allRooms.filter(r => !isManuallyLocked(r, current));
    for (const room of toVacate) {
      await supabase.from('classrooms').update({
        status: 'vacant',
        current_subject: null,
        current_faculty: null,
        session_start: null,
        session_end: null,
        updated_at: new Date().toISOString(),
      }).eq('id', room.id);
    }
    console.log(`[ClassPulse] Off hours — vacated ${toVacate.length} rooms`);
    return;
  }

  // Find active timetable slot
  const activeSlot = SLOTS.find(s => isInSlot(s, current));
  if (!activeSlot) {
    // Between slots — don't change anything
    console.log(`[ClassPulse] Between slots at ${current} — no changes`);
    return;
  }

  console.log(`[ClassPulse] Active slot: ${activeSlot.start}–${activeSlot.end}`);

  // Fetch timetable for this slot
  const { data: schedules, error: schedErr } = await supabase
    .from('schedules')
    .select('room_id, subject, start_time, end_time')
    .eq('day', today)
    .eq('start_time', activeSlot.start + ':00');

  if (schedErr) {
    console.error('[Scheduler] Failed to fetch schedules:', schedErr);
    return;
  }

  console.log(`[ClassPulse] ${schedules?.length ?? 0} timetable classes found`);

  // Update each room
  for (const room of allRooms) {
    // CRITICAL: Skip rooms that are manually locked (teacher set end time hasn't passed)
    if (isManuallyLocked(room, current)) {
      console.log(`[ClassPulse] Skipping room — manual lock active until ${room.session_end}`);
      continue;
    }

    const sched = schedules?.find(s => s.room_id === room.id);

    if (sched && !isLabSubject(sched.subject)) {
      // Timetable says class is here → mark occupied
      await supabase.from('classrooms').update({
        status: 'occupied',
        current_subject: sched.subject,
        current_faculty: null,
        session_start: sched.start_time,
        session_end: sched.end_time,
        updated_at: new Date().toISOString(),
      }).eq('id', room.id);
    } else {
      // No class or lab → mark vacant
      await supabase.from('classrooms').update({
        status: 'vacant',
        current_subject: null,
        current_faculty: null,
        session_start: null,
        session_end: null,
        updated_at: new Date().toISOString(),
      }).eq('id', room.id);
    }
  }

  console.log(`[ClassPulse] Sync done at IST ${current}`);
}

export function initScheduler() {
  console.log('[ClassPulse Scheduler] Started');
  syncRoomStatuses();
  setInterval(syncRoomStatuses, 60 * 1000);
}
