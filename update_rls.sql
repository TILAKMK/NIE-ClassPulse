-- Drop the restricted update policy
drop policy if exists "Editors update classrooms" on public.classrooms;

-- Allow public (anon and authenticated) updates for the client-side scheduler to work
-- Note: In a production app with a server, the scheduler would run server-side and this wouldn't be needed.
create policy "Public update classrooms" on public.classrooms
  for update to anon, authenticated
  using (true);
