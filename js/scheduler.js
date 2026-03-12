// ============================================================
//  js/scheduler.js — Auto-updates room status every 60s
//  KEY FIX: Skips rooms that were manually marked occupied
//           by a teacher (current_faculty is set) until
//           their session_end time passes.
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

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function todayName() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function isInSlot(slot, current) {
  return current >= slot.start && current < slot.end;
}

// Check if a manually-set session is still active
// session_end comes as "HH:MM:SS" from DB
function isManualSessionActive(room, current) {
  if (!room.current_faculty) return false; // not manually set
  if (!room.session_end) return false;
  const end = room.session_end.slice(0, 5); // "HH:MM:SS" → "HH:MM"
  return current < end;
}

async function syncRoomStatuses() {
  const today   = todayName();
  const current = nowTime();

  const isWeekend     = today === 'Saturday' || today === 'Sunday';
  const isBreak       = current >= '11:00' && current < '11:30';
  const isLunch       = current >= '13:30' && current < '14:30';
  const beforeCollege = current < '09:00';
  const afterCollege  = current >= '17:30';

  if (isWeekend || isBreak || isLunch || beforeCollege || afterCollege) {
    await markAllVacant();
    return;
  }

  const activeSlot = SLOTS.find(s => isInSlot(s, current));
  if (!activeSlot) { await markAllVacant(); return; }

  // Fetch schedules for current slot
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('room_id, subject, start_time, end_time')
    .eq('day', today)
    .eq('start_time', activeSlot.start + ':00');

  if (error) { console.error('[Scheduler] Error:', error); return; }

  // Fetch ALL rooms including current status to check manual overrides
  const { data: allRooms } = await supabase
    .from('classrooms')
    .select('id, current_faculty, session_end, status');

  if (!allRooms) return;

  const updates = [];

  for (const room of allRooms) {
    // ── SKIP if teacher manually marked this room and session hasn't ended
    if (isManualSessionActive(room, current)) {
      console.log(`[Scheduler] Skipping room — manual session active until ${room.session_end}`);
      continue; // don't touch this room
    }

    const sched = schedules.find(s => s.room_id === room.id);

    // No class or lab slot → VACANT
    if (!sched || isLabSubject(sched.subject)) {
      updates.push({
        id: room.id, status: 'vacant',
        current_subject: null, current_faculty: null,
        session_start: null, session_end: null,
        updated_at: new Date().toISOString(),
      });
    } else {
      // Timetable class → OCCUPIED
      updates.push({
        id: room.id, status: 'occupied',
        current_subject: sched.subject,
        current_faculty: null, // timetable class, no faculty override
        session_start: sched.start_time,
        session_end: sched.end_time,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (updates.length === 0) {
    console.log('[Scheduler] All rooms have active manual sessions, nothing to update.');
    return;
  }

  const { error: upsertErr } = await supabase.from('classrooms').upsert(updates);
  if (upsertErr) console.error('[Scheduler] Upsert error:', upsertErr);
  else console.log(`[ClassPulse] ${new Date().toLocaleTimeString()} — synced ${updates.length} rooms`);
}

async function markAllVacant() {
  // Only mark rooms vacant that are NOT in an active manual session
  const { data: allRooms } = await supabase
    .from('classrooms')
    .select('id, current_faculty, session_end');

  if (!allRooms) return;

  const current = nowTime();
  const ids = allRooms
    .filter(r => !isManualSessionActive(r, current))
    .map(r => r.id);

  if (ids.length === 0) return;

  for (const id of ids) {
    await supabase.from('classrooms').update({
      status: 'vacant', current_subject: null,
      current_faculty: null, session_start: null, session_end: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  }
}

export function initScheduler() {
  console.log('[ClassPulse Scheduler] Started');
  syncRoomStatuses();
  setInterval(syncRoomStatuses, 60 * 1000);
}
