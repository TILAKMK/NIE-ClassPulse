// ============================================================
//  js/scheduler.js — Fixed for IST timezone (UTC+5:30)
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

// Get current IST time as "HH:MM" — fixes the timezone bug
function nowTimeIST() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset - (now.getTimezoneOffset() * 60 * 1000));
  const hh = String(ist.getHours()).padStart(2, '0');
  const mm = String(ist.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Get current IST day name
function todayNameIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset - (now.getTimezoneOffset() * 60 * 1000));
  return ist.toLocaleDateString('en-US', { weekday: 'long' });
}

function isInSlot(slot, current) {
  return current >= slot.start && current < slot.end;
}

function isManualSessionActive(room, current) {
  if (!room.current_faculty) return false;
  if (!room.session_end) return false;
  const end = room.session_end.slice(0, 5);
  return current < end;
}

async function syncRoomStatuses() {
  const today   = todayNameIST();
  const current = nowTimeIST();

  console.log(`[ClassPulse] IST time: ${current}, Day: ${today}`);

  const isWeekend     = today === 'Saturday' || today === 'Sunday';
  const isBreak       = current >= '11:00' && current < '11:30';
  const isLunch       = current >= '13:30' && current < '14:30';
  const beforeCollege = current < '09:00';
  const afterCollege  = current >= '17:30';

  if (isWeekend || isBreak || isLunch || beforeCollege || afterCollege) {
    await markAllVacant(current);
    return;
  }

  const activeSlot = SLOTS.find(s => isInSlot(s, current));
  if (!activeSlot) { await markAllVacant(current); return; }

  console.log(`[ClassPulse] Active slot: ${activeSlot.start}–${activeSlot.end}`);

  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('room_id, subject, start_time, end_time')
    .eq('day', today)
    .eq('start_time', activeSlot.start + ':00');

  if (error) { console.error('[Scheduler] Error fetching schedules:', error); return; }

  console.log(`[ClassPulse] Found ${schedules?.length ?? 0} scheduled classes`);

  const { data: allRooms } = await supabase
    .from('classrooms')
    .select('id, current_faculty, session_end, status');

  if (!allRooms) return;

  const updates = [];

  for (const room of allRooms) {
    if (isManualSessionActive(room, current)) continue;

    const sched = schedules.find(s => s.room_id === room.id);

    if (!sched || isLabSubject(sched.subject)) {
      updates.push({
        id: room.id, status: 'vacant',
        current_subject: null, current_faculty: null,
        session_start: null, session_end: null,
        updated_at: new Date().toISOString(),
      });
    } else {
      updates.push({
        id: room.id, status: 'occupied',
        current_subject: sched.subject,
        current_faculty: null,
        session_start: sched.start_time,
        session_end: sched.end_time,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (updates.length === 0) return;

  const { error: upsertErr } = await supabase.from('classrooms').upsert(updates);
  if (upsertErr) console.error('[Scheduler] Upsert error:', upsertErr);
  else console.log(`[ClassPulse] Synced ${updates.length} rooms at IST ${current}`);
}

async function markAllVacant(current) {
  const { data: allRooms } = await supabase
    .from('classrooms')
    .select('id, current_faculty, session_end');
  if (!allRooms) return;

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
  console.log(`[ClassPulse] Marked ${ids.length} rooms vacant (off hours/break)`);
}

export function initScheduler() {
  console.log('[ClassPulse Scheduler] Started — IST timezone fix active');
  syncRoomStatuses();
  setInterval(syncRoomStatuses, 60 * 1000);
}
