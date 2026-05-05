const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pkibnsqijbhggaxpkbml.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraWJuc3FpamJoZ2dheHBrYm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTkwOTAsImV4cCI6MjA4ODczNTA5MH0.6Cd3RMMh6a9DfyUYT6iz9of87NlUiUwJNJVFh9VJvGM');
async function run() {
  const {data: allRooms} = await supabase.from('classrooms').select('*');
  const {data: schedules} = await supabase.from('schedules').select('*').eq('day', 'Thursday').lt('start_time', '12:07:00').gt('end_time', '11:01:00');
  
  const validClashes = (schedules || []).filter(s => !/lab/i.test(s.subject||''));
  const clashSet = new Set(validClashes.map(s => s.room_id));
  
  const available = allRooms.filter(r => !clashSet.has(r.id));
  console.log('Available rooms:', available.map(r => r.room_number));
}
run();