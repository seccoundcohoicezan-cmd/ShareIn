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

## Putaran 3 (7 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 23 | Landing hanya tutorial interaktif + panduan salin link; kartu program dihapus. | Permintaan: halaman program dibagikan langsung per link. |
| 24 | Tangkapan layar panduan dari pengguna dipakai apa adanya, tetapi foto profil & nama kontak orang lain di menu bagikan dan avatar kreator disamarkan (blur). Langkah "ketuk ikon Kirim" di Instagram memakai ilustrasi karena tidak ada tangkapan layarnya. | Privasi pihak ketiga. |
| 25 | Latar: 3 blob + 6 aset brand (9 elemen), tetap hanya animasi transform & scroll-driven, mati saat reduced-motion/hemat data/RAM ≤ 4 GB. Posisi = di luar kolom baca 768 px (rumus `50vw − 408px − lebar`), dicek otomatis di 1280/1440/1920 px. Di HP aset mengintip dari tepi dengan opasitas 50%. | Permintaan "background bergerak + aset di titik paling optimal"; melonggarkan batas 4 node di rancangan awal. |
| 26 | Akun owner awal dibuat langsung di sheet `admins` (bcrypt) untuk dutateladan@stekom.ac.id; sandi awal diberikan sekali dan wajib diganti lewat `/admin/akun`. Env `ADMIN_EMAIL/ADMIN_PASSWORD` tidak lagi diperlukan. | Permintaan email & sandi admin. |

## Putaran 4 (7 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 27 | Tutorial & panduan salin link berputar otomatis (hanya saat terlihat di layar, tidak untuk reduced-motion); klik langkah/bar → mode manual + tombol "Putar otomatis". | "buat semua berjalan sendiri, berhenti ketika bar step-nya diklik". |
| 28 | "Live preview" di admin = panel pratinjau memakai pemutar embed resmi TikTok (`/embed/v2/<id>`) dan Instagram (`/reel/<kode>/embed/`), plus tab link Sharein/bukti di iframe dengan cadangan "buka di tab baru"; Setujui/Tolak di panel yang sama. | Admin bisa memutuskan tanpa pindah tab. |
| 29 | Produksi utama di Dokploy (KVM 8, domain sslip.io HTTPS). Vercel tetap bisa jalan paralel. | Pengguna menyediakan proyek Dokploy; server tetap (bukan serverless) membuat kunci tulis dalam proses lebih andal dan tangkapan layar bisa disimpan di volume. |

## Putaran 5 (7 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 30 | Produksi hanya Dokploy. | Permintaan "fokus 1". |
| 31 | Akun peserta = nomor WhatsApp; kode unik 12 karakter (alfabet tanpa 0/O/1/I/L, ±2^59 kombinasi, dibatasi 40 permintaan/menit/IP) sebagai link pantau sekaligus login (cookie httpOnly 180 hari). Golden Ticket kini wajib nomor WhatsApp. | "1 unik = 1 user, login juga bisa pakai link unik" ala pelacakan aduan. Tanpa sandi = paling mudah dipakai peserta. |
| 32 | Pencarian riwayat berdasarkan nama dan cek kode berdasarkan nomor WA dihapus; diganti halaman pantau berkode. | Dulu siapa pun yang tahu nama/nomor bisa melihat setoran orang lain. |
| 33 | Halaman pantau membaca spreadsheet tanpa cache dan polling 15 detik (berhenti saat tab disembunyikan). Status di sheet bisa diketik manual dalam bahasa Indonesia. | "preview datanya update live di spreadsheet". |
| 34 | Lupa link → admin mengirim ulang dari `/admin/peserta` lewat WhatsApp (tidak ada pemulihan mandiri dengan nomor saja). | Pemulihan dengan nomor WA saja bisa disalahgunakan orang lain. |

## Putaran 8 (9 Nov 2026)

Keputusan #19–21 tentang spin wheel dibatalkan.

| # | Keputusan | Alasan |
|---|-----------|--------|
| 35 | Hadiah hanya di Golden Ticket. Spin wheel (halaman admin, API, tab `draws`, pengaturan hadiah) dihapus; Pelatihan & Duta tetap memberi kode tugas sebagai tanda terkumpul. | Permintaan pengguna. Belum ada data undian di spreadsheet saat dihapus. |
| 36 | Setujui otomatis per program (`auto_approve_golden/pelatihan/duta`, bawaan mati). Hanya berlaku untuk setoran baru; `reviewed_by` = `otomatis`. Golden Ticket tetap harus lolos semua cek server. | Permintaan pengguna. |
| 37 | API Golden Ticket hanya-baca di `/api/v1/goldenticket/*`, memakai kunci yang dibuat owner; tersimpan hanya hash SHA-256. Data memuat nomor WhatsApp, jadi harus dipanggil dari server. | "Tarik ke sistem lain". Menulis lewat API tidak diminta. |

## Putaran 9 (9 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 38 | Link konten hanya dari `tiktok.com` atau `instagram.com/reel/` (juga `/reels/` dan `/<akun>/reel/`). Instagram `/p/` dan `/share/` ditolak; kolom langsung merah dan tombol kirim mati. | Permintaan pengguna. |
| 39 | Link pendek TikTok `vt.`/`vm.tiktok.com` tetap diterima dan dibuka server menjadi link `www.tiktok.com`. | Tombol Salin Tautan di aplikasi TikTok HP menghasilkan link ini; menolaknya membuat panduan tidak bisa diikuti. |
| 40 | Setor sampai 10 konten sekali kirim. Platform dideteksi per link (pilihan platform dihapus). Nama, WhatsApp, pernyataan, dan satu tangkapan layar berlaku untuk semua. Bila satu konten gagal cek, tidak ada yang disimpan. | Permintaan pengguna. Satu tangkapan layar menjaga unggahan di bawah batas 4,5 MB Vercel. |

## Putaran 10 (9 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 41 | Golden Ticket tanpa target/QTY ("banyak-banyakan"): pengaturan QTY, cek kuota, dan progres dihapus. Pengganti progres: jumlah link terkumpul. | Permintaan pengguna. |
| 42 | `/goldenticket` menampilkan link terkumpul (menunggu + disetujui), terbaru dulu, nama disingkat, tanpa nomor WA. Pemutar resmi hanya dimuat saat "Putar di sini" ditekan. | Permintaan pratinjau; memuat banyak iframe sekaligus membuat halaman berat. |

## Putaran 11 (10 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 43 | Form setor hanya meminta link. Kolom like/komentar dihapus; batas minimal tetap ditampilkan sebagai syarat dan dinyatakan lewat centang, admin memeriksa di pratinjau. Server tetap menolak angka di bawah batas bila angka dikirim (API). | Permintaan pengguna. |
| 44 | Link Sharein tidak wajib (tersembunyi di tombol "opsional"); bila diisi tetap dicek domainnya. | Peserta baru belum punya akun/link Sharein. |
| 45 | Panduan "konten pro & kontra" berisi 12 contoh topik debat ringan dan larangan SARA/hoaks/konten dewasa. | Permintaan pengguna; contoh dibuat aman untuk kampanye kampus. |

## Putaran 12 (10 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 46 | Kolom link Sharein dihapus dari form dan pengaturan (server tetap menerima bila dikirim lewat API). | Membingungkan; peserta sempat menempel link pantau di kolom itu. |
| 47 | Link pantau = login di /setor: tempel link → masuk, nama & WA tidak ditanya lagi; identitas diambil dari akun di server, bukan dari isian form. Halaman pantau punya CTA "+ Setor konten lagi". | Permintaan pengguna. |
| 48 | Kirim setoran: semua baca dikirim dalam satu request, append mengembalikan isi tabel (Apps Script v4), pendaftaran peserta paralel, pemeriksaan skema dilewati bila kolom sudah lengkap. 9 → 3 request ke spreadsheet. | Pengiriman sebelumnya >15 detik. |

## Putaran 14 (10 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 49 | Setujui & Tolak selalu satu baris paling bawah (Setujui kiri, Tolak kanan) di kartu, tabel, dan panel pratinjau; keputusan yang sedang berlaku tampil sebagai tombol nonaktif ("Disetujui ✓"/"Ditolak") alih-alih hilang. "Batalkan" pindah ke baris alat di atas. | Permintaan pengguna: posisi sebelumnya berpindah-pindah. |
| 50 | Pelatihan & Duta memakai sistem link Golden Ticket: tabel `submissions` dengan kolom baru `program` (kosong = golden). Sistem tugas→kode (`tasks`, `task_submissions`) dihapus dari aplikasi; tab lama di sheet dibiarkan (3 baris tugas duta, 0 setoran). | "Sama sistemnya seperti Golden Ticket". |
| 51 | Duplikat dicek per program: video yang sama boleh masuk Golden dan Duta, tapi tidak dua kali di program yang sama. | Kewajiban Duta tidak boleh terhalang setoran Golden orang lain, tetap mencegah setor ulang. |
| 52 | Minimal mingguan `weekly_min_pelatihan` / `weekly_min_duta` (bawaan 3, 0 = tanpa target), minggu Senin 00.00–Minggu 23.59 WIB; yang dihitung link menunggu + disetujui (ditolak tidak). Syarat isi (like/komentar/organik) sama dengan Golden. | Angka bawaan asumsi; diubah admin di Pengaturan. |
| 53 | Login MyTopstar: ShareIn jadi relying party OIDC (authorization code + PKCE, profil dari userinfo), rute `/auth/sso/login` (juga Initiate Login URI untuk peluncuran dari daftar aplikasi MyTopstar) dan `/auth/sso/callback`. Peserta dicocokkan `sso_sub` lalu nomor HP; tanpa nomor HP login ditolak dengan pesan. Aktif hanya bila env `MYTOPSTAR_CLIENT_ID` diisi. | Kredensial client harus didaftarkan pemilik MyTopstar; tidak dibuat sendiri. |
| 54 | Sebelum menulis, header tab dipastikan memuat semua kolom terbaru (ensure lalu baca ulang). | Tanpa ini, setoran Duta pertama di sheet lama akan tersimpan tanpa kolom `program` = terbaca Golden. |
| 55 | Form membaca `/api/rules` tanpa cache browser. | Program yang baru ditutup admin masih tampil terbuka di tab yang pernah dibuka. |
| 56 | Setujui/Tolak/Batalkan = 1 request ke spreadsheet (operasi Apps Script `patch`: cari baris lewat id, tulis kolom review, catat audit_log sekaligus; Apps Script @5). Sebelumnya baca tabel + tulis + 1 append audit per setoran (≈3 × 2,5 dtk). Bila Apps Script lama, otomatis kembali ke cara lama. | Admin menunggu terlalu lama saat menyetujui. |
| 57 | Saat menyimpan review: tombol yang ditekan menampilkan spinner ("Menyetujui…", "Menolak…", "Membatalkan…"), kedua tombol terkunci agar tidak terkirim dua kali, dan bar tipis bergerak di atas layar; juga untuk setujui massal dan saat daftar dimuat ulang. | Admin bingung karena tidak ada tanda proses. |

## Putaran 17 (11 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 58 | Pelatihan = undian: kumpulkan `pelatihan_need_tiktok` (5) link TikTok + `pelatihan_need_reels` (5) link Reels yang **disetujui** sejak putaran dimulai → otomatis masuk roda spin wheel. Tidak ada target mingguan. | Permintaan pengguna. Hanya link disetujui yang dihitung agar link asal tidak bisa membawa orang ke undian. |
| 59 | Spin wheel (tab admin Pelatihan): pemenang dipilih server dengan `crypto.randomInt`, roda hanya menganimasikan hasilnya. Disimpan di tab `spins` (hadiah opsional, jumlah peserta, pengundi). Pemenang di putaran yang sama tidak ikut lagi. "Hapus" = sembunyikan riwayat (baris tetap di sheet, ditandai deleted), orangnya kembali ke roda. "Reset undian" = putaran baru (`pelatihan_round_start` = sekarang), hitungan semua orang mulai 0, riwayat tetap. Hapus/Reset hanya owner. Riwayat pemenang tampil publik dengan nama disingkat. | Permintaan "bisa direset atau dihapus, tampilkan riwayat yang dapat siapa". |
| 60 | Duta = `duta_week_tiktok` (10) + `duta_week_reels` (10) konten per minggu Senin–Minggu WIB, berulang otomatis; dihitung link menunggu + disetujui. | Permintaan pengguna (20 konten/minggu). |
| 61 | Tambah admin, ubah admin, ganti sandi, dan simpan pengaturan menulis baris + audit_log dalam 1 request; bcrypt cost 12 → 10 (bcryptjs murni JS, ±1 dtk per hash); daftar admin dikembalikan langsung tanpa muat ulang; tombol menampilkan spinner. Daftar setoran admin memakai cache 15 dtk. | "Menambahkan akun admin/owner masih lag". |
| 62 | Baris "Like & komentar: cek di link" disembunyikan bila tidak ada angka. | Tampilan lebih ringkas. |

## Putaran 18 (11 Nov 2026)

| # | Keputusan | Alasan |
|---|-----------|--------|
| 63 | Membuka `/pantau/<kode>` TIDAK lagi membuat browser masuk sebagai pemilik link. Halaman pantau menampilkan tombol "Ya, ini saya — masuk" bila belum masuk, dan "Bukan saya, keluar" bila sudah. Kartu progres menampilkan identitas + "Bukan kamu? Keluar", dan bila belum masuk ada form tempel link/kode langsung. | Pengguna melihat "Halo, Fauzan Daffa" padahal belum login: admin pernah membuka link pantau Fauzan (dari Peserta) dan browser otomatis masuk sebagai Fauzan. |
| 64 | Kartu progres interaktif: cincin persen yang terisi, satu chip per link (terisi berurutan, chip putus-putus = menunggu review), strip Senin–Minggu dengan sisa hari (Duta), konfeti saat target tercapai, angka count-up, langkah "Cara ikut", roda kecil berputar di kartu undian. Semua CSS/SVG tanpa library, mati saat reduced-motion. | "Tampilannya interaktif, tidak kaku". |
| 65 | Warna Tailwind memakai hex (bukan `var(--…)`) agar modifier opasitas (`bg-brand-purple/10`, dst.) benar-benar tampil; sebelumnya 38 latar/garis tipis tidak muncul. | Ditemukan saat merapikan kartu progres. |
| 66 | Auto-approve dinyalakan di spreadsheet live untuk Golden Ticket, Pelatihan, dan Duta (permintaan "sistem di setting auto ACC otomatis"). Menyalakan tombol juga menyetujui link yang masih menunggu di program itu. Teks halaman (langkah "Langsung disetujui", "link langsung terhitung") mengikuti setelan. | Permintaan pengguna. Cek otomatis (link valid, bukan duplikat, program dibuka) tetap berlaku; admin tetap bisa menolak. |
| 67 | Panduan "konten pro & kontra" (contoh topik + aturan) hanya untuk Golden Ticket; form dan ketentuan Pelatihan/Duta tanpa syarat topik. Halaman Aturan diperbarui (tidak lagi menyebut tugas/kode PC-/DT-). | Permintaan pengguna. |
| 68 | Pengulangan dibuang: paragraf intro program (sama dengan judul target), tombol di dalam kartu progres (sudah ada tombol utama), subjudul target undian (sudah dijelaskan di "Cara ikut"), panel Ketentuan di Pelatihan/Duta (syarat sudah ada di form), syarat like/komentar di setiap kartu link (sudah ada sekali di "Syarat konten"), petunjuk link hanya di kartu pertama, tombol "+ Setor konten lagi" di pantau bila kartu program sudah punya tombol. Feed link terkumpul 6 per halaman. HP (≤640px): aset latar disembunyikan, blob statis; roda dekorasi tidak berputar. Dicek tanpa overflow di 320–1440px. | "Ringan, cocok untuk HP semua ukuran, hapus pengulangan". |
| 69 | Admin memilih siapa yang tampil di roda: semua peserta Pelatihan putaran ini terdaftar dengan centang (bawaan = yang lengkap), bisa dikeluarkan atau dimasukkan manual; disimpan di setelan `spin_overrides` (WA→ya/tidak). Simpan Pengaturan sekarang menggabungkan ke nilai terbaru agar halaman pengaturan lama tidak membatalkan pilihan roda/reset putaran. | Permintaan pengguna. |
| 70 | Kirim link: akun, setelan, dan daftar link diambil dari cache singkat; di server yang hangat satu-satunya request ke spreadsheet adalah append (yang sekaligus mengembalikan tabel untuk membatalkan duplikat yang lolos cache). 3 → 1 request. | "Percepat proses pengiriman". |
| 71 | Form Pelatihan/Duta menampilkan hitungan TikTok & Instagram secara langsung saat link ditempel (terhitung + bergaris untuk link di form), sebelum dikirim. | Permintaan pengguna. |
| 72 | "Link terkumpul" publik bawaan hanya menampilkan jumlah (total, TikTok, Reels); daftar link + pratinjau tampil bila admin menyalakan `feed_show_links` di Pengaturan. Saat mati, server tidak mengirim link sama sekali (juga lewat /api/collected). | Permintaan pengguna. |
| 73 | Siap 300 pengguna bersamaan: (a) batas per-IP dilonggarkan (satu wifi kampus = satu IP) dan diganti batas per nomor WA / per link pantau; (b) kirim link & pendaftaran peserta di-*micro-batch*: semua yang datang selama satu penulisan berlangsung ikut penulisan berikutnya (300 kiriman → ±25 penulisan), duplikat antar-pengirim dicek dalam gelombang yang sama; (c) error "too many invocations"/lock timeout Apps Script dicoba ulang dengan jeda acak (aman karena skrip tidak berjalan); (d) halaman pantau memakai cache 15 dtk. Diuji dengan simulator Apps Script + 300 pengguna (tests/load). | Permintaan pengguna. Sebelumnya 290 dari 300 kiriman ditolak "terlalu banyak permintaan". |
| 74 | Panggilan ke Apps Script memakai klien HTTP Node (keep-alive), bukan fetch Next: fetch `no-store` di dalam halaman ISR membuat regenerasi halaman gagal (HTTP 500) saat cache halaman kedaluwarsa. | Ditemukan saat uji beban. |
| 75 | Membaca setelan tidak lagi menulis kunci yang belum ada (dulu tiap instance server menambahkannya bersamaan → 12 kunci tercatat 5×). Simpan Pengaturan membaca ulang lalu mengosongkan baris duplikat lama. | Ditemukan saat uji beban; nilai yang dipakai tetap baris terakhir. |
