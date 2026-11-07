# ShareIn Viral Intake

Web setoran konten viral TikTok & Instagram Reels untuk ShareIn. Mobile-first, berbahasa Indonesia, database Google Sheets, dengan menu admin untuk mengatur QTY dan batas minimal like/komentar tanpa mengubah kode.

**Tumpukan:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Zod · Google Sheets API (service account) · bcrypt · Vercel / Docker.

## Fitur

- **Publik** — `/` beranda (progres QTY, ketentuan, cara kerja), `/setor` form setoran dengan cek langsung, `/riwayat` riwayat per nama, `/aturan` ketentuan lengkap.
- **Admin** — `/admin/login`, `/admin` dasbor, `/admin/setoran` review (setujui/tolak dengan alasan, aksi massal, ekspor CSV), `/admin/pengaturan` (periode, buka/tutup, QTY, minimal like/komentar, domain ShareIn, adapter metrik, wajib tangkapan layar). Peran `owner` (semua) dan `reviewer` (dasbor + review).
- **Validasi server** (diulang saat simpan): periode dibuka → format/domain URL (hanya https) → normalisasi & ikuti link pendek (HEAD, 3 dtk, hanya domain TikTok/Instagram, IP privat diblokir) → duplikat `source_key` di semua periode → minimal like/komentar (inklusif) → pernyataan organik (+ tangkapan layar bila wajib) → QTY belum penuh → simpan dengan penguncian.
- **Latar bergerak ringan** — 1 lapisan fixed + 3 blob (4 node DOM), CSS `animation-timeline: scroll()` dengan fallback rAF; mati saat `prefers-reduced-motion`, Data Saver, atau RAM ≤ 4 GB. Admin polos.

Semua angka aturan dibaca dari sheet `settings`, tidak ada di kode. Lihat `docs/DECISIONS.md` untuk asumsi.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # boleh dibiarkan kosong untuk mode lokal
# isi minimal ADMIN_EMAIL dan ADMIN_PASSWORD untuk masuk admin
npm run dev                   # http://localhost:3000
```

Tanpa variabel Google Sheets, data disimpan di `.data/db.json` (mode lokal/demo).

## Menyiapkan Google Sheets

1. Buat spreadsheet baru (kosong). Salin ID dari URL: `docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.
2. Di Google Cloud Console: buat project → aktifkan **Google Sheets API** (dan **Google Drive API** bila memakai tangkapan layar) → buat **Service Account** → tab Keys → *Add key* → JSON.
3. Bagikan spreadsheet ke email service account sebagai **Editor**. Jangan bagikan spreadsheet ke publik.
4. Isi env: `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (nilai `private_key` dari file JSON, `\n` literal boleh).
5. Jalankan `npm run sheet:setup` (atau cukup buka web): tab `settings`, `submissions`, `admins`, `audit_log` dibuat beserta header dan nilai awal settings.

Pengaturan juga boleh diubah langsung di sheet `settings`; web membaca nilai terbaru paling lama 60 detik kemudian.

**Admin:** isi `ADMIN_EMAIL` + `ADMIN_PASSWORD`, lalu login sekali — akun owner pertama dibuat otomatis (hanya bila sheet `admins` kosong). Admin berikutnya:

```bash
ADMIN_NEW_PASSWORD='sandi-minimal-10' npm run admin:add -- reviewer@domain.id reviewer
```

**Tangkapan layar di Vercel:** buat folder di *Shared Drive*, tambahkan service account sebagai *Content manager*, isi `DRIVE_FOLDER_ID`. Tanpa itu, unggahan disimpan di disk server (`DATA_DIR/uploads`) — hanya cocok untuk Docker/Dokploy.

## Deploy

**Vercel** — import repo, framework Next.js, isi env: `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SESSION_SECRET` (≥ 32 karakter, `openssl rand -base64 48`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, opsional `DRIVE_FOLDER_ID`. Google Sheets wajib di Vercel.

**Docker / Dokploy** — `docker build -t sharein .` lalu jalankan dengan env yang sama dan volume `/data` (dipakai mode lokal dan unggahan tangkapan layar). Port 3000.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Uji unit (Vitest): URL, validasi, batas inklusif, duplikat, QTY bersamaan, driver Sheets palsu |
| `npm run test:e2e` | Uji end-to-end Playwright di profil Pixel 7 (butuh `npm run build` dulu) |
| `npm run sheet:setup` | Buat tab + header + nilai awal |
| `npm run admin:add` | Tambah admin |

## API

Prefiks `/api`, JSON.

| Metode | Rute | Akses |
|---|---|---|
| GET | `/rules` | publik, cache 60 dtk |
| POST | `/links/parse` | publik |
| POST | `/submissions/check` | publik — `{ ok, checks: [{ id, pass, message?, remaining? }] }` |
| POST | `/submissions` | publik (JSON, atau multipart `data` + `screenshot`) |
| GET | `/submissions/mine?name=` | publik |
| POST | `/metrics/fetch` | publik, 10/menit/IP |
| POST | `/admin/login` · `/admin/logout` | — |
| GET | `/admin/submissions` | admin |
| PATCH | `/admin/submissions/:id` | admin — `{ action: approve\|reject\|reset, reason? }` |
| POST | `/admin/submissions/bulk` | admin — setujui massal |
| GET / PUT | `/admin/settings` | admin / owner |
| GET | `/admin/export.csv` | admin |

Id cek: `period_open`, `url_valid`, `not_duplicate`, `min_like`, `min_comment`, `sharein_valid`, `qty_available`, `organic`.

## Struktur

```
app/(public)/      beranda, setor, riwayat, aturan (+ latar bergerak)
app/admin/         login, dasbor, setoran, pengaturan (latar polos)
app/api/           route handler
components/        PillLabel, Panel, ProgressBar, StatusBadge, SetorForm, ...
lib/repo/          lapisan data: store.ts (antarmuka), sheets-store.ts, memory-store.ts,
                   settings.ts, submissions.ts, admins.ts, audit.ts
lib/validate.ts    aturan bisnis (murni, teruji)
lib/url.ts         parse & normalisasi link · lib/resolve.ts ikuti link pendek (anti-SSRF)
lib/metrics/       adapter RapidAPI / Apify (default mati)
```

Ganti database ke Postgres/Supabase cukup dengan menulis implementasi `TableStore` baru di `lib/repo/` — UI dan API tidak berubah.

## Batasan yang diketahui

- Angka like/komentar diisi manual oleh penyetor; "muncul organik di FYP" tidak bisa diverifikasi otomatis — mengandalkan pernyataan, tangkapan layar, dan review admin.
- Rate limit dan batas login disimpan di memori tiap instance server.
- Kuota Google Sheets API ±60 baca/menit/pengguna; cache 60 detik meringankan, tetapi untuk trafik besar pindahkan ke Postgres.
- Domain ShareIn bawaan `sharein.id,sharein.app` adalah tebakan — **ganti di Pengaturan** dengan domain asli.
