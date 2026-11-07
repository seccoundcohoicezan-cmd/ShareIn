# Apps Script (API database)

Proyek Apps Script yang terikat ke spreadsheet ShareIn. Web memanggil Web App ini dari server (route `/api`) dengan rahasia bersama.

- `Code.js` — doPost: `ensure`, `read`, `append`, `update` di bawah LockService.
- `Rahasia.js` — **tidak di-commit**. Berisi `var API_SECRET = '...';` dan harus sama dengan env `APPS_SCRIPT_SECRET` di Vercel. Buat dengan `node scripts/rahasia-apps-script.mjs`.

Push & deploy (akun pemilik spreadsheet):

```bash
cd apps-script
clasp push -f
clasp deploy -i <deploymentId> -d "keterangan"
```

Pertama kali: buka editor Apps Script → pilih fungsi `siapkan` → Run → izinkan akses.
