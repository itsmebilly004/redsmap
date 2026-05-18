// Minimal type stubs required by api-base.ts.
export type TAuthData = {
  loginid?: string;
  currency?: string;
  balance?: string | number;
  landing_company_shortcode?: string;
  is_virtual?: number | boolean;
  account_list?: Array<Record<string, unknown>>;
};
