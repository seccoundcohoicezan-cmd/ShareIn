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
