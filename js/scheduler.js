// ============================================================
//  js/scheduler.js
//  Auto-updates room status based on current day + time.
//  KEY RULE: If a slot contains a LAB, the classroom is VACANT
//  (students have gone to the lab building for those 2 hours).
// ============================================================
import { supabase } from './supabase.js';

const SLOTS = [
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  // 11:00–11:30 = BREAK
  { start: '11:30', end: '12:30' },
  { start: '12:30', end: '13:30' },
  // 13:30–14:30 = LUNCH
  { start: '14:30', end: '15:30' },
  { start: '15:30', end: '16:30' },
  { start: '16:30', end: '17:30' },
];

// ── Lab detection ─────────────────────────────────────────────
// If a subject contains "lab" (case-insensitive), students are
// in the lab → the classroom itself is VACANT.
function isLabSubject(subject) {
  if (!subject) return false;
  return /lab/i.test(subject);
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

function isFreeSoon(slot, current) {
  if (current < slot.start || current >= slot.end) return false;
  const [eh, em] = slot.end.split(':').map(Number);
  const [ch, cm] = current.split(':').map(Number);
  return ((eh * 60 + em) - (ch * 60 + cm)) <= 30;
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

  // Fetch today's schedules for this slot
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('room_id, subject, start_time, end_time')
    .eq('day', today)
    .eq('start_time', activeSlot.start + ':00');

  if (error) { console.error('[Scheduler] Error:', error); return; }

  // Fetch all rooms
  const { data: allRooms } = await supabase
    .from('classrooms')
    .select('id');

  const freeSoon = isFreeSoon(activeSlot, current);

  const updates = allRooms.map(room => {
    const sched = schedules.find(s => s.room_id === room.id);

    // No class this slot OR it's a lab slot → room is VACANT
    if (!sched || isLabSubject(sched.subject)) {
      return {
        id:              room.id,
        status:          'vacant',
        current_subject: null,
        current_faculty: null,
        session_start:   null,
        session_end:     null,
        updated_at:      new Date().toISOString(),
      };
    }

    // Real class happening in this room
    return {
      id:              room.id,
      status:          freeSoon ? 'free_soon' : 'occupied',
      current_subject: sched.subject,
      session_start:   sched.start_time,
      session_end:     sched.end_time,
      updated_at:      new Date().toISOString(),
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
  console.log('[ClassPulse] Off-hours — all rooms marked vacant');
}

export function initScheduler() {
  console.log('[ClassPulse Scheduler] Started');
  syncRoomStatuses();
  setInterval(syncRoomStatuses, 60 * 1000);
}
