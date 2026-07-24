// Default values
let dynamicLegacyAppId = "133647";
let dynamicOauthClientId = "33dKDiaoKZ0hKLgNW0IzW";

export function setDynamicAppIds(legacyId: string, oauthId: string) {
  if (legacyId) dynamicLegacyAppId = legacyId;
  if (oauthId) dynamicOauthClientId = oauthId;
}

export function getDerivLegacyAppId() {
  return dynamicLegacyAppId;
}

export function getDerivOauthClientId() {
  return dynamicOauthClientId;
}

// Keep the exports for compatibility but use getters
export const DERIV_OAUTH_CLIENT_ID = "33dKDiaoKZ0hKLgNW0IzW"; // Note: Prefer getDerivOauthClientId() instead
export const DERIV_REDIRECT_URI = "https://www.redsmaptraders.com/deriv-callback";
export const DERIV_OAUTH_AUTHORIZE_ENDPOINT = "https://auth.deriv.com/oauth2/auth";
export const DERIV_OAUTH_TOKEN_ENDPOINT = "https://auth.deriv.com/oauth2/token";
export const DERIV_API_BASE_URL = "https://api.derivws.com";
export const DERIV_OAUTH_SCOPE = "trade account_manage";

export const DERIV_LEGACY_APP_ID = "133647"; // Note: Prefer getDerivLegacyAppId() instead
export const DERIV_LEGACY_REDIRECT_URI = "https://www.redsmaptraders.com/redirect";
export const DERIV_LEGACY_AUTHORIZE_ENDPOINT = "https://oauth.deriv.com/oauth2/authorize";
export const DERIV_LEGACY_WEBSOCKET_URL = "wss://ws.derivws.com/websockets/v3";
