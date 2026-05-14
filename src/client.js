const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType,
} = require('discord.js');

const config = require('./config');
const log = require('./logger');
const { handleMessage } = require('./handler');
const { workerCount, cacheSize } = require('./detector');
const { ocrSemaphore, getDropped } = require('./queue');

function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
    sweepers: {
      messages: { interval: 300, lifetime: 600 },
      users: { interval: 3600, filter: () => (u) => u.bot && u.id !== client.user?.id },
    },
  });

  client.once(Events.ClientReady, () => {
    log.ready(`logged in as ${client.user.tag}`);
    log.info(`workers     ${workerCount()}`);
    log.info(`max-ocr     ${config.MAX_CONCURRENT_OCR}`);
    log.info(`threshold   ${config.THRESHOLD}`);
    log.info(`auto-delete ${config.AUTO_DELETE ? 'on' : 'off'}`);
    log.info(`dual-pass   ${config.DUAL_PASS_OCR ? 'on' : 'off'}`);
    log.info(`cache       ${config.ENABLE_CACHE ? `on (${config.CACHE_SIZE})` : 'off'}`);
    log.info(`guilds      ${client.guilds.cache.size}`);

    const updatePresence = () => {
      const gc = client.guilds.cache.size;
      client.user.setPresence({
        activities: [{ name: `${gc} server${gc > 1 ? 's' : ''}`, type: ActivityType.Watching }],
        status: 'online',
      });
    };
    updatePresence();
    setInterval(updatePresence, 5 * 60 * 1000).unref();

    setInterval(() => {
      const s = ocrSemaphore.stats();
      const dropped = getDropped();
      if (s.active || s.queued || dropped) {
        log.info(`ocr active=${s.active}/${s.max} queued=${s.queued} dropped=${dropped} cache=${cacheSize()}`);
      }
    }, 10 * 60 * 1000).unref();
  });

  client.on(Events.GuildCreate, (guild) => {
    log.info(`joined · ${guild.name} (${guild.id}) · ${guild.memberCount} members · total ${client.guilds.cache.size}`);
  });

  client.on(Events.GuildDelete, (guild) => {
    log.info(`left · ${guild.name || guild.id} · total ${client.guilds.cache.size}`);
  });

  client.on(Events.MessageCreate, handleMessage);

  return client;
}

module.exports = { createClient };
