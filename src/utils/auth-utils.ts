// Clears the bridge localStorage keys written before dbot.runBot() authorizes api_base.
// Never reloads — our app manages auth via React/Supabase, not page reloads.
export const clearAuthData = (): void => {
  try {
    localStorage.removeItem("authToken");
    localStorage.removeItem("active_loginid");
    localStorage.removeItem("accountsList");
  } catch {
    // ignore
  }
};

export const handleOidcAuthFailure = (error: unknown): void => {
  console.error("OIDC auth failed:", error);
  clearAuthData();
};
