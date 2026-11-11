import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.E2E_SHOTS || 'test-results/shots'
const vid = (n: number) => `https://www.tiktok.com/@kreator/video/74000000000000${String(n).padStart(5, "0")}?is_from_webapp=1&sender_device=pc`

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

async function login(page: Page) {
  await page.goto('/admin')
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/admin\/login/)
  await page.getByLabel('Email').fill('owner@sharein.test')
  await page.getByLabel('Sandi').fill('rahasia-e2e-123')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('heading', { name: 'Dasbor' })).toBeVisible()
}

const waFor = (name: string) => '0812' + String([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1e8, 7)).padStart(8, '1')
let rinaToken = ''

async function fillForm(page: Page, o: { name: string; url: string }) {
  await page.goto('/goldenticket/setor')
  await expect(page.getByText('Cari konten yang memicu pro & kontra')).toBeVisible()
  await page.getByLabel('Nama penyetor').fill(o.name)
  await page.getByLabel('Nomor WhatsApp').fill(waFor(o.name))
  await page.getByLabel('Link konten').fill(o.url)
  await page.getByLabel(/muncul organik/).check()
  await page.getByLabel(/sudah membuka link/).check()
}

test.describe.configure({ mode: 'serial' })

test('golden ticket: tanpa target, link terkumpul, ketentuan, latar ringan', async ({ page }) => {
  await page.goto('/goldenticket')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Golden Ticket')
  await expect(page.getByText('Target periode ini')).toHaveCount(0)
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByText('Belum ada link terkumpul.')).toBeVisible()
  await expect(page.getByText('≥ 100 rb like · ≥ 5 rb komentar')).toBeVisible()
  // 1 layer + 3 blobs + 6 brand assets, all animated with transform only.
  const layers = await page.evaluate(() => document.getElementById('bg')!.children.length)
  expect(layers).toBe(9)
  await shot(page, '01-goldenticket')
})

test('latar mati saat prefers-reduced-motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/')
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('off')
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.b1')!).animationName)
  expect(anim).toBe('none')
  await ctx.close()
})

test('setor: cukup tempel link (tanpa angka & tanpa link Sharein), syarat minimal tetap tampil', async ({ page }) => {
  await fillForm(page, { name: 'Rina Uji', url: vid(1) })
  await expect(page.getByLabel('Like', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Komentar', { exact: true })).toHaveCount(0)
  const syarat = page.locator('section', { hasText: 'Syarat konten' })
  await expect(syarat).toContainText('Like min. 100.000')
  await expect(syarat).toContainText('Komentar min. 5.000')
  await expect(syarat).toContainText('Komentar min. 3.000')
  await expect(syarat).toContainText('Bumi itu bulat atau datar?')
  await expect(page.getByText('Link valid · TikTok')).toBeVisible()
  // The minimums are shown once in the Syarat konten box, not repeated on each link card.
  await expect(page.getByText(/Syarat TikTok: minimal/)).toHaveCount(0)
  await shot(page, '02-setor-sederhana')
  // One button: check + send in one step, enabled as soon as the link is valid.
  await expect(page.getByRole('button', { name: 'Cek setoran' })).toHaveCount(0)
  const send = page.getByRole('button', { name: 'Kirim setoran' })
  await expect(send).toBeEnabled()
  await send.click()
  await expect(page.getByRole('heading', { name: 'Setoran terkirim' })).toBeVisible()
  await expect(page.getByText('Terkirim', { exact: true })).toBeVisible()
  await shot(page, '04-sukses')

  // Unique link = account: shown on success, opens the live tracking page.
  await expect(page.getByText('Link pantau unikmu')).toBeVisible()
  const href = await page.getByRole('link', { name: 'Buka halaman pantau' }).getAttribute('href')
  rinaToken = href!.split('/').pop()!
  expect(rinaToken).toMatch(/^[A-HJ-NP-Z2-9]{12}$/)
  await page.getByRole('link', { name: 'Buka halaman pantau' }).click()
  const list = page.getByRole('list', { name: 'Daftar setoran' })
  await expect(list).toContainText('Golden Ticket')
  await expect(list).toContainText('Menunggu')
  await expect(page.getByText(/Langsung dari spreadsheet/)).toBeVisible()
  await shot(page, '05-pantau')
  // Logged in: the form now knows who you are.
  await expect(page.getByRole('link', { name: '+ Setor konten lagi' })).toBeVisible()
  await page.getByRole('link', { name: '+ Setor konten lagi' }).click()
  await expect(page.getByText('Masuk sebagai Rina Uji')).toBeVisible()
  await expect(page.getByLabel('Nomor WhatsApp')).toHaveCount(0)
})

test('duplikat ditolak walau parameter berbeda', async ({ page }) => {
  await fillForm(page, { name: 'Budi', url: vid(1).replace('is_from_webapp=1', 'utm_source=wa') })
  await page.getByRole('button', { name: 'Kirim setoran' }).click()
  await expect(page.getByRole('heading', { name: /setoran terkirim/ })).toHaveCount(0)
  await expect(page.getByText(/Link ini sudah pernah disetor pada/)).toBeVisible()
})

test('link bukan TikTok/Reels merah, tidak ada kolom link Sharein', async ({ page }) => {
  await fillForm(page, { name: 'Sari', url: 'https://youtube.com/shorts/abc' })
  await expect(page.getByText('Link harus dari tiktok.com atau instagram.com/reel/. Tempel link dari tombol Bagikan.')).toBeVisible()
  await expect(page.getByLabel('Link konten')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('button', { name: 'Kirim setoran' })).toBeDisabled()
  await expect(page.getByText('Ada link yang merah.')).toBeVisible()
  await expect(page.getByLabel(/Link Sharein/)).toHaveCount(0)
  await expect(page.getByText(/Sharein\?/)).toHaveCount(0)
})

test('reels: platform terdeteksi otomatis, syarat Reels 3.000 komentar tampil', async ({ page }) => {
  await fillForm(page, { name: 'Dewi', url: 'https://www.instagram.com/reel/C9zYxW8vUtS/?igsh=abc' })
  await expect(page.getByText('Link valid · Instagram Reels')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kirim setoran' })).toBeEnabled()
})

test('sudah pernah setor: tempel link pantau di /setor, tidak perlu isi nama & WA lagi', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/goldenticket/setor')
  await page.getByLabel('Sudah pernah setor? Tempel link pantaumu').fill('https://contoh.app/pantau/ZZZZ-ZZZZ-ZZZZ')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.getByText('Link pantau tidak dikenali.', { exact: false })).toBeVisible()
  await page.getByLabel('Sudah pernah setor? Tempel link pantaumu').fill(`http://localhost:3123/pantau/${rinaToken}`)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.getByText('Masuk sebagai Rina Uji')).toBeVisible()
  await expect(page.getByLabel('Nama penyetor')).toHaveCount(0)
  await page.getByLabel('Link konten').fill(vid(88))
  await page.getByLabel(/muncul organik/).check()
  await page.getByLabel(/sudah membuka link/).check()
  await shot(page, '04b-setor-pakai-link-pantau')
  await page.getByRole('button', { name: 'Kirim setoran' }).click()
  await expect(page.getByRole('heading', { name: 'Setoran terkirim' })).toBeVisible()
  await page.goto(`/pantau/${rinaToken}`)
  await expect(page.getByRole('list', { name: 'Daftar setoran' }).getByRole('listitem').filter({ hasText: 'Golden Ticket' })).toHaveCount(2)
  await ctx.close()
})

test('lupa centang pernyataan: pesan jelas, tidak terkirim', async ({ page }) => {
  await page.goto('/goldenticket/setor')
  await page.getByLabel('Nama penyetor').fill('Lupa Centang')
  await page.getByLabel('Nomor WhatsApp').fill('081233334444')
  await page.getByLabel('Link konten').fill(vid(77))
  await page.getByRole('button', { name: 'Kirim setoran' }).click()
  await expect(page.getByText('Centang kedua pernyataan di bagian Pernyataan dulu.')).toBeVisible()
  await expect(page.getByRole('heading', { name: /setoran terkirim/ })).toHaveCount(0)
})

test('admin: login; link terkumpul tampil publik tanpa nomor WA, bisa diputar di halaman', async ({ page }) => {
  await login(page)
  await shot(page, '06-admin-dasbor')
  await expect
    .poll(async () => {
      await page.goto('/goldenticket')
      return page.locator('section', { hasText: 'Link terkumpul' }).textContent()
    }, { timeout: 15_000 })
    .toContain('Rina U.')
  const feed = page.locator('section', { hasText: 'Link terkumpul' })
  await expect(feed).not.toContainText('Rina Uji')
  await expect(feed).not.toContainText('6281')
  // Card must stay inside the panel on phones even with a long link.
  const panelBox = (await feed.boundingBox())!
  const cardBox = (await feed.getByRole('listitem').first().boundingBox())!
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width)
  await shot(page, '06b-link-terkumpul')
  await feed.getByRole('button', { name: 'Putar di sini' }).first().click()
  await expect(feed.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.tiktok\.com\/embed\/v2\//)
})

test('dua penyetor bersamaan: link beda masuk semua, tanpa batas target', async ({ request }) => {
  const body = (n: number, name: string) => ({
    submitter_name: name, whatsapp: waFor(name), platform: 'tiktok', source_url: vid(n), sharein_url: 'https://sharein.id/c/x' + n,
    likes: 200000, comments: 8000, organic_declared: true, checked_declared: true,
  })
  const res = await Promise.all(Array.from({ length: 6 }, (_, i) => request.post('/api/submissions', { data: body(10 + i, `Paralel ${String.fromCharCode(65 + i)}`) })))
  expect(res.map((r) => r.status())).toEqual([201, 201, 201, 201, 201, 201])
})

test('admin: tolak wajib alasan, setujui, ekspor CSV; halaman pantau ikut berubah live', async ({ page, browser }) => {
  const userCtx = await browser.newContext()
  const userPage = await userCtx.newPage()
  await userPage.goto(`/pantau/${rinaToken}`)
  await expect(userPage.getByRole('list', { name: 'Daftar setoran' })).toContainText('Menunggu')
  await login(page)
  await page.goto('/admin/setoran?status=pending')
  const card = page.locator('li', { hasText: 'Rina Uji' }).first()
  // Live preview panel: official TikTok embed + ShareIn tab, decisions next to it.
  await card.getByRole('button', { name: 'Pratinjau & review' }).click()
  const panel = page.getByRole('dialog', { name: /Rina Uji/ })
  await expect(panel.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.tiktok\.com\/embed\/v2\/74000000000000/)
  // No ShareIn link was given, so there is no ShareIn tab and numbers say "cek di pratinjau".
  await expect(panel.getByRole('tab', { name: 'Link Sharein' })).toHaveCount(0)
  await expect(panel.getByText('Tidak diisi, cek di pratinjau').first()).toBeVisible()
  await shot(page, '08a-admin-pratinjau')
  await panel.getByRole('button', { name: 'Tolak' }).click()
  const dialog = page.getByRole('dialog', { name: /Tolak setoran/ })
  await expect(dialog.getByRole('button', { name: 'Tolak setoran' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Bukan dari FYP' }).click()
  await shot(page, '08-admin-tolak')
  await dialog.getByRole('button', { name: 'Tolak setoran' }).click()
  await expect(page.getByRole('status').getByText('Ditolak', { exact: true })).toBeVisible()
  await expect(panel.getByText('Bukan dari FYP')).toBeVisible()
  await panel.getByRole('button', { name: 'Tutup' }).click()
  // The participant's open tracking page updates by itself (polls every 15 s), no reload.
  await expect(userPage.getByText('Alasan ditolak: Bukan dari FYP')).toBeVisible({ timeout: 25_000 })
  await expect(userPage.getByText('Baru diperbarui')).toBeVisible()
  await shot(userPage, '09b-pantau-live')
  await userCtx.close()
  await expect(page.locator('li', { hasText: 'Rina Uji' })).toHaveCount(1) // the other Rina submission still waits

  await page.locator('li', { hasText: 'Paralel' }).first().getByRole('button', { name: 'Setujui' }).click()
  await expect(page.getByRole('status').getByText('Disetujui', { exact: true })).toBeVisible()

  await page.getByLabel('Status').selectOption('all')
  await shot(page, '09-admin-setoran')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Ekspor CSV' }).click()])
  const csv = await (await dl.createReadStream()).toArray()
  const text = Buffer.concat(csv).toString('utf8')
  expect(text).toContain('id,created_at,period_id,submitter_name')
  expect(text).toContain('Rina Uji')

  await page.goto(`/pantau/${rinaToken}`)
  await expect(page.getByText('Alasan ditolak: Bukan dari FYP')).toBeVisible()
  await expect(page.getByText('Ditolak', { exact: true }).first()).toBeVisible()
})

test('periode ditutup: form menampilkan pesan dan tombol nonaktif', async ({ page }) => {
  await login(page)
  await page.goto('/admin/pengaturan')
  await page.getByRole('switch', { name: 'Setoran dibuka' }).click()
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.getByText('Tersimpan')).toBeVisible()
  await page.goto('/goldenticket/setor')
  await expect(page.getByText('Setoran Golden Ticket sedang ditutup. Pantau halamannya untuk info berikutnya.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kirim setoran' })).toBeDisabled()
  await shot(page, '10-setor-ditutup')
})

test('API admin menolak tanpa sesi; halaman admin dialihkan ke login', async ({ request, page }) => {
  expect((await request.get('/api/admin/submissions')).status()).toBe(401)
  expect((await request.put('/api/admin/settings', { data: {} })).status()).toBe(401)
  await page.goto('/admin/pengaturan')
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpengaturan/)
})

test('semua target sentuh di form setoran ≥ 44px', async ({ page }) => {
  await page.goto('/goldenticket/setor')
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main button, main a, main input[type=checkbox]'))
      .map((el) => {
        const target = el.closest('label') ?? el
        const r = target.getBoundingClientRect()
        return { t: (el.textContent || el.id || '').trim().slice(0, 30), h: r.height }
      })
      .filter((x) => x.h > 0 && x.h < 38),
  )
  expect(small).toEqual([])
})
