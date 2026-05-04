-- FIX: Delete all duplicate schedules for 208 and 209, then insert them exactly once.

-- 1. First, delete all schedules for 208 and 209 so we can start fresh for these rooms
delete from public.schedules 
where room_number in ('208', '209');

-- 2. Now insert the correct schedules exactly ONE time for 208
insert into public.schedules (room_id, room_number, day, start_time, end_time, subject, section, semester)
select c.id, v.room_number, v.day, v.start_time::time, v.end_time::time, v.subject, v.section, v.semester
from public.classrooms c
join (
values
-- MONDAY
('208','Monday','11:30','12:30','WAD','MCA-A','2nd'),
('208','Monday','12:30','13:30','JAVA','MCA-A','2nd'),
('208','Monday','14:30','15:30','SE','MCA-A','2nd'),
('208','Monday','15:30','16:30','MLDAP','MCA-A','2nd'),
-- TUESDAY
('208','Tuesday','09:00','10:00','MLDAP','MCA-A','2nd'),
('208','Tuesday','10:00','11:00','SE','MCA-A','2nd'),
('208','Tuesday','14:30','15:30','DSA','MCA-A','2nd'),
('208','Tuesday','15:30','16:30','JAVA','MCA-A','2nd'),
-- WEDNESDAY
('208','Wednesday','11:30','12:30','SE','MCA-A','2nd'),
('208','Wednesday','12:30','13:30','DSA','MCA-A','2nd'),
('208','Wednesday','14:30','15:30','WAD','MCA-A','2nd'),
-- THURSDAY
('208','Thursday','09:00','10:00','WAD','MCA-A','2nd'),
('208','Thursday','10:00','11:00','DSA','MCA-A','2nd'),
('208','Thursday','11:30','12:30','MLDAP','MCA-A','2nd'),
('208','Thursday','12:30','13:30','JAVA','MCA-A','2nd'),
-- FRIDAY
('208','Friday','09:00','10:00','DSA','MCA-A','2nd'),
('208','Friday','10:00','11:00','JAVA','MCA-A','2nd'),
('208','Friday','11:30','13:30','SE','MCA-A','2nd')
) as v(room_number,day,start_time,end_time,subject,section,semester)
on c.room_number = v.room_number;

-- 3. Insert the correct schedules exactly ONE time for 209
insert into public.schedules (room_id, room_number, day, start_time, end_time, subject, section, semester)
select c.id, v.room_number, v.day, v.start_time::time, v.end_time::time, v.subject, v.section, v.semester
from public.classrooms c
join (
values
-- MONDAY
('209','Monday','09:00','10:00','JAVA','MCA-B','2nd'),
('209','Monday','10:00','11:00','MLDAP','MCA-B','2nd'),
('209','Monday','14:30','15:30','SE','MCA-B','2nd'),
('209','Monday','15:30','16:30','DSA','MCA-B','2nd'),
-- TUESDAY
('209','Tuesday','09:00','10:00','DSA','MCA-B','2nd'),
('209','Tuesday','10:00','11:00','MLDAP','MCA-B','2nd'),
('209','Tuesday','11:30','12:30','WAD','MCA-B','2nd'),
('209','Tuesday','12:30','13:30','JAVA','MCA-B','2nd'),
-- WEDNESDAY
('209','Wednesday','10:00','11:00','JAVA','MCA-B','2nd'),
('209','Wednesday','11:30','12:30','SE','MCA-B','2nd'),
('209','Wednesday','12:30','13:30','WAD','MCA-B','2nd'),
-- THURSDAY
('209','Thursday','11:30','12:30','MLDAP','MCA-B','2nd'),
('209','Thursday','12:30','13:30','DSA','MCA-B','2nd'),
('209','Thursday','14:30','15:30','WAD','MCA-B','2nd'),
('209','Thursday','15:30','16:30','JAVA','MCA-B','2nd'),
-- FRIDAY
('209','Friday','11:30','12:30','SE','MCA-B','2nd'),
('209','Friday','12:30','13:30','DSA','MCA-B','2nd'),
('209','Friday','14:30','16:30','SE TUTORIAL','MCA-B','2nd')
) as v(room_number,day,start_time,end_time,subject,section,semester)
on c.room_number = v.room_number;