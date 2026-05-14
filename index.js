const config = require('./src/config');
const log = require('./src/logger');
const { createClient } = require('./src/client');
const { initWorker, shutdownWorker } = require('./src/detector');
const { suppressTesseractNoise } = require('./src/utils');

suppressTesseractNoise();

const client = createClient();

async function main() {
  if (!config.TOKEN) {
    log.error('main', 'DISCORD_TOKEN belum di setting di config.json');
    process.exit(1);
  }

  log.info(`starting ${config.BOT_NAME}…`);
  log.info(`init Tesseract worker pool (${config.DUAL_PASS_OCR ? Math.max(2, config.WORKER_COUNT) : config.WORKER_COUNT})`);

  const t0 = Date.now();
  await initWorker();
  log.info(`worker pool ready in ${Date.now() - t0}ms`);

  log.info('logging in to discord…');
  await client.login(config.TOKEN);
}

async function shutdown(reason) {
  log.info(`shutting down (${reason})…`);
  try { await shutdownWorker(); } catch (e) { log.error('shutdown.worker', e); }
  try { client.destroy(); } catch (e) { log.error('shutdown.client', e); }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => log.error('unhandledRejection', err));
process.on('uncaughtException', (err) => log.error('uncaughtException', err));

main().catch((err) => {
  log.error('main', err);
  process.exit(1);
});
