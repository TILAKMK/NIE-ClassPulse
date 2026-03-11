// ============================================================
//  js/scheduler.js
//  Auto-updates room status (vacant / occupied only — no free_soon)
//  LAB slots = classroom is VACANT (students gone to lab)
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

  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('room_id, subject, start_time, end_time')
    .eq('day', today)
    .eq('start_time', activeSlot.start + ':00');

  if (error) { console.error('[Scheduler] Error:', error); return; }

  const { data: allRooms } = await supabase
    .from('classrooms')
    .select('id');

  const updates = allRooms.map(room => {
    const sched = schedules.find(s => s.room_id === room.id);

    // No class or lab slot → VACANT
    if (!sched || isLabSubject(sched.subject)) {
      return {
        id: room.id, status: 'vacant',
        current_subject: null, current_faculty: null,
        session_start: null, session_end: null,
        updated_at: new Date().toISOString(),
      };
    }

    // Real class → OCCUPIED
    return {
      id: room.id, status: 'occupied',
      current_subject: sched.subject,
      session_start: sched.start_time, session_end: sched.end_time,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: upsertErr } = await supabase.from('classrooms').upsert(updates);
  if (upsertErr) console.error('[Scheduler] Upsert error:', upsertErr);
  else console.log(`[ClassPulse] ${new Date().toLocaleTimeString()} — synced ${updates.length} rooms | slot ${activeSlot.start}–${activeSlot.end}`);
}

async function markAllVacant() {
  await supabase.from('classrooms').update({
    status: 'vacant', current_subject: null,
    current_faculty: null, session_start: null, session_end: null,
    updated_at: new Date().toISOString(),
  }).neq('id', '00000000-0000-0000-0000-000000000000');
}

export function initScheduler() {
  console.log('[ClassPulse Scheduler] Started');
  syncRoomStatuses();
  setInterval(syncRoomStatuses, 60 * 1000);
}
