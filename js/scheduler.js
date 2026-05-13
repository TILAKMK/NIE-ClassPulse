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
  // Obsolete: We now dynamically overlay schedules in rooms.js
  // This prevents anonymous users from getting RLS update errors
  // while still correctly showing occupied rooms on the frontend.
}

export function initScheduler() {
  console.log('[Scheduler] Started');
  syncRoomStatuses();
  setInterval(syncRoomStatuses, 60 * 1000);
}
