const { PermissionsBitField } = require('discord.js');
const config = require('./config');
const log = require('./logger');
const { analyzeImagesWithEarlyExit } = require('./detector');
const { buildScamEmbed } = require('./embed');
const {
  isWorthScanning,
  checkUserRateLimit,
  checkGuildRateLimit,
} = require('./utils');

function shouldMonitor(channelId) {
  if (config.IGNORED_CHANNELS.includes(channelId)) return false;
  if (config.MONITORED_CHANNELS.length === 0) return true;
  return config.MONITORED_CHANNELS.includes(channelId);
}

function botCanDelete(message) {
  try {
    const me = message.guild?.members?.me;
    if (!me) return false;
    const perms = message.channel.permissionsFor(me);
    return !!perms && perms.has(PermissionsBitField.Flags.ManageMessages);
  } catch {
    return false;
  }
}

function botCanSend(message) {
  try {
    const me = message.guild?.members?.me;
    if (!me) return false;
    const perms = message.channel.permissionsFor(me);
    if (!perms) return false;
    return perms.has(PermissionsBitField.Flags.SendMessages)
      && perms.has(PermissionsBitField.Flags.EmbedLinks);
  } catch {
    return false;
  }
}

async function safeDelete(message) {
  try {
    await message.delete();
    return true;
  } catch (err) {
    if (err?.code === 50013) {
      log.warn(`gak bisa hapus pesan · ${message.guild?.name} #${message.channel.name || message.channel.id}`);
    } else if (err?.code === 10008) {
      return true;
    } else {
      log.error('safeDelete', err);
    }
    return false;
  }
}

async function safeSend(channel, embed) {
  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    log.error('safeSend', err);
  }
}

async function handleMessage(message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!shouldMonitor(message.channel.id)) return;
    if (!message.attachments || message.attachments.size === 0) return;

    const imageAtts = [...message.attachments.values()].filter(isWorthScanning);
    if (imageAtts.length === 0) return;

    if (!checkGuildRateLimit(message.guild.id)) {
      log.debug(`guild rate limit · ${message.guild.name}`);
      return;
    }
    if (!checkUserRateLimit(message.author.id)) {
      log.debug(`user rate limit · ${message.author.tag}`);
      return;
    }

    const t0 = Date.now();
    const urls = imageAtts.map((a) => a.url);

    let deletePromise = null;
    let deleted = false;

    // begitu scam pertama kedeteksi, langsung kick delete paralel sama OCR sisa
    const onFirstScam = () => {
      if (config.AUTO_DELETE && !deletePromise) {
        if (!botCanDelete(message)) {
          log.warn(`auto-delete on tapi gak ada "Manage Messages" · ${message.guild.name} #${message.channel.name || message.channel.id}`);
          return;
        }
        deletePromise = safeDelete(message).then((ok) => { deleted = ok; });
      }
    };

    const results = await analyzeImagesWithEarlyExit(urls, onFirstScam);
    const anyScam = results.some((r) => r.isScam);
    const totalLatency = Date.now() - t0;

    if (!anyScam) {
      log.debug(`clean · ${message.guild.name} · ${results.length} img · ${totalLatency}ms`);
      return;
    }

    // fallback: delete belum ke-trigger (shouldnt happen kalau anyScam=true, tapi defensive)
    if (!deletePromise && config.AUTO_DELETE && botCanDelete(message)) {
      deletePromise = safeDelete(message).then((ok) => { deleted = ok; });
    }

    // build embed + send paralel sama delete. ini yang ngebuang gap delete→send
    const embed = buildScamEmbed({ message, results });
    const sendPromise = botCanSend(message)
      ? safeSend(message.channel, embed)
      : Promise.resolve();

    await Promise.all([deletePromise, sendPromise].filter(Boolean));

    const scamResults = results.filter((r) => r.isScam);
    const totalScore = scamResults.reduce((s, r) => s + r.score, 0);
    log.scam(
      `${message.guild.name} · #${message.channel.name || message.channel.id} · ${message.author.tag} · ${scamResults.length}/${results.length} img · ${totalScore}p`,
      `${deleted ? 'deleted' : 'kept'} · ${Date.now() - t0}ms`
    );
  } catch (err) {
    log.error('handleMessage', err);
  }
}

module.exports = { handleMessage };
