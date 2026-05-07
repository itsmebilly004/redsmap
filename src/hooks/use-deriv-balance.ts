// Re-export from context for backwards compatibility.
// The actual state now lives in DerivBalanceProvider (contexts/deriv-balance.tsx)
// so all components share one source of truth for the active Deriv account.
export { useDerivBalance } from "@/contexts/deriv-balance";
export type { DerivAccount, DerivBalanceContextType as LiveBalance } from "@/contexts/deriv-balance";
