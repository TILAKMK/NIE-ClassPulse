const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pkibnsqijbhggaxpkbml.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraWJuc3FpamJoZ2dheHBrYm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTkwOTAsImV4cCI6MjA4ODczNTA5MH0.6Cd3RMMh6a9DfyUYT6iz9of87NlUiUwJNJVFh9VJvGM');
async function run() {
  const {data} = await supabase.from('schedules').select('room_id, start_time, end_time, subject').eq('day', 'Thursday').lt('start_time', '12:07:00').gt('end_time', '11:01:00');
  console.log('Thursday overlapping count:', data.length);
  const validData = data.filter(d => d.subject && !/lab/i.test(d.subject));
  console.log('Valid Clashes count:', validData.length);
  const uniqueRooms = new Set(validData.map(d => d.room_id));
  console.log('Unique missing rooms:', uniqueRooms.size);
  const {data: allRooms} = await supabase.from('classrooms').select('id, name');
  console.log('Total rooms:', allRooms.length);
  console.log('Available rooms count should be:', allRooms.length - uniqueRooms.size);
}
run();
