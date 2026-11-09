import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.E2E_SHOTS || 'test-results/shots'
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })

async function login(page: Page, password = 'rahasia-e2e-123') {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('owner@sharein.test')
  await page.getByLabel('Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('heading', { name: 'Dasbor' })).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test('landing: tutorial & panduan berjalan otomatis, berhenti saat langkah diklik', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
  await expect(nav.getByRole('link')).toHaveText(['Tutorial', 'Aturan'])
  await expect(page.locator('main a[href="/goldenticket"], main a[href="/pelatihancontent"], main a[href="/dutateladan"]')).toHaveCount(0)

  const tut = page.getByRole('list', { name: 'Langkah tutorial' })
  const current = () => tut.locator('[aria-current="step"] b').textContent()
  await page.locator('#tutorial').scrollIntoViewIfNeeded()
  await expect(page.getByText('Upload selesai')).toBeVisible({ timeout: 8000 })
  await expect.poll(current, { timeout: 10_000 }).toBe('Bagikan link')
  await expect(page.getByText('Terkirim ke grup WhatsApp!')).toBeVisible({ timeout: 8000 })
  await shot(page, '11-landing')
  // Click a step → autoplay stops on that step.
  await tut.getByRole('button', { name: /Dapatkan reward/ }).click()
  await expect(page.getByText('Peluang reward makin besar!')).toBeVisible()
  await expect(page.getByText('Makin banyak konten yang kamu submit, makin besar peluang rewardmu.').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Putar otomatis|Jeda/ })).toHaveCount(0)
  await page.waitForTimeout(6000)
  expect(await current()).toBe('Dapatkan reward')

  // Link guide autoplays through the real screenshots, stops when a step is clicked.
  const guide = page.locator('#panduan')
  await guide.scrollIntoViewIfNeeded()
  await expect(guide.getByRole('img', { name: /Buka video di FYP/ })).toBeVisible()
  await expect(guide.getByRole('img', { name: /Salin Tautan/ })).toBeVisible({ timeout: 6000 })
  await guide.getByRole('button', { name: /Buka video di FYP/ }).click()
  await page.waitForTimeout(5000)
  await expect(guide.getByRole('img', { name: /Buka video di FYP/ })).toBeVisible()
  await guide.getByRole('button', { name: /Ketuk di sini: Buka video di FYP/ }).click()
  await expect(guide.getByRole('img', { name: /Salin Tautan/ })).toBeVisible()
  await guide.getByRole('tab', { name: 'Instagram Reels' }).click()
  for (let i = 0; i < 3; i++) await guide.getByRole('button', { name: 'Lanjut' }).click()
  await expect(guide.getByRole('img', { name: /Disalin/ })).toBeVisible()
  await shot(page, '11b-panduan-ig')
})

test('aturan: tanpa tombol setor, ada daftar sublink program', async ({ page }) => {
  await page.goto('/aturan')
  await expect(page.getByRole('link', { name: 'Setor konten Golden Ticket' })).toHaveCount(0)
  await expect(page.getByText('halaman Riwayat')).toHaveCount(0)
  const list = page.locator('section', { hasText: 'Halaman program' })
  for (const href of ['/goldenticket', '/pelatihancontent', '/dutateladan', '/pantau', '/#tutorial']) {
    await expect(list.locator(`a[href="${href}"]`)).toBeVisible()
  }
  await expect(list.locator('a[href="/goldenticket/setor"]')).toHaveCount(0)
  await shot(page, '19-aturan-sublink')
})

test('latar: aset ikut bergeser saat scroll', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 700 })
  await page.goto('/aturan')
  const pos = () => page.locator('.a-gift').evaluate((el) => el.getBoundingClientRect().top)
  const before = await pos()
  await page.mouse.wheel(0, 2000)
  await expect.poll(pos).toBeLessThan(before - 40)
})

test('golden ticket: hadiah berjalan mulai Rp2 jt dan terus naik', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-20T12:00:00+07:00') })
  await page.goto('/goldenticket')
  const amount = page.locator('p', { hasText: /^Rp\d/ }).first()
  await expect(amount).toHaveText(/^Rp3\./)
  const read = async () => Number((await amount.textContent())!.replace(/\D/g, ''))
  const a = await read()
  await page.clock.runFor(10_000)
  await expect.poll(read).toBeGreaterThan(a)
  expect(await read()).toBeLessThan(5_000_000)
  await expect(page.getByText(/hingga Rp5\.000\.000 pada 5 Desember/)).toBeVisible()
  await shot(page, '12-goldenticket-hadiah')
})

test('URL lama dialihkan', async ({ page }) => {
  for (const [from, to] of [['/setor', '/goldenticket/setor'], ['/golden-ticket', '/goldenticket'], ['/pelatihan-content-creator', '/pelatihancontent'], ['/duta', '/dutateladan']]) {
    await page.goto(from)
    await expect(page).toHaveURL(new RegExp(`${to}$`))
  }
})

test('pelatihan: admin buat tugas → peserta dapat kode → admin setujui → pantau, tanpa hadiah/spin', async ({ page, browser }) => {
  await login(page)
  await page.goto('/admin/program/pelatihan')
  await page.getByRole('tab', { name: 'Daftar tugas' }).click()
  for (const title of ['Buat video 30 detik tentang Sharein', 'Unggah videonya ke Sharein']) {
    await page.getByRole('button', { name: 'Tambah tugas' }).click()
    await page.getByLabel('Judul tugas').fill(title)
    await page.getByLabel('Bukti yang diminta').fill('Link video')
    await page.getByRole('button', { name: 'Simpan tugas' }).click()
    await expect(page.getByText(title)).toBeVisible()
  }

  const peserta = await browser.newPage()
  await peserta.goto('/pelatihancontent')
  await expect(peserta.getByRole('paragraph').filter({ hasText: 'Buat video 30 detik tentang Sharein' })).toBeVisible()
  await peserta.getByLabel('Nama lengkap').fill('Rina Utami')
  await peserta.getByLabel('Nomor WhatsApp', { exact: true }).fill('0812 3456 7890')
  await peserta.getByLabel('Link bukti').fill('https://www.tiktok.com/@rina/video/1')
  await peserta.getByRole('button', { name: 'Kumpulkan & dapat kode' }).click()
  const code = peserta.locator('#kode-hasil')
  await expect(code).toHaveText(/^PC-[A-Z2-9]{6}$/)
  const theCode = (await code.textContent())!
  await shot(peserta, '13-pelatihan-kode')
  const pantauHref = (await peserta.getByRole('link', { name: 'Buka halaman pantau' }).first().getAttribute('href'))!
  expect(pantauHref).toMatch(/^\/pantau\/[A-HJ-NP-Z2-9]{12}$/)

  // Same task twice → refused with the existing code.
  await peserta.getByRole('button', { name: 'Kumpulkan tugas lain' }).click()
  await peserta.getByLabel('Tugas', { exact: true }).selectOption({ label: '1. Buat video 30 detik tentang Sharein' })
  await peserta.getByLabel('Link bukti').fill('https://www.tiktok.com/@rina/video/2')
  await peserta.getByRole('button', { name: 'Kumpulkan & dapat kode' }).click()
  await expect(peserta.getByText(`Tugas ini sudah kamu kumpulkan. Kodemu: ${theCode}.`)).toBeVisible()

  await page.getByRole('tab', { name: 'Setoran tugas' }).click()
  await expect(page.getByText(theCode)).toBeVisible()
  await page.getByRole('button', { name: 'Setujui', exact: true }).click()
  await expect(page.getByRole('status').getByText('Disetujui')).toBeVisible()

  await page.goto('/admin/spin')
  await expect(page.getByRole('heading', { name: 'Spin wheel' })).toHaveCount(0)
  await peserta.goto('/pelatihancontent')
  await expect(peserta.getByText(/spin wheel|pemenang|hadiah|undi/i)).toHaveCount(0)
  await peserta.goto(pantauHref)
  const list = peserta.getByRole('list', { name: 'Daftar setoran' })
  await expect(list).toContainText(theCode)
  await expect(list).toContainText('Disetujui')
  await expect(list).not.toContainText('Menang')
  await shot(peserta, '15b-pantau-disetujui')
})

test('duta teladan: halaman kewajiban, kode DT-, pengumpulan bisa ditutup', async ({ page, browser }) => {
  await login(page)
  await page.goto('/admin/program/duta')
  await page.getByRole('tab', { name: 'Daftar tugas' }).click()
  await page.getByRole('button', { name: 'Tambah tugas' }).click()
  await page.getByLabel('Judul tugas').fill('Posting 1 konten Sharein per minggu')
  await page.getByRole('button', { name: 'Simpan tugas' }).click()
  await expect(page.getByText('Posting 1 konten Sharein per minggu')).toBeVisible()

  const duta = await browser.newPage()
  await duta.goto('/dutateladan')
  await expect(duta.getByRole('heading', { level: 1 })).toHaveText('Duta Teladan')
  await duta.getByLabel('Nama lengkap').fill('Budi Santoso')
  await duta.getByLabel('Nomor WhatsApp', { exact: true }).fill('081298765432')
  await duta.getByLabel('Link bukti').fill('https://sharein.id/c/budi1')
  await duta.getByRole('button', { name: 'Kumpulkan & dapat kode' }).click()
  await expect(duta.locator('#kode-hasil')).toHaveText(/^DT-/)
  await shot(duta, '16-duta')

  await page.goto('/admin/pengaturan')
  await page.getByRole('switch', { name: 'Pengumpulan Duta Teladan dibuka' }).click()
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.getByText('Tersimpan')).toBeVisible()
  const res = await duta.request.post('/api/programs/duta/submit', {
    data: { task_id: 'x', name: 'Budi Santoso', whatsapp: '081298765432', proof_url: 'https://sharein.id/c/2' },
  })
  expect((await res.json()).message).toMatch(/ditutup/)
})

test('admin peserta: link unik per nomor WA bisa dikirim ulang', async ({ page }) => {
  await login(page)
  await page.goto('/admin/peserta')
  const rina = page.locator('li', { hasText: 'Rina Utami' })
  await expect(rina).toContainText('6281234567890')
  await expect(rina.getByRole('link', { name: 'Kirim link via WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/6281234567890\?text=.*pantau/)
  await shot(page, '18-admin-peserta')
})

test('akun admin: ganti sandi, login dengan sandi baru, tambah reviewer', async ({ page }) => {
  await login(page)
  await page.goto('/admin/akun')
  await page.getByLabel('Sandi saat ini').fill('rahasia-e2e-123')
  await page.getByLabel('Sandi baru (min. 10 karakter)').fill('sandi-baru-e2e-456')
  await page.getByLabel('Ulangi sandi baru').fill('sandi-baru-e2e-456')
  await page.getByRole('button', { name: 'Simpan sandi baru' }).click()
  await expect(page.getByText('Sandi diganti')).toBeVisible()

  await page.getByLabel('Email', { exact: true }).fill('reviewer@sharein.test')
  await page.getByLabel('Sandi awal (min. 10 karakter)').fill('reviewer-e2e-789')
  await page.getByRole('button', { name: 'Tambah admin' }).click()
  await expect(page.getByText('reviewer@sharein.test', { exact: true })).toBeVisible()
  await shot(page, '17-admin-akun')

  // Owner cannot demote the last owner.
  await page.getByLabel('Peran owner@sharein.test').selectOption('reviewer')
  await expect(page.getByText('Harus tersisa minimal satu owner aktif.')).toBeVisible()

  await page.getByRole('button', { name: 'Keluar' }).click()
  await expect(page.getByRole('heading', { name: 'Masuk admin' })).toBeVisible()
  await page.getByLabel('Email').fill('owner@sharein.test')
  await page.getByLabel('Sandi').fill('rahasia-e2e-123')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByText('Email atau sandi salah.')).toBeVisible()
  await page.getByLabel('Sandi').fill('sandi-baru-e2e-456')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('heading', { name: 'Dasbor' })).toBeVisible()
})

test('setujui otomatis per program + API Golden Ticket dengan kunci', async ({ page, request, browser }) => {
  await login(page, 'sandi-baru-e2e-456')
  await page.goto('/admin/api')
  await page.getByLabel('Nama kunci').fill('Sistem Uji')
  await page.getByRole('button', { name: 'Buat kunci' }).click()
  const key = (await page.locator('#kunci-baru').textContent())!
  expect(key).toMatch(/^si_live_/)
  await shot(page, '20-admin-api')
  const auth = { Authorization: `Bearer ${key}` }

  expect((await request.get('/api/v1/goldenticket/summary')).status()).toBe(401)
  expect((await request.get('/api/v1/goldenticket/submissions', { headers: { Authorization: 'Bearer si_live_salah' } })).status()).toBe(401)
  const sum = await (await request.get('/api/v1/goldenticket/summary', { headers: { 'X-API-Key': key } })).json()
  expect(sum).toMatchObject({ ok: true, auto_approve: false })
  expect(sum.prize.end).toBe(5_000_000)
  const before = await (await request.get('/api/v1/goldenticket/submissions', { headers: auth })).json()
  expect(before.total).toBeGreaterThan(0)
  expect((await request.get('/api/v1/goldenticket/submissions?limit=9999', { headers: auth })).status()).toBe(400)

  await page.goto('/admin/pengaturan')
  for (const n of ['Golden Ticket', 'Pelatihan Content', 'Setoran dibuka']) await page.getByRole('switch', { name: n, exact: true }).click()
  await page.getByLabel('QTY TikTok').fill('50')
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.getByText('Tersimpan')).toBeVisible()
  await shot(page, '21-admin-otomatis')

  const res = await request.post('/api/submissions', {
    data: { submitter_name: 'Otomatis Satu', whatsapp: '081277770001', platform: 'tiktok', source_url: 'https://www.tiktok.com/@o/video/7400000000000099999', sharein_url: 'https://sharein.id/c/auto', likes: 200000, comments: 8000, organic_declared: true, checked_declared: true },
  })
  expect(res.status()).toBe(201)
  const made = await res.json()
  expect(made.status).toBe('approved')
  const one = await (await request.get(`/api/v1/goldenticket/submissions/${made.id}`, { headers: auth })).json()
  expect(one.item).toMatchObject({ status: 'approved', reviewed_by: 'otomatis', whatsapp: '6281277770001' })

  const ctx = await browser.newContext()
  const user = await ctx.newPage()
  await user.goto(`/pantau/${made.token}`)
  await expect(user.getByRole('list', { name: 'Daftar setoran' })).toContainText('Disetujui otomatis')
  await expect(user.getByRole('list', { name: 'Daftar setoran' })).toContainText('Diperiksa sistem')
  await ctx.close()

  await page.goto('/admin/api')
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Cabut' }).click()
  await expect(page.getByText('Dicabut', { exact: true })).toBeVisible()
  expect((await request.get('/api/v1/goldenticket/summary', { headers: auth })).status()).toBe(401)
})

test('setor banyak: tambah (+) sampai 10, link salah merah dan tidak bisa kirim, kirim sekaligus', async ({ page, browser }) => {
  await page.goto('/goldenticket/setor')
  await page.getByLabel('Nama penyetor').fill('Banyak Konten')
  await page.getByLabel('Nomor WhatsApp').fill('081299990001')
  const add = page.getByRole('button', { name: /Tambah konten/ })
  await expect(add).toHaveText('+ Tambah konten (1/10)')
  for (let i = 0; i < 9; i++) await add.click()
  await expect(page.getByRole('button', { name: 'Sudah maksimal 10 konten' })).toBeDisabled()
  await expect(page.getByRole('region', { name: /^Konten \d+$/ })).toHaveCount(10)
  await page.getByRole('button', { name: 'Hapus konten 10' }).click()
  for (let i = 9; i > 3; i--) await page.getByRole('button', { name: `Hapus konten ${i}` }).click()
  await expect(page.getByRole('region', { name: /^Konten \d+$/ })).toHaveCount(3)

  const links = ['https://www.tiktok.com/@a/video/7400000000000055501', 'https://www.instagram.com/reel/DeDMIOTB2WD/?utm_source=ig_web_copy_link&dlrf=NTc4MTIwNjQ2YQ==', 'https://www.instagram.com/p/C1aBcD2eFgH/']
  for (let i = 0; i < 3; i++) {
    const c = page.getByRole('region', { name: `Konten ${i + 1}`, exact: true })
    await c.getByLabel('Link konten').fill(links[i])
    await c.getByLabel('Like', { exact: true }).fill('150000')
    await c.getByLabel('Komentar', { exact: true }).fill('9000')
    await c.getByLabel('Link Sharein').fill(`https://sharein.id/c/banyak${i}`)
  }
  await page.getByLabel(/muncul organik/).check()
  await page.getByLabel(/sudah membuka link/).check()

  // Third link is an Instagram post, not a reel: red, and the form cannot be sent.
  const third = page.getByRole('region', { name: 'Konten 3', exact: true })
  await expect(third.getByLabel('Link konten')).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: 'Cek setoran' }).click()
  await expect(third.locator('ul').getByText(/Link harus dari tiktok\.com/)).toBeVisible()
  await expect(third.locator('ul li')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Kirim 3 setoran' })).toBeDisabled()
  await shot(page, '22-setor-banyak-merah')

  await page.getByRole('button', { name: 'Hapus konten 3' }).click()
  await page.getByRole('button', { name: 'Cek setoran' }).click()
  await expect(page.getByText(/Lolos semua cek/)).toHaveCount(2)
  await page.getByRole('button', { name: 'Kirim 2 setoran' }).click()
  await expect(page.getByRole('heading', { name: '2 setoran terkirim' })).toBeVisible()
  await shot(page, '23-setor-banyak-sukses')
  const href = await page.getByRole('link', { name: 'Buka halaman pantau' }).getAttribute('href')

  const ctx = await browser.newContext()
  const u = await ctx.newPage()
  await u.goto(href!)
  const list = u.getByRole('list', { name: 'Daftar setoran' })
  await expect(list).toContainText('Konten TikTok')
  await expect(list).toContainText('Konten Instagram Reels')
  await ctx.close()
})
