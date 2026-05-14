const axios = require('axios');
const config = require('./config');

async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    maxContentLength: 25 * 1024 * 1024,
  });
  return Buffer.from(res.data);
}

const userBuckets = new Map();
const guildBuckets = new Map();

function pruneBuckets() {
  const now = Date.now();
  const stale = 10 * 60 * 1000;
  for (const [id, ts] of userBuckets) {
    if (!ts.length || now - ts[ts.length - 1] > stale) userBuckets.delete(id);
  }
  for (const [id, ts] of guildBuckets) {
    if (!ts.length || now - ts[ts.length - 1] > stale) guildBuckets.delete(id);
  }
}
setInterval(pruneBuckets, 5 * 60 * 1000).unref();

function checkBucket(map, id, max, windowSec) {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const bucket = map.get(id) || [];
  const fresh = bucket.filter((t) => now - t < windowMs);

  if (fresh.length >= max) {
    map.set(id, fresh);
    return false;
  }
  fresh.push(now);
  map.set(id, fresh);
  return true;
}

function checkUserRateLimit(userId) {
  return checkBucket(userBuckets, userId, config.RATE_LIMIT.USER_MAX, config.RATE_LIMIT.USER_PER_SECONDS);
}

function checkGuildRateLimit(guildId) {
  return checkBucket(guildBuckets, guildId, config.RATE_LIMIT.GUILD_MAX, config.RATE_LIMIT.GUILD_PER_SECONDS);
}

function isImageAttachment(att) {
  if (!att) return false;
  const name = (att.name || '').toLowerCase();
  const ct = (att.contentType || '').toLowerCase();
  if (ct.startsWith('image/')) return true;
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
}

function isWorthScanning(att) {
  if (!isImageAttachment(att)) return false;

  const minDim = config.MIN_IMAGE_DIM || 0;
  if (minDim > 0 && att.width && att.height) {
    if (att.width < minDim || att.height < minDim) return false;
  }

  const maxSize = config.MAX_FILE_SIZE || 0;
  if (maxSize > 0 && att.size && att.size > maxSize) return false;

  return true;
}

function normalizeOcrText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\bo(\d)/g, '0$1')
    .replace(/(\d)o\b/g, '$10')
    .replace(/\bl(\d)/g, '1$1')
    .replace(/(\d)l\b/g, '$11')
    .replace(/\s+/g, ' ')
    .trim();
}

function suppressTesseractNoise() {
  if (!config.SUPPRESS_TESSERACT_NOISE) return;
  const origStderr = process.stderr.write.bind(process.stderr);
  const noise = [
    /Estimating resolution as/,
    /Error in boxClipToRectangle/,
    /Error in pixScanForForeground/,
    /Empty page!!/,
    /Detected \d+ diacritics/,
  ];
  process.stderr.write = function (chunk, ...rest) {
    const s = typeof chunk === 'string' ? chunk : chunk.toString();
    if (noise.some((r) => r.test(s))) return true;
    return origStderr(chunk, ...rest);
  };
}

function shortenUrl(url, max = 50) {
  if (!url || url.length <= max) return url || '';
  return url.slice(0, max - 3) + '...';
}

module.exports = {
  downloadBuffer,
  checkUserRateLimit,
  checkGuildRateLimit,
  isImageAttachment,
  isWorthScanning,
  normalizeOcrText,
  suppressTesseractNoise,
  shortenUrl,
};
