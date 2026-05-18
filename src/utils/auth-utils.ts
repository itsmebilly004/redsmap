// Clears the bridge localStorage keys written before dbot.runBot() authorizes api_base.
export const clearAuthData = (is_reload = true): void => {
  try {
    localStorage.removeItem("authToken");
    localStorage.removeItem("active_loginid");
    localStorage.removeItem("accountsList");
  } catch {
    // ignore
  }
  if (is_reload) {
    location.reload();
  }
};

export const handleOidcAuthFailure = (error: unknown): void => {
  console.error("OIDC auth failed:", error);
  clearAuthData(false);
};
