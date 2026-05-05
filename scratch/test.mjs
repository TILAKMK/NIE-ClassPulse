import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://pkibnsqijbhggaxpkbml.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraWJuc3FpamJoZ2dheHBrYm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTkwOTAsImV4cCI6MjA4ODczNTA5MH0.6Cd3RMMh6a9DfyUYT6iz9of87NlUiUwJNJVFh9VJvGM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function test() {
  const date = '2026-05-07'; // "07-05-2026" locally in their UI
  const start = '09:55';
  const end = '10:55';
  
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'long' });
  console.log("Day name:", dayName);

  const { data: schedules, error } = await supabase
        .from('schedules')
        .select('room_id, start_time, end_time, subject, is_lab')
        .eq('day', dayName)
        .lt('start_time', end + ':00')
        .gt('end_time', start + ':00');

  console.log("Error?", error);
  console.log("Data count:", schedules?.length);
  console.log("Data:", schedules);

  const { data: allRooms } = await supabase.from('classrooms').select('*').order('room_number');
  console.log("Total rooms:", allRooms?.length);

  const timetableClash = new Set((schedules || []).map(s => s.room_id));
  console.log("timetableClash", Array.from(timetableClash));
  
  const { data: bookings } = await supabase
  .from('bookings')
  .select('room_id, start_time, end_time, subject')
  .eq('date', date)
  .lt('start_time', end + ':00')
  .gt('end_time', start + ':00');
  
  const bookingClash = new Set((bookings || []).map(b => b.room_id));
  
  const available = allRooms.filter(r =>
      !timetableClash.has(r.id) && !bookingClash.has(r.id)
  );

  console.log("Available rooms:", available.length);
}

test();