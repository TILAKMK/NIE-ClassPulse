-- ================================================================
--  NIE ClassPulse — Supabase Database Schema
--  Run this SQL in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================


-- ── 1. PROFILES TABLE ──────────────────────────────────────────
--  Stores each user's role (student / teacher / cr)
--  Automatically created when a user signs up via trigger below.

create table if not exists public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text,
  role      text not null default 'student'   -- 'student' | 'teacher' | 'cr'
            check (role in ('student', 'teacher', 'cr')),
  full_name text,
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 2. CLASSROOMS TABLE ────────────────────────────────────────
--  One row per physical classroom

create table if not exists public.classrooms (
  id               uuid primary key default gen_random_uuid(),
  room_number      text not null unique,      -- e.g. "401", "MB-1"
  building         text not null,             -- e.g. "North Campus"
  floor            text,                      -- e.g. "4th Floor"
  department       text,                      -- e.g. "CSE"
  capacity         int,                       -- number of seats
  facilities       text,                      -- e.g. "Projector, AC, Wi-Fi"
  status           text not null default 'vacant'
                   check (status in ('vacant', 'occupied', 'free_soon')),
  -- Current session info (null when vacant)
  current_subject  text,
  current_faculty  text,
  session_start    time,
  session_end      time,
  next_class_time  text,                      -- display string e.g. "2:30 PM"
  ends_in          text,                      -- display string e.g. "Ends in 25 mins"
  updated_at       timestamptz default now()
);

-- ── 3. SCHEDULES TABLE ─────────────────────────────────────────
--  Weekly timetable entries (used for the "Today's Schedule" view)

create table if not exists public.schedules (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references public.classrooms(id) on delete cascade,
  day         text not null
              check (day in ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  start_time  time not null,
  end_time    time not null,
  subject     text not null,
  faculty     text,
  section     text,          -- e.g. "4th CSE-A"
  semester    text           -- e.g. "4th"
);


-- ── 4. ROW LEVEL SECURITY (RLS) ────────────────────────────────

-- Enable RLS on all tables
alter table public.profiles   enable row level security;
alter table public.classrooms enable row level security;
alter table public.schedules  enable row level security;

-- PROFILES: users can read their own row; admins can read all
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- CLASSROOMS: everyone can read; only teachers/CRs can update
create policy "Anyone can view classrooms"
  on public.classrooms for select
  to anon, authenticated
  using (true);

create policy "Teachers and CRs can update classrooms"
  on public.classrooms for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('teacher', 'cr')
    )
  );

-- SCHEDULES: everyone can read
create policy "Anyone can view schedules"
  on public.schedules for select
  to anon, authenticated
  using (true);


-- ── 5. REALTIME ────────────────────────────────────────────────
--  Allow classrooms table changes to broadcast via Supabase Realtime

alter publication supabase_realtime add table public.classrooms;


-- ── 6. SAMPLE DATA ─────────────────────────────────────────────
--  Insert a few rooms so the dashboard is not empty.
--  Delete / replace with real data later.

insert into public.classrooms
  (room_number, building, floor, department, capacity, facilities, status,
   current_subject, current_faculty, session_start, session_end, next_class_time)
values
  ('401', 'North Campus', '4th Floor', 'CSE', 60, 'Projector, AC, Wi-Fi', 'occupied',
   'ADA – Analysis & Design of Algorithms', 'Dr. Naveen S Pagad', '09:00', '10:00', null),

  ('402', 'North Campus', '4th Floor', 'CSE', 60, 'Projector, AC, Wi-Fi', 'vacant',
   null, null, null, null, '11:30 AM'),

  ('403', 'North Campus', '4th Floor', 'CSE', 60, 'Projector, AC', 'occupied',
   'DBMS', 'Dr. M R Rashmi', '10:00', '11:00', null),

  ('404', 'North Campus', '4th Floor', 'CSE', 60, 'Projector, AC', 'vacant',
   null, null, null, null, '11:30 AM'),

  ('405', 'North Campus', '4th Floor', 'CSE', 60, 'Projector, Whiteboard', 'occupied',
   'Machine Learning', 'Dr. V K Annapurna', '09:00', '10:00', null),

  ('301', 'North Campus', '3rd Floor', 'IS',  60, 'Projector, AC, Wi-Fi', 'vacant',
   null, null, null, null, '2:30 PM'),

  ('305', 'North Campus', '3rd Floor', 'IS',  60, 'Projector, AC', 'occupied',
   'Full Stack Development', 'Ms. Bhavani R', '10:00', '11:00', null),

  ('MB-1', 'Main Block', 'Ground Floor', 'CSE', 60, 'Projector, AC', 'vacant',
   null, null, null, null, 'No class today'),

  ('MB-5', 'Main Block', 'Ground Floor', 'AI & ML', 60, 'Projector, AC, Smart Board', 'occupied',
   'Computer Vision', 'Mrs. Harshitha H.S', '09:00', '10:00', null);
