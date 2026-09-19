begin;
select plan(14);
select ok((select relrowsecurity from pg_class where oid = 'public.career_applications'::regclass), 'RLS is enabled');
select ok(not has_table_privilege('anon', 'public.career_applications', 'SELECT'), 'anon cannot read');
select ok(not has_table_privilege('anon', 'public.career_applications', 'INSERT'), 'anon cannot insert directly');
select ok(not has_table_privilege('anon', 'public.career_applications', 'UPDATE'), 'anon cannot update');
select ok(not has_table_privilege('anon', 'public.career_applications', 'DELETE'), 'anon cannot delete');
select ok(not has_table_privilege('authenticated', 'public.career_applications', 'SELECT'), 'signed-in users cannot read');
select ok(not has_table_privilege('authenticated', 'public.career_applications', 'INSERT'), 'signed-in users cannot insert directly');
select ok(not has_table_privilege('authenticated', 'public.career_applications', 'UPDATE'), 'signed-in users cannot update');
select ok(not has_table_privilege('authenticated', 'public.career_applications', 'DELETE'), 'signed-in users cannot delete');
select ok(has_table_privilege('service_role', 'public.career_applications', 'INSERT'), 'server can insert');
set local role service_role;
select lives_ok($$insert into public.career_applications
  (role, full_name, email, college_major, academic_year, motivation, experience, weekly_availability, role_answer)
  values ('marketing', 'Test Student', 'test@student.squ.edu.om', 'Science', '2', 'Help students', 'Writing', '3 hours', 'Student campaign')$$,
  'server inserts a valid application');
reset role;
select is((select count(*) from public.career_applications), 1::bigint, 'application is stored');
set local role anon;
select throws_ok('select * from public.career_applications', '42501', 'permission denied for table career_applications', 'anonymous read is denied');
reset role;
set local role authenticated;
select throws_ok('select * from public.career_applications', '42501', 'permission denied for table career_applications', 'signed-in read is denied');
reset role;
select * from finish();
rollback;
