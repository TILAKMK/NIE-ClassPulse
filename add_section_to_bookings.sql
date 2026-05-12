-- Add section column to bookings table
alter table public.bookings add column if not exists section text;

-- Add current_section column to classrooms table for real-time status display
alter table public.classrooms add column if not exists current_section text;
