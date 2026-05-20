-- Server-side bot execution sessions
-- Tracks bots that should continue running even when the user's browser is closed.

CREATE TABLE IF NOT EXISTS public.active_bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  settings JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'browser_running', 'running', 'stopped', 'error')),
  running_profit NUMERIC NOT NULL DEFAULT 0,
  current_stake NUMERIC NOT NULL DEFAULT 0,
  completed_runs INTEGER NOT NULL DEFAULT 0,
  stop_reason TEXT,
  error_message TEXT,
  runner_id UUID,
  runner_locked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.active_bot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY active_bot_sessions_own ON public.active_bot_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Atomic lock acquisition for distributed edge function runners.
-- Returns TRUE if this caller acquired the lock; FALSE if another runner is active.
CREATE OR REPLACE FUNCTION public.acquire_bot_session_lock(
  p_session_id UUID,
  p_runner_id UUID,
  p_lock_timeout_seconds INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE active_bot_sessions
  SET runner_id = p_runner_id, runner_locked_at = NOW()
  WHERE id = p_session_id
    AND status IN ('pending', 'browser_running', 'running')
    AND (
      runner_id IS NULL
      OR runner_locked_at IS NULL
      OR runner_locked_at < NOW() - (p_lock_timeout_seconds::TEXT || ' seconds')::INTERVAL
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- Only the service role (edge functions) can call the lock function
REVOKE EXECUTE ON FUNCTION public.acquire_bot_session_lock FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_bot_session_lock TO service_role;

-- Enable Realtime so clients receive live trade updates while server is executing
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_bot_sessions;
