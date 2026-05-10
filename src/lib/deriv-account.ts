export type DerivAccountLike = Record<string, unknown> & {
  account_id?: string | null;
  loginid?: string | null;
  login_id?: string | null;
  accountId?: string | null;
  id?: string | null;
  currency?: string | null;
  balance?: string | number | { amount?: string | number } | null;
  deriv_token?: string | null;
  is_demo?: boolean | string | number | null;
  is_virtual?: boolean | string | number | null;
  account_type?: string | null;
  category?: string | null;
  type?: string | null;
  status?: string | null;
};

export type DerivAccountType = "demo" | "real" | "unknown";

export type DerivAccountClassification = {
  type: DerivAccountType;
  reason: string;
};

export type NormalizedDerivAccount = {
  account_id: string;
  loginid: string;
  type: DerivAccountType;
  currency: string | null;
  balance: number;
  deriv_token?: string | null;
  is_demo: boolean;
  is_virtual: boolean;
  account_type: string | null;
  classification_reason: string;
  status?: string;
};

export function stringFrom(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

export function booleanFrom(value: unknown) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
}

export function numberFrom(value: unknown) {
  const raw =
    typeof value === "object" && value !== null && "amount" in value
      ? (value as { amount?: unknown }).amount
      : value;
  if (raw == null || raw === "") return 0;
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

export function accountLoginId(account: DerivAccountLike) {
  return stringFrom(
    account.loginid,
    account.account_id,
    account.login_id,
    account.accountId,
    account.id,
  );
}

function allAccountIdentityText(account: DerivAccountLike) {
  return [
    account.loginid,
    account.account_id,
    account.login_id,
    account.accountId,
    account.id,
    account.account_type,
    account.category,
    account.type,
    account["account_category"],
    account["landing_company_shortcode"],
    account["display_name"],
    account["name"],
  ]
    .map((value) => String(value ?? "").trim().toUpperCase())
    .filter(Boolean);
}

export function classifyDerivAccount(account: DerivAccountLike): DerivAccountClassification {
  const accountIds = [
    account.loginid,
    account.account_id,
    account.login_id,
    account.accountId,
    account.id,
  ]
    .map((value) => String(value ?? "").trim().toUpperCase())
    .filter(Boolean);
  const identityParts = allAccountIdentityText(account);
  const identityText = identityParts.join(" ");
  const isVirtual = booleanFrom(account.is_virtual);
  const isDemo = booleanFrom(account.is_demo);
  const demoPrefixId = accountIds.find((id) => /^(VRTC|VRT|VR)/.test(id));
  const realPrefixId = accountIds.find((id) => /^(CR|DOT|MF|MX)/.test(id));
  const tokenPrefixId = accountIds.find((id) => /^(USDT|TRC20|BTC|ETH|LTC|USDC|UST)/.test(id));

  if (demoPrefixId) {
    return {
      type: "demo",
      reason: `demo account id prefix ${demoPrefixId.match(/^(VRTC|VRT|VR)/)?.[0]}`,
    };
  }
  if (identityText.includes("VIRTUAL") || identityText.includes("DEMO") || identityText.includes("PRACTICE")) {
    return { type: "demo", reason: "virtual/demo identity metadata" };
  }
  if (realPrefixId) {
    return {
      type: "real",
      reason: `real account id prefix ${realPrefixId.match(/^(CR|DOT|MF|MX)/)?.[0]}`,
    };
  }
  if (tokenPrefixId) {
    return { type: "real", reason: `token/crypto account id prefix ${tokenPrefixId}` };
  }
  if (isVirtual === true || isDemo === true) {
    return { type: "demo", reason: "is_virtual/is_demo metadata true" };
  }
  if (isVirtual === false && isDemo === false) {
    return { type: "real", reason: "is_virtual and is_demo metadata false" };
  }
  if (identityText.includes("REAL")) {
    return { type: "real", reason: "real identity metadata" };
  }
  return { type: "unknown", reason: "no reliable account id prefix or account type metadata" };
}

export function getDerivAccountType(account: DerivAccountLike) {
  return classifyDerivAccount(account).type;
}

export function isDemoAccount(account: DerivAccountLike) {
  return getDerivAccountType(account) === "demo";
}

export function isRealAccount(account: DerivAccountLike) {
  return getDerivAccountType(account) === "real";
}

export function isUnknownAccount(account: DerivAccountLike) {
  return getDerivAccountType(account) === "unknown";
}

export function normalizeDerivAccount(account: DerivAccountLike) {
  const accountId = accountLoginId(account);
  if (!accountId) return null;

  const classification = classifyDerivAccount({ ...account, account_id: accountId, loginid: accountId });
  const demo = classification.type === "demo";
  return {
    ...account,
    account_id: accountId,
    loginid: accountId,
    type: classification.type,
    classification_reason: classification.reason,
    currency: stringFrom(account.currency, demo ? "USD" : "") || null,
    balance: numberFrom(account.balance),
    is_demo: demo,
    is_virtual: demo,
    account_type: stringFrom(account.account_type, account.category, account.type) || null,
    status: stringFrom(account.status, "active"),
  } satisfies NormalizedDerivAccount & DerivAccountLike;
}
