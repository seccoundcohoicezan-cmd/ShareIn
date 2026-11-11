# ShareIn

Web kampanye ShareIn: landing dengan tutorial interaktif, lalu tiga program — **Golden Ticket** (setoran konten viral TikTok/Reels dengan hadiah berjalan), **Pelatihan Content**, dan **Duta Teladan** (tugas → kode → status dipantau; tanpa hadiah). Mobile-first, berbahasa Indonesia, database Google Sheets.

**Tumpukan:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Zod · Google Sheets lewat Apps Script (atau Sheets API service account) · bcrypt · Vercel / Docker.

## Fitur

- **Landing `/`** — menu hanya *Tutorial* dan *Aturan*; isinya hanya tutorial interaktif yang berjalan otomatis (storyboard animasi, berhenti saat langkah diklik) (upload → bagikan link → reward) dan panduan bergambar cara menyalin link TikTok / Instagram Reels (tangkapan layar asli, titik ketuk berdenyut). Halaman program dibagikan langsung lewat link-nya. Latar: gradasi + 6 aset brand yang bergeser beda kecepatan saat scroll, diparkir di area kosong kiri/kanan (desktop) dan mengintip di tepi (HP).
- **`/goldenticket`** — hadiah berjalan (bawaan Rp2.000.000 naik sedikit demi sedikit sampai Rp5.000.000 pada 5 Desember 23.59 WIB, angka berbasis waktu sehingga sama untuk semua orang), link terkumpul, ketentuan. Setor di `/goldenticket/setor` (sampai 10 konten sekali kirim, link wajib dari `tiktok.com` atau `instagram.com/reel/`), riwayat di `/goldenticket/riwayat`.
- **`/pelatihancontent`** dan **`/dutateladan`** — sistem kirim link yang sama dengan Golden Ticket (form `/<program>/setor` sampai 10 link, link terkumpul publik, pratinjau & review admin), tanpa hadiah. Kewajiban mingguan: minimal *N* link per orang per minggu (Senin–Minggu WIB, diatur di Pengaturan); peserta melihat progres "Minggu ini x/N", admin melihat rekap siapa yang belum + tombol ingatkan via WA. Duplikat dicek per program. Duta bisa **masuk lewat MyTopstar** (SSO OIDC) dan langsung tiba di form kirim link.
- **`/pantau/<kode>`** — halaman pantau pribadi (seperti pelacakan aduan): 1 nomor WhatsApp = 1 peserta = 1 kode/link unik (12 karakter, mis. `ABCD-EFGH-JKLM`). Link dibuat otomatis saat pertama menyetor Golden Ticket atau mengumpulkan tugas, sekaligus berfungsi sebagai login (cookie) sehingga form terisi otomatis. Isinya semua setoran lintas program dengan status Menunggu/Disetujui/Ditolak, alasan tolak, kode undian & kemenangan, linimasa pemeriksaan, dan **diperbarui otomatis tiap 15 detik langsung dari spreadsheet** (perubahan status yang diketik admin langsung di sheet ikut tampil; kolom status punya dropdown + warna, kata "disetujui"/"ditolak" juga diterima). `/pantau` untuk memasukkan kode.
- **`/aturan`** — aturan semua program.
- **Admin** — `/admin` dasbor; `/admin/setoran` review Golden Ticket (tombol *Pratinjau & review*: pemutar resmi TikTok/Instagram + link Sharein di satu panel dengan Setujui/Tolak; massal, ekspor CSV); `/admin/program/pelatihan` dan `/admin/program/duta` (review link + rekap mingguan); `/admin/pengaturan` (periode/batas Golden Ticket, hadiah berjalan, buka/tutup program, setujui otomatis per program); `/admin/api` (kunci API Golden Ticket, lihat `docs/API.md`); `/admin/peserta` (daftar peserta + link unik, kirim ulang via WhatsApp); `/admin/akun` (ganti sandi sendiri; owner menambah admin, mengubah peran, menonaktifkan, mengatur ulang sandi — minimal satu owner aktif). Peran `owner` (semua) dan `reviewer` (dasbor + review).
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

## Menyiapkan Google Sheets lewat Apps Script (cara utama)

Spreadsheet ShareIn sudah punya proyek Apps Script terikat (`apps-script/`, deployment di `apps-script/.deployment-id`). Web memanggilnya dari server dengan rahasia bersama — spreadsheet tidak perlu dibagikan ke siapa pun.

1. Pemilik spreadsheet membuka **Ekstensi → Apps Script**, memilih fungsi `siapkan`, lalu **Run** dan mengizinkan akses (sekali saja). Sebelum ini Web App membalas 403.
2. Di editor yang sama, buka file `Rahasia.gs` dan salin nilai `API_SECRET`.
3. Di Vercel → Settings → Environment Variables isi `APPS_SCRIPT_SECRET` (nilai tadi), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, lalu **Redeploy**. Tab `settings`, `submissions`, `admins`, `audit_log`, `participants`, `api_keys` dibuat otomatis.

Mengubah kode Apps Script: `cd apps-script && clasp push -f && clasp deploy -i $(cat .deployment-id)`.

## Alternatif: Google Sheets API (service account)

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

**Vercel** — repo sudah terhubung (proyek `share-in`). Env minimal: `APPS_SCRIPT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`SESSION_SECRET` opsional, diturunkan dari rahasia Apps Script). Tanpa env database, web berjalan dalam **mode demo** (data di /tmp, hilang saat server berganti) dan dasbor admin menampilkan peringatan.

**Dokploy (produksi utama)** — proyek *ShareIn / production*, aplikasi *ShareIn Web* di server KVM 8, sumber GitHub `main` dengan auto-deploy setiap push, build `Dockerfile`, volume `sharein-data` → `/data`, domain HTTPS `https://sharein.194-238-23-221.sslip.io` (Let's Encrypt). Env: `APPS_SCRIPT_SECRET`, `NODE_ENV=production`, `DATA_DIR=/data`. Domain sendiri (mis. `sharein.domainanda.id`) cukup diarahkan (A record) ke `194.238.23.221` lalu ditambahkan di tab Domains.

**Login MyTopstar (Duta Teladan)** — daftarkan ShareIn sebagai *SSO Client* di dashboard MyTopstar: Redirect URI `https://<domain>/auth/sso/callback`, Initiate Login URI `https://<domain>/auth/sso/login`, scope `openid profile email`, Required Profile Fields `phone`, beri akses divisi Duta (*Manage access → Divisions*). Lalu isi env `MYTOPSTAR_CLIENT_ID` (+ `MYTOPSTAR_CLIENT_SECRET` bila client confidential; opsional `MYTOPSTAR_ISSUER`, bawaan `https://my.topstar.id/oidc`, dan `MYTOPSTAR_REDIRECT_URI` bila domain di balik proxy). Tanpa `MYTOPSTAR_CLIENT_ID` tombol MyTopstar disembunyikan. Akun dicocokkan dengan `sub` MyTopstar, lalu nomor HP (peserta lama tetap memakai link pantaunya).

**Docker lain** — `docker build -t sharein .` lalu jalankan dengan env yang sama dan volume `/data`. Port 3000.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Uji unit (Vitest): URL, validasi, batas inklusif, duplikat, QTY bersamaan, hadiah berjalan, kode tugas, setujui otomatis, API, driver Sheets palsu, dan `apps-script/Code.js` asli yang dijalankan di Node dengan spreadsheet tiruan |
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
| POST | `/submissions/batch/check` · `/submissions/batch` | publik — sampai 10 konten (`items`) |
| POST | `/metrics/fetch` | publik, 10/menit/IP |
| POST | `/admin/login` · `/admin/logout` | — |
| GET | `/admin/submissions` | admin |
| PATCH | `/admin/submissions/:id` | admin — `{ action: approve\|reject\|reset, reason? }` |
| POST | `/admin/submissions/bulk` | admin — setujui massal |
| GET / PUT | `/admin/settings` | admin / owner |
| GET | `/admin/export.csv` | admin |
| GET | `/programs/:program` | publik — ringkasan mingguan (`pelatihan` \| `duta`): target, aktif, capai target, link minggu ini |
| GET | `/collected?program=golden\|pelatihan\|duta&offset=` | publik — link terkumpul (nama disingkat) |
| GET | `/me?program=` | peserta (cookie) — akun + progres minggu ini |
| GET | `/admin/weekly?program=&semua=1` | admin — rekap kewajiban mingguan |
| GET | `/auth/sso/login` · `/auth/sso/callback` | login MyTopstar (bukan di bawah `/api`) |

`/submissions/batch` menerima `program` (`golden` bawaan, `pelatihan`, `duta`); filter admin `?program=`.

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

## Uji beban (300 pengguna bersamaan)

`tests/load/apps-script-server.ts` meniru Web App Apps Script (menjalankan `apps-script/Code.js` asli, ±1–2 dtk per panggilan, maks. 30 eksekusi bersamaan, penulisan dikunci LockService 25 dtk). `tests/load/load.mjs` menjalankan N peserta sekaligus dari SATU IP (seperti wifi kampus): buka halaman → cek progres → kirim 3 link (akun baru) → cek lagi → pantau.

```bash
npx next build
APPS_SCRIPT_SECRET=$(printf 'y%.0s' {1..40}) npx tsx tests/load/apps-script-server.ts &      # SIM_BASE_MS=2000 untuk latensi realistis
APPS_SCRIPT_SECRET=… APPS_SCRIPT_URL=http://127.0.0.1:39200/exec SESSION_SECRET=… npx next start -p 3300 &
node tests/load/load.mjs http://localhost:3300 300 1          # beberapa URL dipisah koma = beberapa instance server
```

Hasil 12 Nov 2026 (latensi Apps Script realistis ±2 dtk, 5 instance server, semua dari satu IP):

| Skenario | Error | Kirim p50 / p95 | Penulisan spreadsheet |
|---|---|---|---|
| 300 orang menekan Kirim dalam 1 detik | 0 | 16 / 18 dtk | 15 |
| 300 orang dalam 60 detik | 0 | 5,9 / 7,8 dtk | 93 |

Data tetap utuh: 900 link + 300 akun, tanpa link atau nomor ganda. Satu-satunya batas nyata adalah kunci tulis Apps Script (satu penulisan ±1 dtk); karena itu semua kiriman yang datang bersamaan digabung ke satu penulisan.

## Batasan yang diketahui

- Angka like/komentar diisi manual oleh penyetor; "muncul organik di FYP" tidak bisa diverifikasi otomatis — mengandalkan pernyataan, tangkapan layar, dan review admin.
- Rate limit dan batas login disimpan di memori tiap instance server.
- Kuota Google Sheets API ±60 baca/menit/pengguna; cache 60 detik meringankan, tetapi untuk trafik besar pindahkan ke Postgres.
- Domain ShareIn bawaan `sharein.id,sharein.app` adalah tebakan — **ganti di Pengaturan** dengan domain asli.
