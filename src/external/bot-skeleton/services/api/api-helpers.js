// Stub ApiHelpers. The reference module wires four full services
// (TradingTimes, ContractsFor, ActiveSymbols, AccountLimits) on top of
// a Deriv websocket connection (api-base). For the visual-only port we
// expose the same SHAPE the block definitions read via optional chaining
// (`ApiHelpers?.instance?.contracts_for`), but back the methods with empty
// defaults. Symbol/contract dropdowns will be empty until a future task
// bridges these to arktrader's deriv-trading-service.

const EMPTY_RESULT = { list: [], categories: {}, getContractType: () => null };

class ContractsForStub {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDurations(_symbol, _contract_type) {
    return Promise.resolve([]);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAllowedCategories(_symbol) {
    return Promise.resolve(EMPTY_RESULT);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getBarriers(_symbol, _trade_type) {
    return Promise.resolve({ values: [] });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPredictionRange(_symbol, _trade_type) {
    return Promise.resolve([]);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getMultiplierRange(_symbol) {
    return Promise.resolve([]);
  }
  unregisterContractsForConditions() {}
  disposeCache() {}
}

class ActiveSymbolsStub {
  active_symbols = [];
  retrieveActiveSymbols() {
    return Promise.resolve([]);
  }
  getSymbolsForMarket() {
    return [];
  }
  getMarketsBySubmarkets() {
    return {};
  }
  isSymbolOpen() {
    return true;
  }
  disposeCache() {}
}

class TradingTimesStub {
  retrieveTradingTimes() {
    return Promise.resolve({});
  }
  isMarketClosed() {
    return false;
  }
  disposeCache() {}
}

class AccountLimitsStub {
  account_limits = {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getStakePayoutLimits(_currency, _landing_company, _market, _contract_category) {
    return Promise.resolve({ min_stake: 0.35, max_payout: 50000 });
  }
  disposeCache() {}
}

class ApiHelpers {
  static singleton = null;

  constructor() {
    this.trading_times = new TradingTimesStub();
    this.contracts_for = new ContractsForStub();
    this.active_symbols = new ActiveSymbolsStub();
    this.account_limits = new AccountLimitsStub();
  }

  static disposeInstance() {
    ApiHelpers.singleton = null;
  }

  static setInstance() {
    if (!ApiHelpers.singleton) {
      ApiHelpers.singleton = new ApiHelpers();
    }
    return ApiHelpers.singleton;
  }

  static get instance() {
    return ApiHelpers.singleton;
  }
}

export default ApiHelpers;
