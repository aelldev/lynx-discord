const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const log = require('./logger');
const { downloadBuffer, normalizeOcrText, shortenUrl } = require('./utils');
const { ocrSemaphore, trackDropped } = require('./queue');
const {
  STRUCTURAL_URL_PATTERNS,
  VERBATIM_PHRASES,
  COMBINATION_RULES,
  GENERAL_PATTERNS,
} = require('./fingerprints');

class WorkerPool {
  constructor() {
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.ready = false;
  }

  async init() {
    const cacheDir = config.TESSDATA_CACHE
      ? path.resolve(config.TESSDATA_CACHE)
      : null;

    if (cacheDir) {
      if (config.FRESH_MODEL_ON_START) {
        try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch (e) { /* gpp */ }
      }
      try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) { /* gpp */ }
    }

    const baseSize = Math.max(1, config.WORKER_COUNT || 4);
    // dual-pass butuh minimal 2 worker biar pass 1 dan 2 jalan paralel beneran
    const size = config.DUAL_PASS_OCR ? Math.max(2, baseSize) : baseSize;

    const ws = await Promise.all(
      Array.from({ length: size }, () => this._spawn())
    );
    this.workers = ws;
    this.idle = [...ws];
    this.ready = true;
  }

  async _spawn() {
    const opts = {
      logger: () => {},
      errorHandler: () => {},
      cachePath: config.TESSDATA_CACHE,
      cacheMethod: 'readWrite',
    };
    if (config.TESSDATA_URL) opts.langPath = config.TESSDATA_URL;

    const w = await Tesseract.createWorker(config.OCR_LANG, 1, opts);

    await w.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_do_invert: '0',
      tessjs_create_hocr: '0',
      tessjs_create_tsv: '0',
      tessjs_create_box: '0',
      tessjs_create_unlv: '0',
      tessjs_create_osd: '0',
    });

    return w;
  }

  acquire() {
    if (this.idle.length > 0) return Promise.resolve(this.idle.pop());
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(w) {
    const next = this.queue.shift();
    if (next) next(w);
    else this.idle.push(w);
  }

  async recognize(buffer) {
    const w = await this.acquire();
    try {
      const { data } = await w.recognize(buffer);
      return data && data.text ? data.text : '';
    } finally {
      this.release(w);
    }
  }

  async terminate() {
    if (!this.ready) return;
    await Promise.all(this.workers.map((w) => w.terminate().catch(() => {})));
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.ready = false;
  }

  size() { return this.workers.length; }
}

const pool = new WorkerPool();

class ResultCache {
  constructor(max) {
    this.max = max;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const v = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  set(key, val) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, val);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }
  size() { return this.map.size; }
}

const cache = new ResultCache(config.CACHE_SIZE || 1000);

async function preprocessNormal(buffer) {
  const size = config.MAX_IMAGE_SIZE || 1000;
  return sharp(buffer, { failOn: 'none' })
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .grayscale()
    .normalise()
    .toBuffer();
}

async function preprocessInverted(buffer) {
  const size = config.MAX_IMAGE_SIZE || 1000;
  return sharp(buffer, { failOn: 'none' })
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .grayscale()
    .negate({ alpha: false })
    .normalise()
    .toBuffer();
}

function textQuality(text) {
  if (!text) return 0;
  const total = text.length;
  if (total === 0) return 0;
  let valid = 0;
  for (let i = 0; i < total; i++) {
    const c = text.charCodeAt(i);
    if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
        c === 32 || c === 10 || c === 9 ||
        c === 46 || c === 44 || c === 33 || c === 63 || c === 39 || c === 34 ||
        c === 36 || c === 58 || c === 59 || c === 47 || c === 45 || c === 95 ||
        c === 40 || c === 41 || c === 64 || c === 37 || c === 38) {
      valid++;
    }
  }
  return valid / total;
}

function testPattern(pat, raw, normalized) {
  if (pat.test(raw)) return true;
  if (normalized && pat.test(normalized)) return true;
  return false;
}

function scoreText(rawText) {
  const matches = [];
  let total = 0;
  const norm = normalizeOcrText(rawText);

  for (const pat of STRUCTURAL_URL_PATTERNS) {
    if (testPattern(pat, rawText, norm)) {
      total += 60;
      matches.push({ type: 'STRUCTURAL_URL', pattern: pat.toString(), points: 60 });
    }
  }
  for (const pat of VERBATIM_PHRASES) {
    if (testPattern(pat, rawText, norm)) {
      total += 50;
      matches.push({ type: 'VERBATIM_PHRASE', pattern: pat.toString(), points: 50 });
    }
  }
  for (const rule of COMBINATION_RULES) {
    if (rule.required.every((r) => testPattern(r, rawText, norm))) {
      total += rule.score;
      matches.push({ type: 'COMBINATION', pattern: rule.name, points: rule.score });
    }
  }
  for (const pat of GENERAL_PATTERNS) {
    if (testPattern(pat, rawText, norm)) {
      total += 20;
      matches.push({ type: 'GENERAL', pattern: pat.toString(), points: 20 });
    }
  }

  return { total, matches };
}

// kedua pass jalan paralel. winner of race dicek dulu kalau udah cukup buat SCAM verdict,
// langsung return tanpa nunggu pass kedua. SAFE verdict tetep nunggu kedua biar gak miss.
async function runOcr(rawBuf) {
  if (!config.DUAL_PASS_OCR) {
    const proc = await preprocessNormal(rawBuf);
    const text = await pool.recognize(proc);
    return { text, passes: 1, qN: textQuality(text), qI: null };
  }

  const [normalProc, invertedProc] = await Promise.all([
    preprocessNormal(rawBuf),
    preprocessInverted(rawBuf),
  ]);
  const pN = pool.recognize(normalProc).then((t) => ({ which: 'N', text: t }));
  const pI = pool.recognize(invertedProc).then((t) => ({ which: 'I', text: t }));
  if (config.SCORE_SHORTCUT) {
    const first = await Promise.race([pN, pI]);
    const { total } = scoreText(first.text);
    if (total >= config.THRESHOLD) {
      const q = textQuality(first.text);
      return {
        text: first.text,
        passes: 1,
        qN: first.which === 'N' ? q : null,
        qI: first.which === 'I' ? q : null,
        raced: true,
      };
    }
  }

  // SAFE perlu konfirmasi dari pass 2 biar gak miss dark-bg case
  const [resN, resI] = await Promise.all([pN, pI]);
  const qN = textQuality(resN.text);
  const qI = textQuality(resI.text);

  let text;
  if (qN > 0.5 && qI > 0.5) text = resN.text + '\n' + resI.text;
  else text = qI > qN ? resI.text : resN.text;

  return { text, passes: 2, qN, qI };
}

async function analyzeImage(url) {
  const t0 = Date.now();
  try {
    const tDownloadStart = Date.now();
    const raw = await downloadBuffer(url);
    const tDownload = Date.now() - tDownloadStart;

    let hash = null;
    if (config.ENABLE_CACHE) {
      hash = crypto.createHash('sha1').update(raw).digest('hex');
      const cached = cache.get(hash);
      if (cached) {
        log.scan(`${cached.isScam ? 'SCAM' : 'safe'} · ${cached.score}p · cached · ${shortenUrl(url)} (${Date.now() - t0}ms)`);
        return { ...cached, url, fromCache: true };
      }
    }

    const tOcrStart = Date.now();
    const ocr = await ocrSemaphore.run(() => runOcr(raw));
    const tOcr = Date.now() - tOcrStart;
    const text = ocr.text;

    if (!text || !text.trim()) {
      const latency = Date.now() - t0;
      log.scan(`safe · empty-ocr · ${shortenUrl(url)} (${latency}ms)`);
      return {
        url, ok: true, isScam: false, score: 0, matches: [], text: '',
        fromCache: false, latency,
      };
    }

    const { total, matches } = scoreText(text);
    const isScam = total >= config.THRESHOLD;
    const latency = Date.now() - t0;

    const result = {
      url, ok: true, isScam, score: total, matches, text,
      fromCache: false, latency,
    };

    if (config.ENABLE_CACHE && hash) {
      const { url: _u, ...cacheable } = result;
      cache.set(hash, cacheable);
    }

    const verdict = isScam ? 'SCAM' : 'safe';
    const matchPreview = matches.length
      ? matches.slice(0, 3).map((m) => `${m.type.toLowerCase()}+${m.points}`).join(' ')
      : 'no-match';
    const passInfo = ocr.raced ? '1p*' : `${ocr.passes}p`;
    log.scan(`${verdict} · ${total}p · ${matchPreview} · ${passInfo} · ${shortenUrl(url)} (${latency}ms)`);

    if (config.LOG_LATENCY_BREAKDOWN) {
      log.debug(`latency · download=${tDownload}ms ocr=${tOcr}ms total=${latency}ms passes=${ocr.passes}${ocr.raced ? ' (raced)' : ''}`);
    }

    if (config.LOG_OCR_TEXT) {
      const preview = (text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const qNStr = ocr.qN != null ? ocr.qN.toFixed(2) : '-';
      const qIStr = ocr.qI != null ? ocr.qI.toFixed(2) : '-';
      log.ocr(`${shortenUrl(url, 40)} [q ${qNStr}/${qIStr}]: "${preview}${(text || '').length > 200 ? '...' : ''}"`);
    }

    return result;
  } catch (err) {
    if (err && err.message === 'queue-full') {
      trackDropped();
      log.warn(`OCR queue full, dropping ${shortenUrl(url)}`);
    } else {
      log.error('analyzeImage', err);
    }
    return {
      url, ok: false, isScam: false, score: 0, matches: [], text: '',
      fromCache: false, error: err.message,
    };
  }
}

async function analyzeImagesWithEarlyExit(urls, onFirstScam) {
  let triggered = false;
  return Promise.all(
    urls.map(async (u) => {
      const r = await analyzeImage(u);
      if (r.isScam && !triggered) {
        triggered = true;
        if (typeof onFirstScam === 'function') {
          Promise.resolve(onFirstScam(r)).catch((e) => log.error('onFirstScam', e));
        }
      }
      return r;
    })
  );
}

async function analyzeImages(urls) {
  return Promise.all(urls.map((u) => analyzeImage(u)));
}

module.exports = {
  initWorker: () => pool.init(),
  shutdownWorker: () => pool.terminate(),
  workerCount: () => pool.size(),
  cacheSize: () => cache.size(),
  analyzeImage,
  analyzeImages,
  analyzeImagesWithEarlyExit,
};
