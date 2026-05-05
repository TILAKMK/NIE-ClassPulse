const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pkibnsqijbhggaxpkbml.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraWJuc3FpamJoZ2dheHBrYm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTkwOTAsImV4cCI6MjA4ODczNTA5MH0.6Cd3RMMh6a9DfyUYT6iz9of87NlUiUwJNJVFh9VJvGM');
async function run() {
  const {data: allRooms} = await supabase.from('classrooms').select('id, room_number');
  const {data} = await supabase.from('schedules').select('*').eq('day', 'Thursday');
  const dMap = {};
  allRooms.forEach(r => dMap[r.id] = r.room_number);
  const out = data.filter(d => !/lab/i.test(d.subject||'')).map(d => ({r: dMap[d.room_id], s: d.start_time, e: d.end_time, sub: d.subject}));
  console.log(JSON.stringify(out, null, 2));
}
run();