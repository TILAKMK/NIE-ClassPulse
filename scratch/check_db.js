import { supabase } from './js/supabase.js';

async function checkSchedules() {
  console.log('Checking schedules table...');
  const { data, error, count } = await supabase
    .from('schedules')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error fetching schedules:', error.message);
    return;
  }
  
  console.log('Total schedules found:', count);
  
  if (count === 0) {
    console.log('The schedules table is EMPTY.');
  } else {
    const { data: sample } = await supabase.from('schedules').select('*').limit(3);
    console.log('Sample data:', JSON.stringify(sample, null, 2));
  }
}

// Since I am running this in a browser-like environment (antigravity), 
// I might need to run it in a way that respects the imports.
// Actually, I'll just look at the code to see if there's a problem.
