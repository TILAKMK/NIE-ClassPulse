// ============================================================
//  js/scheduler.js — FINAL FIXED VERSION
//
//  Rules:
//  1. If room has session_end AND current IST time < session_end
//     → SKIP (manual override active, don't touch)
//  2. If session_end has passed OR no session_end
//     → Apply timetable (occupied/vacant based on schedule)
//  3. Weekends/off hours → same rules apply
//     → Manual locked rooms stay as is
//     → Everything else → vacant
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

// Get IST time and day — works correctly on any server or device
function getIST() {
  const now   = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const ist   = new Date(utcMs + (5.5 * 60 * 60 * 1000));
  const hh    = String(ist.getHours()).padStart(2, '0');
  const mm    = String(ist.getMinutes()).padStart(2, '0');
  const day   = ist.toLocaleDateString('en-US', { weekday: 'long' });
  return { time: `${hh}:${mm}`, day };
}

// THE KEY FUNCTION — is this room manually locked?
// A room is locked if:
// - status is 'occupied'
// - session_end exists
// - current IST time is BEFORE session_end
function isManuallyLocked(room, currentTime) {
  if (room.status !== 'occupied') return false;
  if (!room.session_end)          return false;
  const end = String(room.session_end).substring(0, 5); // "HH:MM:SS" → "HH:MM"
  if (!end || end.length < 5)     return false;
  return currentTime < end;
}

async function syncRoomStatuses() {
  const { time, day } = getIST();
  console.log(`[Scheduler] IST ${time} | ${day}`);

  // Step 1 — fetch all rooms
  const { data: allRooms, error: roomErr } = await supabase
    .from('classrooms')
    .select('id, status, session_end');

  if (roomErr || !allRooms) {
    console.error('[Scheduler] Room fetch failed:', roomErr?.message);
    return;
  }

  // Step 2 — split into locked (skip) and unlocked (scheduler controls)
  const locked   = allRooms.filter(r => isManuallyLocked(r, time));
  const unlocked = allRooms.filter(r => !isManuallyLocked(r, time));

  console.log(`[Scheduler] Locked: ${locked.length} | Unlocked: ${unlocked.length}`);

  if (unlocked.length === 0) {
    console.log('[Scheduler] All rooms manually locked — nothing to update');
    return;
  }

  // Step 3 — check if off hours
  const isWeekend  = day === 'Saturday' || day === 'Sunday';
  const isBreak    = time >= '11:00' && time < '11:30';
  const isLunch    = time >= '13:30' && time < '14:30';
  const isBefore   = time < '09:00';
  const isAfter    = time >= '17:30';
  const isOffHours = isWeekend || isBreak || isLunch || isBefore || isAfter;

  if (isOffHours) {
    // Off hours — vacate all unlocked rooms
    const ids = unlocked.map(r => r.id);
    for (const id of ids) {
      await supabase.from('classrooms').update({
        status: 'vacant',
        current_subject: null,
        current_faculty: null,
        session_start:   null,
        session_end:     null,
        updated_at:      new Date().toISOString(),
      }).eq('id', id);
    }
    console.log(`[Scheduler] Off hours — vacated ${ids.length} unlocked rooms`);
    return;
  }

  // Step 4 — find active timetable slot
  const activeSlot = SLOTS.find(s => time >= s.start && time < s.end);
  if (!activeSlot) {
    // Between slots — do nothing to unlocked rooms
    console.log(`[Scheduler] Between slots at ${time} — no timetable changes`);
    return;
  }

  // Step 5 — fetch timetable for this slot
  const { data: schedules, error: schedErr } = await supabase
    .from('schedules')
    .select('room_id, subject, start_time, end_time')
    .eq('day', day)
    .eq('start_time', activeSlot.start + ':00');

  if (schedErr) {
    console.error('[Scheduler] Schedule fetch failed:', schedErr?.message);
    return;
  }

  console.log(`[Scheduler] Timetable: ${schedules?.length ?? 0} classes for slot ${activeSlot.start}`);

  // Step 6 — update only unlocked rooms
  for (const room of unlocked) {
    const sched = schedules?.find(s => s.room_id === room.id);

    if (sched && !isLab(sched.subject)) {
      // Timetable class exists → occupied
      await supabase.from('classrooms').update({
        status:          'occupied',
        current_subject: sched.subject,
        current_faculty: null,
        session_start:   sched.start_time,
        session_end:     sched.end_time,
        updated_at:      new Date().toISOString(),
      }).eq('id', room.id);
    } else {
      // No class or lab → vacant
      await supabase.from('classrooms').update({
        status:          'vacant',
        current_subject: null,
        current_faculty: null,
        session_start:   null,
        session_end:     null,
        updated_at:      new Date().toISOString(),
      }).eq('id', room.id);
    }
  }

  console.log(`[Scheduler] Done at IST ${time}`);
}

export function initScheduler() {
  console.log('[Scheduler] Started');
  syncRoomStatuses();
  setInterval(syncRoomStatuses, 60 * 1000);
}
