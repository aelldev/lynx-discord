const STRUCTURAL_URL_PATTERNS = [
  /\b[a-z]{3,15}\d{2,3}\s*\.\s*pro\b/i,
  /\b(kast|rezo|spin|win|casino|bet|rzo|slot|cash|gold|royal|king|vip|crypto|coin)\w*\d*\s*\.\s*(pro|net|com|org|cc|cfd|top|xyz|club|live|site|win|bet)\b/i,
  /\bprofile\s*\/\s*(bonuses|withdraw|deposit|invite)\b/i,
  /\b\w+casino\w*\s*\.\s*(pro|net|com|org|cc|cfd|top|xyz|club|live|site|win|bet)\b/i,
];

const VERBATIM_PHRASES = [
  /vyro\s+project/i,
  /giving\s+away\s+\$?2[,.\s]?500\s+to\s+everyone/i,
  /withdraw\s+the\s+bonus\s+immediately/i,
  /post\s+will\s+be\s+deleted\s+an?\s+hour/i,
  /only\s+the\s+fastest\s+people\s+will\s+find\s+out/i,
  /promotion\s+will\s+last\s+for\s+several\s+days/i,
  /withdrawal\s+of\s+\$?2[,.\s]?700/i,
  /money\s+will\s+be\s+transferred\s+to\s+your\s+(specified\s+)?wallet/i,
  /withdrawal\s+success/i,
  /promo\s*code\s*[:=]?\s*launch/i,
  /(enter|use)\s+the\s+(special\s+)?promo\s*code/i,
  /honestly\s*[:=]?\s*\d{4}/i,
  /successfully\s+withdrawn/i,
  /your\s+withdrawal\s+(is|was|has\s+been)/i,
  /transferred?\s+to\s+your\s+wallet/i,
];

const COMBINATION_RULES = [
  {
    name: 'fake_celebrity_casino',
    required: [/x\s*\.\s*com\s*\/\s*\w+|twitter\s*\.\s*com\s*\/\s*\w+/i, /\.\s*(pro|net|com|cc|cfd|top|xyz)/i, /promo\s*code/i],
    score: 40
  },
  {
    name: 'fake_withdrawal_proof',
    required: [/withdraw/i, /(usdt|btc|eth|trx|usdc|crypto|bnb|sol)/i, /\$?\s*\d{3,}/],
    score: 40
  },
  {
    name: 'fake_giveaway',
    required: [/(giveaway|giving\s+away|free)/i, /(bonus|reward|prize|cash)/i, /(withdraw|claim|register)/i],
    score: 40
  },
  {
    name: 'scam_site_layout',
    required: [/(vip\s*[\-_]?\s*club|vip)/i, /(bonus|bonuses)/i, /deposit/i, /withdraw/i],
    score: 40
  },
  {
    name: 'scam_site_ui',
    required: [/rakeback/i, /(claim|withdraw)/i, /\$\s*\d/],
    score: 40
  },
  {
    name: 'crypto_casino_combo',
    required: [/casino/i, /(bonus|promo|reward)/i, /(crypto|usdt|btc|eth)/i],
    score: 40
  },
  {
    name: 'fake_celebrity_post',
    required: [/(mrbeast|elon|musk|trump|cz|binance|cristiano|ronaldo)/i, /(giveaway|bonus|crypto|casino)/i, /(register|claim|withdraw|promo)/i],
    score: 50
  },
];

const GENERAL_PATTERNS = [
  /\+\s*\d{3,}\s*(usdt|btc|eth|trx|usdc|bnb)/i,
  /network\s+fee.*0\s*(trx|gas)/i,
  /view\s+on\s+block\s*explorer/i,
  /activate\s+code\s+for\s+bonus/i,
  /\brakeback\b/i,
  /\blaunch\b.{0,30}\bactivate\b/i,
  /don'?t\s+miss\s+(your\s+)?chance/i,
  /offer\s+is\s+limited/i,
  /(crypto(currency)?\s+casino|casino\s+crypto)/i,
  /how\s+to\s+claim\s+(your\s+)?reward/i,
  /\bpromo\s*code\b/i,
  /\bregistration\s+bonus\b/i,
  /\bdeposit\s+bonus\b/i,
  /\bwelcome\s+bonus\b/i,
  /\bno\s+deposit\b/i,
  /\bfree\s+spins?\b/i,
  /\binstant\s+withdraw/i,
  /\bclaim\s+(your\s+)?\$?\d/i,
  /\$\d{2,4}\s*(bonus|reward|prize|free)/i,
  /\bjackpot\b/i,
  /\b(register|sign\s*up)\s+(now|today|to\s+claim|and)/i,
];

module.exports = {
  STRUCTURAL_URL_PATTERNS,
  VERBATIM_PHRASES,
  COMBINATION_RULES,
  GENERAL_PATTERNS,
};
