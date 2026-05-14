const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(process.cwd(), 'config.json');

function loadUserConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`[ERROR] config.json not found at ${CONFIG_PATH}`);
    console.error('        config.json and fill in your token');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error(`[ERROR] failed to parse config.json — ${e.message}`);
    process.exit(1);
  }
}

const user = loadUserConfig();

module.exports = {
  TOKEN: user.token || '',
  BOT_NAME: user.botName || 'LYNX',

  THRESHOLD: user.threshold ?? 60,
  AUTO_DELETE: user.autoDelete !== false,
  MONITORED_CHANNELS: Array.isArray(user.monitoredChannels) ? user.monitoredChannels : [],
  IGNORED_CHANNELS: Array.isArray(user.ignoredChannels) ? user.ignoredChannels : [],

  OCR_LANG: 'eng',
  WORKER_COUNT: user.workerCount ?? 4,
  MAX_CONCURRENT_OCR: user.maxConcurrentOcr ?? 8,
  MAX_QUEUE_SIZE: 200,

  MAX_IMAGE_SIZE: 1000,
  MIN_IMAGE_DIM: 200,
  MAX_FILE_SIZE: 8 * 1024 * 1024,

  // OCR strategy
  DUAL_PASS_OCR: true,           // jalanin pass 1 (normal) + pass 2 (inverted) paralel
  SCORE_SHORTCUT: true,          // pass yang balik duluan udah SCAM → return tanpa nunggu yg kedua

  TESSDATA_URL: null,
  TESSDATA_CACHE: './.tessdata',
  FRESH_MODEL_ON_START: false,

  ENABLE_CACHE: true,
  CACHE_SIZE: 1000,

  EARLY_EXIT: true,

  LOG_SCAN: user.logging?.logScan ?? true,
  LOG_OCR_TEXT: user.logging?.logOcrText ?? false,
  LOG_LATENCY_BREAKDOWN: user.logging?.logLatencyBreakdown ?? false,
  SUPPRESS_TESSERACT_NOISE: true,
  DEBUG_MODE: user.logging?.debugMode ?? false,

  RATE_LIMIT: {
    USER_MAX: 5,
    USER_PER_SECONDS: 60,
    GUILD_MAX: 30,
    GUILD_PER_SECONDS: 60,
  },
};
