
-- Allow admins to view all users
do $`$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_select_admin'
  ) then
    create policy "users_select_admin" on public.users for select using (
      exists (
        select 1 from public.users u where u.id = auth.uid() and u.is_admin = true
      )
    );
  end if;
end $`$;
