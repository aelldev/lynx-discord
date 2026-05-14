const { EmbedBuilder } = require('discord.js');
const config = require('./config');

const SCAM_EMBED = {
  color: 0xFF0000,
  author: null,
  title: '🚨 Peringatan',
  description: '{user} gambar yang kamu kirim terdeteksi sebagai **scam** dan sudah dihapus secara otomatis.\n',
  multiImageLine: '{totalCount} gambar terdeteksi sebagai scam.\n',
  adminContact: 'Jika ada kesalahan, silakan hubungi admin.',
  thumbnail: null,
  image: null,

  footer: {
    text: '{botName}',
    iconURL: null,
  },

  showTimestamp: true,
};

function fill(template, vars) {
  if (template == null) return '';
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

function buildVars({ message, results }) {
  const scamResults = results.filter((r) => r.isScam);
  const totalScore = scamResults.reduce((s, r) => s + r.score, 0);

  return {
    user: `<@${message.author.id}>`,
    username: message.author.username || message.author.tag,
    scamCount: scamResults.length,
    totalCount: results.length,
    totalScore,
    threshold: config.THRESHOLD,
    botName: config.BOT_NAME,
    channel: message.channel && message.channel.name ? message.channel.name : '',
  };
}

function buildScamEmbed({ message, results }) {
  const vars = buildVars({ message, results });
  const embed = new EmbedBuilder().setColor(SCAM_EMBED.color || 0xFF0000);

  if (SCAM_EMBED.author && SCAM_EMBED.author.name) {
    embed.setAuthor({
      name: fill(SCAM_EMBED.author.name, vars),
      iconURL: SCAM_EMBED.author.iconURL || undefined,
      url: SCAM_EMBED.author.url || undefined,
    });
  }

  if (SCAM_EMBED.title) embed.setTitle(fill(SCAM_EMBED.title, vars));

  // bangun description sebagai array, join \n. gak ada `\n\n` yg bikin gap.
  const lines = [];
  if (SCAM_EMBED.description) lines.push(fill(SCAM_EMBED.description, vars));
  if (vars.totalCount > 1 && SCAM_EMBED.multiImageLine) lines.push(fill(SCAM_EMBED.multiImageLine, vars));
  if (SCAM_EMBED.adminContact) lines.push(fill(SCAM_EMBED.adminContact, vars));

  if (lines.length) embed.setDescription(lines.join('\n'));

  if (SCAM_EMBED.thumbnail) embed.setThumbnail(SCAM_EMBED.thumbnail);
  if (SCAM_EMBED.image) embed.setImage(SCAM_EMBED.image);

  if (SCAM_EMBED.footer && SCAM_EMBED.footer.text) {
    embed.setFooter({
      text: fill(SCAM_EMBED.footer.text, vars),
      iconURL: SCAM_EMBED.footer.iconURL || undefined,
    });
  }

  if (SCAM_EMBED.showTimestamp) embed.setTimestamp(new Date());

  if (config.DEBUG_MODE) {
    const scamResults = results.filter((r) => r.isScam);
    embed.addFields({
      name: '🔧 Debug',
      value: `score **${vars.totalScore}** / threshold ${vars.threshold}`,
      inline: false,
    });

    scamResults.forEach((r, idx) => {
      const lines = r.matches
        .map((m) => `• \`${m.type}\` ${m.pattern} → +${m.points}`)
        .join('\n')
        .slice(0, 1000);
      embed.addFields({
        name: `Gambar #${idx + 1} · score ${r.score}${r.fromCache ? ' · cached' : ''}`,
        value: lines || '_(no matches)_',
        inline: false,
      });
    });
  }

  return embed;
}

module.exports = {
  buildScamEmbed,
  SCAM_EMBED,
};
