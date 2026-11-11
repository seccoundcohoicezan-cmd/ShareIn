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
  await expect(page.getByText('Terus bertambah sampai 5 Desember')).toBeVisible()
  await expect(page.getByText(/5\.000\.000/)).toHaveCount(0)
  await shot(page, '12-goldenticket-hadiah')
})

test('URL lama dialihkan', async ({ page }) => {
  for (const [from, to] of [['/setor', '/goldenticket/setor'], ['/golden-ticket', '/goldenticket'], ['/pelatihan-content-creator', '/pelatihancontent'], ['/duta', '/dutateladan']]) {
    await page.goto(from)
    await expect(page).toHaveURL(new RegExp(`${to}$`))
  }
})

async function kirimLink(page: Page, links: string[]) {
  for (let i = 0; i < links.length; i++) {
    if (i > 0) await page.getByRole('button', { name: /Tambah konten/ }).click()
    await page.getByLabel('Link konten').nth(i).fill(links[i])
  }
  await page.getByText('Konten ini muncul organik di FYP TikTok / Beranda Reels saya.').click()
  await page.getByText('Saya sudah membuka link dan kontennya memenuhi minimal like & komentar.').click()
  await page.getByRole('button', { name: /^Kirim/ }).click()
}

test('pelatihan: kirim link seperti Golden Ticket tanpa hadiah, target mingguan, review dengan Setujui/Tolak sebaris di bawah', async ({ page, browser }) => {
  await login(page)
  await page.goto('/admin/pengaturan')
  await page.getByRole('textbox', { name: 'Pelatihan Content' }).fill('2')
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.getByText('Tersimpan')).toBeVisible()

  const ctx = await browser.newContext()
  const peserta = await ctx.newPage()
  await peserta.goto('/pelatihancontent')
  await expect(peserta.getByText('Minimal 2 link per orang')).toBeVisible()
  await expect(peserta.getByText(/hadiah|reward|Rp\s?\d/i)).toHaveCount(0)
  await peserta.getByRole('link', { name: /Kirim link konten/ }).click()
  await expect(peserta).toHaveURL(/\/pelatihancontent\/setor$/)
  await expect(peserta.getByText('Kewajiban: minimal 2 link setiap minggu (Senin–Minggu).')).toBeVisible()
  await expect(peserta.getByText(/peluang reward/i)).toHaveCount(0)
  await peserta.getByLabel('Nama penyetor').fill('Pelita Sari')
  await peserta.getByLabel('Nomor WhatsApp').fill('0813 4444 5555')
  await kirimLink(peserta, ['https://www.tiktok.com/@pelita/video/7400000000000055501'])
  await expect(peserta.getByRole('heading', { name: 'Setoran terkirim' })).toBeVisible()
  await expect(peserta.getByText('Minggu ini 1/2 link. Kurang 1 link lagi.')).toBeVisible()
  await shot(peserta, '13-pelatihan-terkirim')

  await peserta.goto('/pelatihancontent')
  await expect(peserta.getByRole('progressbar', { name: 'Progres minggu ini' })).toHaveAttribute('aria-valuenow', '1')
  const feed = peserta.getByRole('list', { name: 'Daftar link terkumpul' })
  await expect(feed).toContainText('Pelita S.')
  await expect(feed).not.toContainText('0812')
  await shot(peserta, '14-pelatihan-halaman')
  // Golden Ticket's feed does not show Pelatihan links.
  await peserta.goto('/goldenticket')
  await expect(peserta.getByRole('list', { name: 'Daftar link terkumpul' }).getByText('Pelita S.')).toHaveCount(0)

  await page.goto('/admin/program/pelatihan')
  const card = page.locator('li.panel-solid').filter({ hasText: 'Pelita Sari' })
  await expect(card).toBeVisible()
  const preview = await card.getByRole('button', { name: 'Pratinjau & review' }).boundingBox()
  const ok = await card.getByRole('button', { name: 'Setujui' }).boundingBox()
  const no = await card.getByRole('button', { name: 'Tolak' }).boundingBox()
  // Same row, Setujui left of Tolak, both below every other button.
  expect(Math.abs(ok!.y - no!.y)).toBeLessThan(2)
  expect(ok!.x).toBeLessThan(no!.x)
  expect(ok!.y).toBeGreaterThan(preview!.y + preview!.height - 1)
  await shot(page, '15-admin-pelatihan-review')
  await card.getByRole('button', { name: 'Pratinjau & review' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Setujui' })).toBeVisible()
  // A slow spreadsheet: the admin sees a spinner and a top bar, and cannot press twice.
  await page.route('**/api/admin/submissions/*', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })
  await dialog.getByRole('button', { name: 'Setujui' }).click()
  await expect(dialog.getByRole('button', { name: 'Menyetujui…' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Tolak' })).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'Menyimpan…' })).toBeAttached()
  await shot(page, '15a-admin-menyetujui')
  await expect(dialog.getByRole('button', { name: 'Disetujui ✓' })).toBeDisabled()
  await page.unroute('**/api/admin/submissions/*')
  await expect(dialog.getByRole('button', { name: 'Tolak' })).toBeEnabled()
  await shot(page, '15b-admin-preview')
  await dialog.getByRole('button', { name: 'Tutup' }).click()

  await page.getByRole('tab', { name: 'Rekap mingguan' }).click()
  const row = page.locator('li').filter({ hasText: 'Pelita Sari' })
  await expect(row).toContainText('1/2')
  await expect(row.getByRole('link', { name: 'Ingatkan via WA' })).toHaveAttribute('href', /wa\.me\/6281344445555\?text=.*kurang%201%20lagi/)
  await shot(page, '15c-admin-rekap')

  const pantau = (await peserta.request.get('/api/me')).ok() ? await (await peserta.request.get('/api/me')).json() : null
  await peserta.goto(`/pantau/${pantau.user.token}`)
  await expect(peserta.getByRole('region', { name: 'Target mingguan Pelatihan Content' })).toContainText('1/2 link')
  await expect(peserta.getByRole('list', { name: 'Daftar setoran' })).toContainText('Disetujui')
  await ctx.close()
})

test('duta teladan: masuk lewat MyTopstar langsung ke form kirim link, program bisa ditutup', async ({ page, browser }) => {
  const ctx = await browser.newContext()
  const duta = await ctx.newPage()
  await duta.goto('/dutateladan')
  await expect(duta.getByRole('heading', { level: 1 })).toHaveText('Duta Teladan')
  await duta.getByRole('link', { name: 'Masuk dengan MyTopstar' }).click()
  await expect(duta.getByRole('heading', { name: 'ShareIn wants you to sign in' })).toBeVisible()
  await duta.getByRole('link', { name: 'Allow' }).click()
  await expect(duta).toHaveURL(/\/dutateladan\/setor$/)
  await expect(duta.getByText('Masuk sebagai Dewi Duta · 6281••••234')).toBeVisible()
  await shot(duta, '16-duta-sso-masuk')
  await kirimLink(duta, ['https://www.tiktok.com/@dewi/video/7400000000000066601', 'https://www.instagram.com/reel/DutaReel01/'])
  await expect(duta.getByRole('heading', { name: '2 setoran terkirim' })).toBeVisible()
  await expect(duta.getByText('Minggu ini 2/3 link. Kurang 1 link lagi.')).toBeVisible()

  // Launch from the MyTopstar app list (third-party initiated login) for someone already known.
  const ctx2 = await browser.newContext()
  const launch = await ctx2.newPage()
  await launch.goto('/auth/sso/login?iss=http%3A%2F%2Flocalhost%3A39117%2Foidc&target_link_uri=http%3A%2F%2Flocalhost%3A3123%2Fdutateladan')
  await launch.getByRole('link', { name: 'Allow' }).click()
  await expect(launch).toHaveURL(/\/dutateladan$/)
  await expect(launch.getByText('Halo, Dewi Duta')).toBeVisible()
  await expect(launch.getByRole('progressbar', { name: 'Progres minggu ini' })).toHaveAttribute('aria-valuenow', '2')
  await shot(launch, '16b-duta-halaman')
  // Foreign issuer and declined consent are refused with a clear message.
  await launch.goto('/auth/sso/login?iss=https%3A%2F%2Fevil.example%2Foidc')
  await expect(launch).toHaveURL(/sso=gagal/)
  await launch.goto('/auth/sso/login')
  await launch.getByRole('link', { name: 'Decline' }).click()
  await expect(launch.getByText('Login MyTopstar dibatalkan.')).toBeVisible()
  await ctx2.close()

  await login(page)
  await page.goto('/admin/program/duta')
  await expect(page.locator('li.panel-solid').filter({ hasText: 'Dewi Duta' })).toHaveCount(2)
  await page.goto('/admin/pengaturan')
  const sw = page.getByRole('switch', { name: 'Pengumpulan Duta Teladan dibuka' })
  if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click()
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.getByText('Tersimpan')).toBeVisible()
  await duta.goto('/dutateladan/setor')
  await expect(duta.getByText('Setoran Duta Teladan sedang ditutup.', { exact: false })).toBeVisible()
  await expect(duta.getByRole('button', { name: /^Kirim/ })).toBeDisabled()
  await ctx.close()
})

test('admin peserta: link unik per nomor WA bisa dikirim ulang', async ({ page }) => {
  await login(page)
  await page.goto('/admin/peserta')
  const pelita = page.locator('li', { hasText: 'Pelita Sari' })
  await expect(pelita).toContainText('6281344445555')
  await expect(pelita.getByRole('link', { name: 'Kirim link via WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/6281344445555\?text=.*pantau/)
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
  for (const n of ['Golden Ticket', 'Pelatihan Content', 'Setoran dibuka']) {
    const sw = page.getByRole('switch', { name: n, exact: true })
    if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'true')
  }
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
  }
  await page.getByLabel(/muncul organik/).check()
  await page.getByLabel(/sudah membuka link/).check()

  // Third link is an Instagram post, not a reel: red, and the form cannot be sent.
  const third = page.getByRole('region', { name: 'Konten 3', exact: true })
  await expect(third.getByLabel('Link konten')).toHaveAttribute('aria-invalid', 'true')
  await expect(third.getByText(/Link harus dari tiktok\.com/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kirim 3 setoran' })).toBeDisabled()
  await expect(page.getByText('Ada link yang merah. Perbaiki atau hapus dulu sebelum mengirim.')).toBeVisible()
  await shot(page, '22-setor-banyak-merah')

  await page.getByRole('button', { name: 'Hapus konten 3' }).click()
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
