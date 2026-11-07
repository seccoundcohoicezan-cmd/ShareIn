# Keputusan & asumsi

Dicatat saat build v1 (MRKT-52). Ubah bila tidak sesuai.

| # | Keputusan | Alasan |
|---|-----------|--------|
| 1 | Satu setoran = satu konten. Penyetor memilih platform asal; kolom link platform lain disembunyikan, kolom ShareIn selalu tampil. | Asumsi di brief. |
| 2 | Penyetor tanpa login, cukup nama. Riwayat dicari dengan nama (tidak peka huruf besar/kecil & spasi ganda). | Asumsi di brief. Konsekuensi: siapa pun yang tahu nama bisa melihat riwayat orang itu (yang tampil hanya link, angka, status). |
| 3 | QTY dihitung per `period_id` dari status `pending` + `approved`. Ganti `period_id` di Pengaturan untuk memulai periode baru. Bawaan pertama kali: minggu berjalan, mis. `2026-11-W2`. | Asumsi di brief. |
| 4 | Duplikat dicek dengan `source_key` (`tt:<id video>` / `ig:<shortcode>`) di **semua** periode, termasuk setoran yang ditolak. | Brief: "pada seluruh periode". Mencegah konten yang sudah ditolak disetor ulang orang lain. |
| 5 | Kolom tambahan `needs_review` di sheet `submissions` (paling kanan). | Penanda selisih >20% angka penyetor vs adapter API (rancangan §10). Kolom 1–17 tetap sesuai skema. |
| 6 | Status tambahan `void`. | Dipakai otomatis bila dua server menyimpan bersamaan dan baris kita kalah (duplikat/QTY penuh). Tidak dihitung, tidak tampil di admin maupun riwayat. |
| 7 | Penguncian: kunci dalam proses + pola *append-then-verify* (tulis, baca ulang, baris paling awal menang). | Google Sheets tidak punya transaksi; Vercel bisa menjalankan beberapa instance sekaligus, jadi kunci dalam memori saja tidak cukup. |
| 8 | `@googleapis/sheets` dan `@googleapis/drive` (paket resmi bagian dari `googleapis`) dan `bcryptjs` (bcrypt murni JS, format hash sama). | Jauh lebih ringan dari paket `googleapis` penuh (~100 MB) dan tanpa kompilasi native di Vercel. |
| 9 | Penyimpanan data lokal berbasis file (`DATA_DIR`) bila variabel Google Sheets kosong. | Agar bisa dicoba/diuji tanpa kredensial. **Produksi di Vercel wajib Google Sheets** (filesystem Vercel tidak persisten). |
| 10 | Tangkapan layar: Google Drive (folder di **Shared Drive**) bila `DRIVE_FOLDER_ID` diisi, selain itu disimpan di `DATA_DIR/uploads` dan hanya bisa dibuka admin. | Service account tidak punya kuota Drive pribadi, jadi harus Shared Drive. |
| 11 | Rate limit & batas login (5×/15 menit per IP+email) disimpan di memori per instance. | Cukup untuk trafik kecil–sedang; untuk skala besar pindahkan ke Redis/Upstash. |
| 12 | Admin pertama dibuat otomatis dari `ADMIN_EMAIL` + `ADMIN_PASSWORD` hanya bila sheet `admins` masih kosong. Admin berikutnya lewat `npm run admin:add`. | Tidak perlu menulis hash bcrypt manual ke sheet. |
| 13 | Adapter metrik RapidAPI/Apify dibuat generik (URL/actor diatur lewat env). Default mati. | Penyedia & endpoint belum dipilih; alur utama tetap input manual. |
| 14 | JS awal beranda 96 kB gzip (target rancangan < 90 kB). | Itu ukuran dasar runtime Next.js 14 + React; beranda sendiri tidak memuat komponen klien. Tidak bisa turun di bawah 90 kB tanpa mengganti framework. |

## Pembaruan MRKT-52 putaran 2 (7 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 15 | Database lewat **Apps Script Web App** yang terikat ke spreadsheet (`apps-script/Code.js`), dipanggil server Next dengan rahasia bersama, operasi tabel generik di bawah LockService. | Pengguna memberi spreadsheet + proyek Apps Script, bukan service account. Spreadsheet tetap privat. |
| 16 | Golden Ticket = program setoran konten viral yang sudah ada; hadiah berjalan linier berbasis waktu dari `golden_pool_start` ke `golden_pool_end` antara `golden_start_at` (7 Nov 2026 00.00 WIB) dan `golden_end_at` (5 Des 2026 23.59 WIB). ±Rp1,2 per detik. | "2.000.000 nambah sedikit demi sedikit sampai 5 Desember". Semua bisa diubah di Pengaturan. |
| 17 | Identitas peserta Pelatihan/Duta = nomor WhatsApp (dinormalkan ke 628…), nama ikut dicatat. Satu tugas sekali per nomor. | "1 nama identitas". Nomor lebih unik daripada nama dan dipakai menghubungi pemenang. |
| 18 | Kode diberikan **langsung** saat tugas dikumpulkan (status menunggu), tetapi baru masuk roda setelah disetujui admin. | Peserta langsung dapat kode, admin tetap bisa menyaring bukti palsu. |
| 19 | Satu tugas = satu kode; makin banyak tugas, makin banyak peluang. Bawaan: satu orang maksimal menang sekali per program (bisa dimatikan). | Interpretasi "kode dikumpulkan dan masuk spin wheel". |
| 20 | Nominal hadiah spin diisi admin saat memutar (bawaan dari Pengaturan, Rp0 = wajib diisi). Pemenang dipilih acak di server (`crypto.randomInt`), roda di layar hanya animasi menuju hasil itu. | Nominal belum ditentukan; hasil undian tidak bisa dimanipulasi dari browser. |
| 21 | Duta Teladan memakai mesin yang sama dengan label "Kewajiban" dan prefiks kode `DT-`. | "sistemnya sama spin wheel ... bonus". |
| 22 | Menu landing hanya Tutorial & Aturan; program dibuka dari kartu landing. Bottom-tab dari paket UI/UX tidak dipakai. URL lama (`/setor`, `/riwayat`, `/golden-ticket`, `/pelatihan-content-creator`, `/duta`) dialihkan. | Permintaan pengguna. |
