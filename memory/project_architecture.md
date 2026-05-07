---
name: ArkTrader Hub Architecture
description: Key architectural decisions, fixes applied, and Deriv API integration patterns
type: project
---

## Stack
React 19 + TanStack Router (file-based) + Vite + Supabase + Nitro (Vercel)

## Deriv Integration
- WebSocket at `wss://ws.derivws.com/websockets/v3?app_id=133647`
- OAuth redirect URI: `https://www.arktradershub.com` (production only — hardcoded in buildOAuthUrl)
- Accounts stored in Supabase `sessions` table (deriv_token, is_demo, currency, balance)
- CR* = real accounts, VR* = demo accounts

## Critical Shared State Fix (2026-05-07)
`DerivBalanceProvider` in `src/contexts/deriv-balance.tsx` is the SINGLE SOURCE OF TRUTH for active account.
- Wraps entire app via `__root.tsx`
- All components use `useDerivBalance()` from this context — never fetch sessions independently
- Avoids race conditions where multiple WebSocket authorize() calls would switch each other's sessions

**Why:** Before this fix, TradePanel and TopShell each fetched their own Supabase session independently. Switching accounts in the header didn't update the TradePanel token, causing trades to execute on the wrong account or fail with currency mismatches.

## After Login → / (Manual Traders)
- `deriv-callback.tsx` redirects to `/` (not `/dashboard`)
- `/dashboard/` redirects to `/` via `beforeLoad`
- Dashboard sub-pages (trade, bot, analytics, settings) still accessible via sidebar

## Trade Currency Rule
Currency is LOCKED to the active Deriv account's currency. Users cannot manually override it in the UI.
**Why:** Sending a proposal with the wrong currency causes Deriv to return "insufficient balance" even if the account has funds in a different currency.

## Accumulator Barriers
Barriers come from the `subscribeProposal` WebSocket stream, not a one-time fetch. They update on every tick. The proposal must include `growth_rate` and `contract_type: "ACCU"`.
