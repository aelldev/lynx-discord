# LYNX

Bot Discord open-source buat mendeteksi dan menghapus postingan gambar scam/phishing casino secara otomatis.

Cara kerjanya sederhana: setiap gambar yang masuk di-scan pakai OCR (Tesseract.js), lalu hasilnya dicocokkan ke engine pendeteksi pola berlapis. Tidak butuh API berbayar, tidak butuh database — semuanya jalan di mesin kamu sendiri.

LYNX awalnya dibuat untuk melawan gelombang scam "selebriti crypto casino" palsu — foto MrBeast, Elon, CZ yang seolah "kena hack" lalu posting link ke situs seperti `kastwin***.pro` dengan kode promo `LAUNCH`. Tapi engine-nya cukup fleksibel untuk menangkap banyak variasi scam casino/crypto/giveaway lainnya.

Bot ini **monitoring-only**. Tidak ada command, tidak perlu setup rumit. Tinggal masukkan token, isi config, dan biarkan jalan sendiri.

---

## Fitur utama

- **Dual-pass OCR paralel** — scan gambar normal dan gambar ter-invert berjalan bersamaan. Begitu salah satu sudah cukup untuk vonis SCAM, langsung selesai. Cepat untuk scam, tetap akurat di gambar berlatar gelap.
- **Scoring 4 lapis** — URL struktural, frasa verbatim, sinyal kombinasi, dan pola umum. Setiap gambar melewati semua lapisan sebelum divonis.
- **Worker pool** — OCR berjalan paralel di beberapa worker Tesseract sekaligus.
- **Hash cache** — gambar yang sama tidak di-OCR dua kali. Berguna banget waktu ada spam wave.

---

## Kebutuhan sistem

- **Node.js 18 atau lebih baru** (disarankan versi 20 LTS)
- Token Discord bot dengan **Message Content Intent** aktif
- Permission bot: View Channel, Send Messages, Embed Links, Read Message History, Manage Messages

---

## Buat bot Discord-nya dulu

1. Buka [Discord Developer Portal](https://discord.com/developers/applications), buat aplikasi baru.
2. Tab **Bot** → klik Reset Token, salin tokennya.
3. Aktifkan **Message Content Intent** di bagian Privileged Gateway Intents.
4. **OAuth2** → URL Generator → centang scope `bot` dan permission berikut:
   View Channel, Send Messages, Manage Messages, Embed Links, Read Message History, Attach Files.
5. Buka URL yang dihasilkan untuk invite bot ke server kamu.

---

## Instalasi

### Windows

1. Install [Node.js LTS](https://nodejs.org/) — download installer Windows-nya, ikuti wizard, pastikan centang "Add to PATH".
2. Install [Git for Windows](https://git-scm.com/download/win) kalau belum punya.
3. Buka **PowerShell** atau **Command Prompt**, jalankan:

```bat
git clone https://github.com/aelldev/lynx-discord.git
cd lynx-discord
npm install
```

Buka [`config.json`](https://github.com/aelldev/lynx-discord/blob/main/config.json) dengan Notepad atau editor favorit kamu, paste token bot-nya, lalu:

```bat
npm start
```

> Kalau `npm install` gagal di `sharp`, kemungkinan kamu perlu install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — pilih workload "Desktop development with C++".

---

### Linux (Ubuntu / Debian / Fedora)

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Fedora / RHEL
sudo dnf install -y nodejs npm git gcc-c++ make
```

Lalu:

```bash
git clone https://github.com/aelldev/lynx-discord.git
cd lynx-discord
npm install
nano config.json
npm start
```

Biar bot tetap jalan meskipun terminal ditutup, pakai `tmux`, `screen`, atau process manager seperti [pm2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start index.js --name lynx
pm2 save
pm2 startup
```

---

### Termux (Android)

LYNX bisa jalan di Android via [Termux](https://termux.dev/). Pastikan kamu install Termux dari F-Droid atau GitHub — versi Play Store sudah tidak diupdate.

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs-lts git python build-essential
termux-setup-storage # opsional, kasih akses ke penyimpanan HP

git clone https://github.com/aelldev/lynx-discord.git
cd lynx-discord
npm install
nano config.json # paste token, Ctrl+O Enter, Ctrl+X
npm start
```

Beberapa hal yang perlu diperhatikan di Termux:

- **Sharp** akan di-build dari source karena tidak ada binary prebuilt untuk arm64 di Termux. Package `python` dan `build-essential` di atas sudah cukup. `npm install` bakal butuh beberapa menit — wajar.
- **Baterai** — jalankan `termux-wake-lock` supaya Android tidak mematikan prosesnya. Matikan juga battery optimization untuk Termux di pengaturan HP.
- **Background** — jalankan di dalam `tmux` supaya bot tetap hidup kalau Termux ter-minimize:

  ```bash
  pkg install -y tmux
  tmux new -s lynx
  npm start
  # lepas dengan Ctrl+B lalu D, sambung lagi dengan: tmux attach -t lynx
  ```

---

## Konfigurasi

Buka [`config.json`](https://github.com/aelldev/lynx-discord/blob/main/config.json). Semua pengaturan ada di sini.

```json
{
  "token": "YOUR_BOT_TOKEN",
  "botName": "LYNX",
  "threshold": 60,
  "autoDelete": true,
  "monitoredChannels": [],
  "ignoredChannels": [],
  "workerCount": 4,
  "maxConcurrentOcr": 8,
  "logging": {
    "logScan": true,
    "logOcrText": false,
    "debugMode": false
  }
}
```

| Key | Default | Keterangan |
|---|---|---|
| `token` | — | Token bot kamu (wajib diisi) |
| `botName` | `LYNX` | Teks di footer warning embed |
| `threshold` | `60` | Skor minimum untuk vonis SCAM |
| `autoDelete` | `true` | Hapus pesan scam secara otomatis |
| `workerCount` | `4` | Jumlah worker Tesseract (lebih banyak = lebih cepat di CPU multi-core) |
| `maxConcurrentOcr` | `8` | Batas maksimum OCR yang jalan bersamaan secara global |
| `monitoredChannels` | `[]` | Daftar channel ID yang dipantau (kosong = pantau semua) |
| `ignoredChannels` | `[]` | Daftar channel ID yang dilewati |
| `logging.logScan` | `true` | Log satu baris untuk setiap gambar yang di-scan |
| `logging.logOcrText` | `false` | Tampilkan teks mentah hasil OCR (verbose, berguna untuk tuning) |
| `logging.debugMode` | `false` | Embed verbose + breakdown skor lengkap |

Pengaturan lanjutan seperti ukuran gambar, cache, race shortcut, dan rate limit ada di [`src/config.js`](https://github.com/aelldev/lynx-discord/blob/main/src/config.js).

---

## Struktur file

```
lynx-discord/
├── index.js              # entry point
├── src/
│   ├── config.js         # baca config.json
│   ├── client.js         # Discord client + event wiring
│   ├── handler.js        # logika message handler
│   ├── detector.js       # pipeline OCR, worker pool, cache, scoring
│   ├── fingerprints.js   # semua pola scam (4 lapis)
│   ├── embed.js          # warning embed
│   ├── queue.js          # semaphore concurrency OCR global
│   ├── logger.js         # console log
│   └── utils.js          # download, rate limiter, normalisasi teks OCR
├── config.json           # setting
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

---

## Cara kerjanya

1. Bot memantau pesan berisi attachment gambar di channel yang dikonfigurasi.
2. Setiap gambar: download → resize + grayscale (via `sharp`) → OCR dengan Tesseract.
3. OCR berjalan **dua pass paralel**: gambar asli dan gambar ter-invert warnanya. Yang selesai duluan langsung dicek ke engine scoring. Kalau sudah mencapai threshold → langsung vonis SCAM. Kalau belum, tunggu keduanya selesai dan pakai hasil yang lebih baik.
4. Teks hasil OCR di-score melewati 4 lapisan pola dari [`fingerprints.js`](https://github.com/aelldev/lynx-discord/blob/main/src/fingerprints.js):
   - **Structural URL** (+60) — pola domain seperti `kastwin150.pro`, `*.cfd`, `*/profile/withdraw`
   - **Verbatim phrases** (+50) — string persis yang dipakai template scam (`promo code: LAUNCH`, dll)
   - **Combination signals** (+40) — set pola yang harus semuanya match bersamaan
   - **General** (+20) — keyword umum (`rakeback`, `crypto casino`, `claim your reward`)
5. Kalau total skor ≥ `threshold`, pesan dihapus (kalau `autoDelete` aktif) dan warning embed diposting secara paralel.

---

## Kustomisasi warning embed

Buka [`src/embed.js`](https://github.com/aelldev/lynx-discord/blob/main/src/embed.js). Objek `SCAM_EMBED` di bagian atas bersifat deklaratif — edit sesuai kebutuhan.

```js
const SCAM_EMBED = {
  color: 0xFF0000,
  title: '🚨 Peringatan',
  description: '{user} gambar yang kamu kirim terdeteksi sebagai **scam** dan sudah dihapus secara otomatis.',
  multiImageLine: '{totalCount} gambar terdeteksi sebagai scam.',
  adminContact: 'Jika ada kesalahan, silakan hubungi admin.',
  footer: { text: '{botName}' },
  showTimestamp: true,
};
```

Placeholder yang tersedia:

| Placeholder | Nilai |
|---|---|
| `{user}` | Mention pengirim |
| `{username}` | Username pengirim |
| `{scamCount}` | Jumlah gambar yang diflag |
| `{totalCount}` | Total gambar dalam pesan |
| `{totalScore}` | Skor deteksi |
| `{threshold}` | Threshold yang dipakai |
| `{botName}` | Nilai `botName` dari config |
| `{channel}` | Nama channel |

Set field string apapun ke `null` kalau ingin disembunyikan.

---

## Menambah pola scam baru

Buka [`src/fingerprints.js`](https://github.com/aelldev/lynx-discord/blob/main/src/fingerprints.js). Setiap lapisan adalah array biasa berisi regex (atau objek rule untuk kombinasi). Tambahkan entri baru, restart bot — selesai.

Cara mencari pola baru:

1. Set `"logOcrText": true` di [`config.json`](https://github.com/aelldev/lynx-discord/blob/main/config.json)
2. Restart bot, kirim gambar scam sebagai test
3. Salin output OCR dari console
4. Cari string atau pola URL yang berulang
5. Tulis regex dan tambahkan ke layer yang sesuai

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Bot tidak menghapus pesan | Console akan ada peringatan soal `Manage Messages`. Bot butuh permission itu, dan role-nya harus di atas role pelanggar |
| Scan pertama lambat | Model Tesseract (~12 MB) sedang diunduh. Setelah itu langsung ter-cache |
| `Cannot find module 'sharp'` di Termux | Install dulu: `pkg install python build-essential` |
| `Cannot find module 'sharp'` di Windows | Install [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) dengan workload C++ |
| Terlalu banyak false positive | Naikkan `threshold` di [`config.json`](https://github.com/aelldev/lynx-discord/blob/main/config.json) (coba 80–100) |
| Terlalu banyak yang lolos | Turunkan `threshold`, atau aktifkan `logOcrText` dan tambah pola baru |
| Out of memory di Termux | Turunkan `workerCount` ke 1–2 |

---

## License

MIT — lihat [LICENSE](https://github.com/aelldev/lynx-discord/blob/main/LICENSE).
