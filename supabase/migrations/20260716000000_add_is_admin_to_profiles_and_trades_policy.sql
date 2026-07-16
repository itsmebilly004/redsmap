-- 1. Add `is_admin` to profiles if it doesn't exist.
alter table if exists public.profiles add column if not exists is_admin boolean default false;

-- 2. Add an RLS policy so admins can view all trades across the platform
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_select_admin'
  ) then
    create policy "trades_select_admin" on public.trades for select to authenticated using (
      exists (
        select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true
      )
    );
  end if;
end $$;
