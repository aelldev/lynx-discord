const config = require('./config');

const useColor = !!process.stdout.isTTY;

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function paint(color, text) {
  if (!useColor) return text;
  return `${color}${text}${C.reset}`;
}

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const LEVELS = {
  info:  { tag: 'INFO ', color: C.cyan },
  ready: { tag: 'READY', color: C.green + C.bold },
  warn:  { tag: 'WARN ', color: C.yellow },
  error: { tag: 'ERROR', color: C.red + C.bold },
  scam:  { tag: 'SCAM ', color: C.red + C.bold },
  scan:  { tag: 'SCAN ', color: C.gray },
  debug: { tag: 'DEBUG', color: C.magenta },
  ocr:   { tag: 'OCR  ', color: C.blue },
};

function write(level, msg, indent = false) {
  const cfg = LEVELS[level] || LEVELS.info;
  const time = paint(C.dim, ts());
  const tag = paint(cfg.color, cfg.tag);
  const prefix = indent ? '         ' : `${time}  ${tag}  `;
  process.stdout.write(`${prefix}${msg}\n`);
}

module.exports = {
  info(msg)  { write('info', msg); },
  ready(msg) { write('ready', msg); },
  warn(msg)  { write('warn', msg); },
  error(fnName, err) {
    const m = err && err.message ? err.message : String(err);
    write('error', `${paint(C.dim, fnName)} — ${m}`);
  },
  scam(msg, sub) {
    write('scam', msg);
    if (sub) write('scam', paint(C.dim, sub), true);
  },
  scan(msg) {
    if (config.LOG_SCAN || config.DEBUG_MODE) write('scan', paint(C.dim, msg));
  },
  debug(msg) {
    if (config.DEBUG_MODE) write('debug', msg);
  },
  ocr(msg) {
    if (config.LOG_OCR_TEXT || config.DEBUG_MODE) write('ocr', paint(C.dim, msg));
  },
  paint,
  C,
};
