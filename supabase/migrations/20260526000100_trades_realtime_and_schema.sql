-- Trades schema repair + realtime enablement.
--
-- An earlier migration created public.trades with the old column set
-- (contract_id / market / profit / result). Later code and the generated
-- Supabase types use deriv_contract_id / symbol / profit_loss / status.
-- On databases where the old migration ran first the insert path silently
-- fails with "column does not exist", so new trades never land — the
-- dashboard and analytics pages keep showing whatever was last persisted.
--
-- This migration is idempotent: it adds the new columns if they don't
-- exist, backfills them from the legacy columns, and drops the legacy
-- ones afterwards. It also makes sure the RLS policies a user needs to
-- read / insert / update their own trades exist, and adds the table to
-- the supabase_realtime publication so the dashboard's postgres_changes
-- subscription actually fires when a trade is inserted or settled.

-- 1. Ensure target columns exist with the expected types.
alter table if exists public.trades
  add column if not exists deriv_contract_id text,
  add column if not exists symbol text,
  add column if not exists profit_loss numeric,
  add column if not exists status text not null default 'open',
  add column if not exists duration text,
  add column if not exists entry_spot numeric,
  add column if not exists exit_spot numeric,
  add column if not exists closed_at timestamptz;

-- 2. Backfill from the legacy columns when they still hold the data.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'contract_id'
  ) then
    update public.trades set deriv_contract_id = coalesce(deriv_contract_id, contract_id);
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'market'
  ) then
    update public.trades set symbol = coalesce(symbol, market);
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'profit'
  ) then
    update public.trades set profit_loss = coalesce(profit_loss, profit);
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'result'
  ) then
    update public.trades
      set status = coalesce(
        nullif(status, ''),
        case result
          when 'win' then 'won'
          when 'loss' then 'lost'
          else result
        end
      );
  end if;
end $$;

-- 3. Symbol is non-null in the type definition — make sure no row violates that.
update public.trades set symbol = coalesce(symbol, 'unknown') where symbol is null;
alter table public.trades alter column symbol set not null;

-- 4. Drop the legacy columns now that data is migrated.
alter table public.trades drop column if exists contract_id;
alter table public.trades drop column if exists market;
alter table public.trades drop column if exists profit;
alter table public.trades drop column if exists result;
alter table public.trades drop column if exists is_demo;
alter table public.trades drop column if exists bot_id;
alter table public.trades drop column if exists updated_at;

-- 5. RLS — make sure the table is locked down and the per-user policies
--    exist (older migrations defined them under different names, so we
--    create the canonical set here only if it's missing).
alter table public.trades enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_select_own_v2'
  ) then
    create policy "trades_select_own_v2" on public.trades for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_insert_own_v2'
  ) then
    create policy "trades_insert_own_v2" on public.trades for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_update_own_v2'
  ) then
    create policy "trades_update_own_v2" on public.trades for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trades' and policyname = 'trades_delete_own_v2'
  ) then
    create policy "trades_delete_own_v2" on public.trades for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- 6. Make sure REPLICA IDENTITY FULL is set so DELETE / UPDATE payloads
--    carry enough info for the supabase_realtime stream, then add the
--    table to the realtime publication if it isn't already a member.
alter table public.trades replica identity full;

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'trades'
  ) then
    alter publication supabase_realtime add table public.trades;
  end if;
end $$;

-- 7. Index on (user_id, created_at desc) so the dashboard's "latest 5
--    trades per user" query stays fast as the table grows.
create index if not exists trades_user_created_idx on public.trades (user_id, created_at desc);

notify pgrst, 'reload schema';
