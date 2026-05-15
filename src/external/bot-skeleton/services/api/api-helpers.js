// Stub ApiHelpers. The reference wires four real services (TradingTimes,
// ContractsFor, ActiveSymbols, AccountLimits) on top of a live Deriv
// websocket. For the visual-only port we expose the same SHAPE — block
// definitions use both optional chaining (`ApiHelpers?.instance?.contracts_for`)
// AND direct method calls (`active_symbols.getMarketDropdownOptions()`) — but
// every method here returns a safe empty default. Symbol/contract dropdowns
// will be empty until a future task bridges these to arktrader's
// deriv-trading-service. Blockly dropdowns require a non-empty list shaped
// as [[displayText, value], ...].

const EMPTY_DROPDOWN = [["", ""]];

class ContractsForStub {
  getDurations() {
    return Promise.resolve([]);
  }
  getAllowedCategories() {
    return Promise.resolve({ list: [], categories: {}, getContractType: () => null });
  }
  getBarriers() {
    return Promise.resolve({ values: [] });
  }
  getPredictionRange() {
    return Promise.resolve([]);
  }
  getMultiplierRange() {
    return Promise.resolve([]);
  }
  getTradeTypeCategories() {
    return Promise.resolve(EMPTY_DROPDOWN);
  }
  getTradeTypes() {
    return Promise.resolve(EMPTY_DROPDOWN);
  }
  getContractTypes() {
    return Promise.resolve(EMPTY_DROPDOWN);
  }
  getCandleIntervals() {
    return Promise.resolve(EMPTY_DROPDOWN);
  }
  hasGetDurations() {
    return false;
  }
  unregisterContractsForConditions() {}
  disposeCache() {}
}

class ActiveSymbolsStub {
  active_symbols = [];
  retrieveActiveSymbols() {
    return Promise.resolve([]);
  }
  // Blockly dropdown contract: [[displayText, value], ...] with >=1 entry.
  getMarketDropdownOptions() {
    return EMPTY_DROPDOWN;
  }
  getSubmarketDropdownOptions() {
    return EMPTY_DROPDOWN;
  }
  getSymbolDropdownOptions() {
    return EMPTY_DROPDOWN;
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
  isSymbolAvailable() {
    return false;
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
  getStakePayoutLimits() {
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
