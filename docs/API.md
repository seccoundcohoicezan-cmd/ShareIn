# API Golden Ticket

API hanya-baca untuk menarik data Golden Ticket ke sistem lain.

**Kunci API:** login sebagai owner → menu **API** → *Buat kunci*. Kunci hanya ditampilkan sekali; di spreadsheet (tab `api_keys`) hanya tersimpan hash-nya. Kunci bisa dicabut kapan saja (berlaku paling lama 60 detik).

Kirim kunci lewat salah satu header:

```
Authorization: Bearer si_live_xxx
X-API-Key: si_live_xxx
```

Panggil dari server, bukan dari kode browser: data berisi nama dan nomor WhatsApp peserta. Batas 120 permintaan/menit per kunci.

## GET /api/v1/goldenticket/summary

Hadiah berjalan, periode aktif, aturan, jumlah link terkumpul (`collected`, semua periode), dan jumlah setoran periode ini.

```json
{
  "ok": true,
  "period_id": "2026-11-W2",
  "period_open": true,
  "auto_approve": false,
  "prize": { "current": 2345678, "start": 2000000, "end": 5000000, "start_at": "…", "end_at": "…" },
  "rules": { "tiktok": { "min_like": 100000, "min_comment": 5000 }, "reels": { "min_like": 100000, "min_comment": 3000 } },
  "collected": { "total": 1, "tiktok": 1, "reels": 0 },
  "counts": { "total": 1, "pending": 1, "approved": 0, "rejected": 0 },
  "generated_at": "…"
}
```

## GET /api/v1/goldenticket/submissions

| Parameter | Nilai | Bawaan |
|---|---|---|
| `status` | `pending` / `approved` / `rejected` / `all` | `all` |
| `platform` | `tiktok` / `reels` / `all` | `all` |
| `period` | id periode, mis. `2026-11-W2` | semua |
| `updated_since` | ISO 8601; setoran yang dibuat atau direview sejak waktu itu | - |
| `limit` | 1–500 | 100 |
| `offset` | ≥ 0 | 0 |

Urut dari yang paling lama. Ambil halaman berikutnya dengan `offset = next_offset` sampai `next_offset` bernilai `null`.

```json
{
  "ok": true, "total": 1, "limit": 100, "offset": 0, "next_offset": null,
  "items": [{
    "id": "sub_x", "created_at": "…", "period_id": "2026-11-W2",
    "submitter_name": "Rina", "whatsapp": "6281234567890",
    "platform": "tiktok", "source_url": "https://www.tiktok.com/@a/video/74…", "source_key": "tt:74…",
    "sharein_url": "https://sharein.id/c/abc", "likes": 120000, "comments": 6200,
    "metrics_source": "manual", "organic_declared": true,
    "status": "approved", "reject_reason": "", "reviewed_by": "otomatis", "reviewed_at": "…"
  }]
}
```

`reviewed_by` bernilai `otomatis` bila disetujui oleh pengaturan *Setujui otomatis*.

Status yang diubah manual langsung di spreadsheet tidak mengisi `reviewed_at`, sehingga tidak tertangkap `updated_since`. Lakukan sinkron penuh berkala bila admin sering mengedit sheet.

## GET /api/v1/goldenticket/submissions/{id}

`{ "ok": true, "item": { … } }`, atau 404 `not_found`.

## Galat

| Kode | `error` | Arti |
|---|---|---|
| 400 | `invalid_query` | Parameter salah (`message` menjelaskan) |
| 401 | `invalid_api_key` | Kunci kosong, salah, atau sudah dicabut |
| 404 | `not_found` | Setoran tidak ada |
| 429 | `rate_limited` | Terlalu sering; lihat `retry_after` (detik) |
