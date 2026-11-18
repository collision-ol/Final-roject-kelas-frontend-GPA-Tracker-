# GradPath

Website perencana dan simulasi target IPK berbasis React, Vite, dan Cloudflare Workers.

Link: https://web.gradpath.workers.dev

## Menjalankan Secara Lokal

Pastikan **Node.js** sudah terpasang, lalu jalankan perintah berikut di folder project:

```bash
npm install
npm run dev
```

Buka URL lokal yang ditampilkan Vite di terminal (biasanya `http://localhost:5173`).

## Perintah Lainnya

```bash
# Build frontend & bundle worker
npm run build

# Menjalankan unit test
npm test

# Preview worker lokal setelah build
npm run preview

# Build dan deploy ke Cloudflare Workers
npm run deploy
```

## Konfigurasi AI Chat (Opsional)

Untuk mengaktifkan asisten AI Gemini pada environment server/Worker, salin `.env.example` menjadi `.env.local` (atau atur sebagai Wrangler secret) lalu isi:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_FREE_TIER_CONFIRMED=true`
