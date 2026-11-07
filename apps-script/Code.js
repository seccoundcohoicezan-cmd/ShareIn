/**
 * ShareIn — API database untuk web (Next.js).
 * Web memanggil doPost dengan rahasia bersama; hanya operasi tabel generik:
 * ensure (buat tab + header), read, append, update. Semua dijalankan di bawah
 * LockService agar penulisan dari beberapa server tidak bertabrakan.
 */

function doGet() {
  return jsonOut_({ ok: true, service: 'sharein-db' });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOut_({ ok: false, error: 'bad_json' });
  }
  if (!rahasiaCocok_(req.secret)) return jsonOut_({ ok: false, error: 'unauthorized' });
  var ops = Array.isArray(req.ops) ? req.ops : [req];
  // Reads run in parallel; only writes (and schema changes) are serialized.
  var writes = ops.some(function (op) { return op.action !== 'read'; });
  var lock = writes ? LockService.getScriptLock() : null;
  try {
    if (lock) lock.waitLock(25000);
    var results = ops.map(jalankan_);
    SpreadsheetApp.flush();
    return jsonOut_({ ok: true, results: results });
  } catch (err) {
    return jsonOut_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (ignore) {} }
  }
}

function jalankan_(op) {
  switch (op.action) {
    case 'ensure': return ensure_(op.tables || {});
    case 'read': return read_(op.table);
    case 'append': return append_(op.table, op.rows || []);
    case 'update': return update_(op.table, op.updates || []);
    default: throw new Error('aksi tidak dikenal: ' + op.action);
  }
}

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  if (!/^[a-z_]+$/.test(String(name))) throw new Error('nama tabel tidak valid');
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('tab tidak ada: ' + name);
  return sh;
}

function ensure_(tables) {
  var ss = ss_();
  var out = {};
  Object.keys(tables).forEach(function (name) {
    if (!/^[a-z_]+$/.test(name)) throw new Error('nama tabel tidak valid');
    var want = tables[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
    }
    var width = Math.max(sh.getLastColumn(), 1);
    var header = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, width).getValues()[0].map(String).filter(function (h) { return h !== ''; }) : [];
    var merged = header.slice();
    want.forEach(function (c) { if (merged.indexOf(c) < 0) merged.push(c); });
    // Semua kolom berformat teks agar nomor WA, tanggal ISO, dan ID tidak diubah otomatis oleh Sheets.
    sh.getRange(1, 1, sh.getMaxRows(), Math.max(merged.length, 1)).setNumberFormat('@');
    if (merged.length !== header.length) {
      sh.getRange(1, 1, 1, merged.length).setValues([merged]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    rapikanStatus_(sh, merged);
    out[name] = merged;
  });
  return { headers: out };
}

// Status column: dropdown + colours, so admins can approve/reject straight in the sheet.
// Indonesian values typed by hand (disetujui/ditolak/menunggu) are also accepted by the web.
function rapikanStatus_(sh, header) {
  var col = header.indexOf('status') + 1;
  if (col < 1) return;
  var rows = Math.max(sh.getMaxRows() - 1, 1);
  var range = sh.getRange(2, col, rows, 1);
  var values = ['pending', 'approved', 'rejected', 'void'];
  var dv = range.getDataValidation();
  if (!dv) {
    range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(true).build());
  }
  var rules = sh.getConditionalFormatRules();
  if (rules.length) return;
  var color = [['approved', '#DCFCE7'], ['disetujui', '#DCFCE7'], ['rejected', '#FEE2E2'], ['ditolak', '#FEE2E2'], ['pending', '#FEF3C7'], ['menunggu', '#FEF3C7']];
  sh.setConditionalFormatRules(color.map(function (c) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(c[0]).setBackground(c[1]).setRanges([range]).build();
  }));
}

function read_(table) {
  var sh = sheet_(table);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { header: [], rows: [] };
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues().map(function (r) { return r.map(sel_); });
  return { header: values[0], rows: values.slice(1) };
}

function sel_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  return String(v);
}

// Nilai yang diawali = + - @ disimpan sebagai teks, bukan rumus.
function tulis_(v) {
  var s = sel_(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function append_(table, rows) {
  if (!rows.length) return { appended: 0 };
  var sh = sheet_(table);
  var width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
  var start = sh.getLastRow() + 1;
  var range = sh.getRange(start, 1, rows.length, width);
  range.setNumberFormat('@');
  range.setValues(rows.map(function (r) {
    var out = r.map(tulis_);
    while (out.length < width) out.push('');
    return out;
  }));
  return { appended: rows.length, firstIndex: start - 2 };
}

function update_(table, updates) {
  var sh = sheet_(table);
  updates.forEach(function (u) {
    var rowNo = Number(u.index) + 2;
    if (!(rowNo >= 2)) throw new Error('indeks baris tidak valid');
    var range = sh.getRange(rowNo, 1, 1, u.row.length);
    range.setNumberFormat('@');
    range.setValues([u.row.map(tulis_)]);
  });
  return { updated: updates.length };
}

function rahasiaCocok_(given) {
  var secret = typeof API_SECRET === 'string' ? API_SECRET : '';
  if (!secret || secret.length < 32 || typeof given !== 'string' || given.length !== secret.length) return false;
  var diff = 0;
  for (var i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Jalankan SEKALI dari editor (Run → siapkan) untuk memberi izin akses spreadsheet. */
function siapkan() {
  var ss = ss_();
  Logger.log('Terhubung ke spreadsheet: ' + ss.getName() + '. Web siap memakai Apps Script ini.');
}
