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

export type NormalizedDerivAccount = {
  account_id: string;
  loginid: string;
  currency: string | null;
  balance: number;
  deriv_token?: string | null;
  is_demo: boolean;
  is_virtual: boolean;
  account_type: string | null;
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

export function isDemoAccount(account: DerivAccountLike) {
  const loginId = accountLoginId(account).toUpperCase();
  const accountType = stringFrom(
    account.account_type,
    account.category,
    account.type,
    account["account_category"],
  ).toLowerCase();
  const isVirtual = booleanFrom(account.is_virtual);
  const isDemo = booleanFrom(account.is_demo);

  if (loginId.startsWith("VRTC") || loginId.startsWith("VR")) return true;
  if (loginId.startsWith("CR") || loginId.startsWith("DOT")) return false;
  if (isVirtual === true || isDemo === true) return true;
  if (isVirtual === false || isDemo === false) return false;
  if (accountType.includes("demo") || accountType.includes("virtual")) return true;
  if (accountType.includes("real")) return false;
  return false;
}

export function isRealAccount(account: DerivAccountLike) {
  return !isDemoAccount(account);
}

export function normalizeDerivAccount(account: DerivAccountLike) {
  const accountId = accountLoginId(account);
  if (!accountId) return null;

  const demo = isDemoAccount({ ...account, account_id: accountId, loginid: accountId });
  return {
    ...account,
    account_id: accountId,
    loginid: accountId,
    currency: stringFrom(account.currency, demo ? "USD" : "") || null,
    balance: numberFrom(account.balance),
    is_demo: demo,
    is_virtual: demo,
    account_type: stringFrom(account.account_type, account.category, account.type) || null,
    status: stringFrom(account.status, "active"),
  } satisfies NormalizedDerivAccount & DerivAccountLike;
}
