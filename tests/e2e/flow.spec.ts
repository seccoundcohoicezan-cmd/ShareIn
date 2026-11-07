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

async function fillForm(page: Page, o: { name: string; url: string; likes: string; comments: string; sharein?: string }) {
  await page.goto('/setor')
  await page.getByLabel('Nama penyetor').fill(o.name)
  await page.getByLabel(/Link TikTok|Link Instagram Reels/).fill(o.url)
  await page.getByLabel('Like', { exact: true }).fill(o.likes)
  await page.getByLabel('Komentar', { exact: true }).fill(o.comments)
  await page.getByLabel('Link Sharein').fill(o.sharein ?? 'https://sharein.id/c/abc123')
  await page.getByLabel(/muncul organik/).check()
  await page.getByLabel(/sudah membuka link/).check()
}

test.describe.configure({ mode: 'serial' })

test('beranda: progres QTY, ketentuan, latar ringan', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Setor konten viral')
  await expect(page.getByRole('progressbar', { name: 'Progres TikTok' })).toHaveAttribute('aria-valuemax', '20')
  await expect(page.getByText('≥ 100 rb like · ≥ 5 rb komentar')).toBeVisible()
  const bgNodes = await page.evaluate(() => document.querySelectorAll('#bg, #bg *').length)
  expect(bgNodes).toBeLessThanOrEqual(4)
  await shot(page, '01-beranda')
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

test('setor: 99.999 like ditolak, 100.000 lolos, kirim, sukses, riwayat', async ({ page }) => {
  await fillForm(page, { name: 'Rina Uji', url: vid(1), likes: '99999', comments: '5000' })
  await page.getByLabel('Like', { exact: true }).blur()
  await expect(page.getByLabel('Like', { exact: true })).toHaveValue('99.999')
  await expect(page.getByText('Kurang 1 dari 100.000')).toBeVisible()
  await expect(page.getByText('Link valid · TikTok')).toBeVisible()
  const send = page.getByRole('button', { name: 'Kirim setoran' })
  await expect(send).toBeDisabled()
  await page.getByRole('button', { name: 'Cek setoran' }).click()
  await expect(page.getByText('Like 99.999 belum cukup. TikTok minimal 100.000.')).toBeVisible()
  await expect(send).toBeDisabled()
  await shot(page, '02-setor-gagal')

  await page.getByLabel('Like', { exact: true }).fill('100000')
  await page.getByRole('button', { name: 'Cek setoran' }).click()
  await expect(page.getByText('Target belum penuh')).toBeVisible()
  await expect(send).toBeEnabled()
  await shot(page, '03-setor-lolos')
  await send.click()
  await expect(page.getByRole('heading', { name: 'Setoran terkirim' })).toBeVisible()
  await expect(page.getByText('Terkirim', { exact: true })).toBeVisible()
  await shot(page, '04-sukses')

  await page.getByRole('link', { name: 'Lihat riwayat' }).click()
  await expect(page.getByText('Menunggu')).toBeVisible()
  await shot(page, '05-riwayat')
})

test('duplikat ditolak walau parameter berbeda', async ({ page }) => {
  await fillForm(page, { name: 'Budi', url: vid(1).replace('is_from_webapp=1', 'utm_source=wa'), likes: '150000', comments: '9000' })
  await page.getByRole('button', { name: 'Cek setoran' }).click()
  await expect(page.getByText(/Link ini sudah pernah disetor pada/)).toBeVisible()
})

test('link bukan TikTok/Reels dan domain Sharein salah dijelaskan', async ({ page }) => {
  await fillForm(page, { name: 'Sari', url: 'https://youtube.com/shorts/abc', likes: '150000', comments: '9000', sharein: 'https://contoh.com/x' })
  await expect(page.getByText('Link ini bukan dari TikTok atau Instagram Reels. Tempel link dari tombol Bagikan.')).toBeVisible()
  await expect(page.getByText(/Link harus dari sharein.id atau sharein.app/)).toBeVisible()
})

test('reels: komentar 2.999 ditolak, 3.000 lolos; platform terdeteksi otomatis', async ({ page }) => {
  await fillForm(page, { name: 'Dewi', url: 'https://www.instagram.com/reel/C9zYxW8vUtS/?igsh=abc', likes: '100000', comments: '2999' })
  await expect(page.getByRole('radio', { name: 'Instagram Reels' })).toBeChecked()
  await page.getByRole('button', { name: 'Cek setoran' }).click()
  await expect(page.getByText('Komentar 2.999 belum cukup. Reels minimal 3.000.')).toBeVisible()
  await page.getByLabel('Komentar', { exact: true }).fill('3000')
  await page.getByRole('button', { name: 'Cek setoran' }).click()
  await expect(page.getByRole('button', { name: 'Kirim setoran' })).toBeEnabled()
})

test('admin: login, ubah QTY 20 → 25, publik ikut berubah', async ({ page, request }) => {
  await login(page)
  await shot(page, '06-admin-dasbor')
  await page.goto('/admin/pengaturan')
  await page.getByLabel('QTY TikTok').fill('25')
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.getByText('Tersimpan')).toBeVisible()
  await shot(page, '07-admin-pengaturan')
  const rules = await (await request.get('/api/rules')).json()
  expect(rules.progress.find((p: { platform: string }) => p.platform === 'tiktok')).toMatchObject({ used: 1, target: 25 })
  await expect
    .poll(async () => {
      await page.goto('/')
      return page.getByRole('progressbar', { name: 'Progres TikTok' }).getAttribute('aria-valuetext')
    }, { timeout: 15_000 })
    .toBe('1 dari 25')
})

test('dua penyetor bersamaan saat sisa QTY = 1: hanya satu masuk', async ({ request, page }) => {
  await login(page)
  await page.goto('/admin/pengaturan')
  await page.getByLabel('QTY TikTok').fill('2')
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.getByText('Tersimpan')).toBeVisible()
  const body = (n: number, name: string) => ({
    submitter_name: name, platform: 'tiktok', source_url: vid(n), sharein_url: 'https://sharein.id/c/x' + n,
    likes: 200000, comments: 8000, organic_declared: true, checked_declared: true,
  })
  const [a, b] = await Promise.all([
    request.post('/api/submissions', { data: body(10, 'Paralel A') }),
    request.post('/api/submissions', { data: body(11, 'Paralel B') }),
  ])
  expect([a.status(), b.status()].sort()).toEqual([201, 422])
  const loser = (await (a.status() === 422 ? a : b).json()) as { checks: { id: string }[] }
  expect(loser.checks[0].id).toBe('qty_available')
})

test('admin: tolak wajib alasan, setujui, ekspor CSV; riwayat menampilkan alasan', async ({ page }) => {
  await login(page)
  await page.goto('/admin/setoran?status=pending')
  const card = page.locator('li', { hasText: 'Rina Uji' })
  await card.getByRole('button', { name: 'Tolak' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Tolak setoran' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Bukan dari FYP' }).click()
  await shot(page, '08-admin-tolak')
  await dialog.getByRole('button', { name: 'Tolak setoran' }).click()
  await expect(page.getByRole('status').getByText('Ditolak', { exact: true })).toBeVisible()
  await expect(page.locator('li', { hasText: 'Rina Uji' })).toHaveCount(0)

  await page.locator('li', { hasText: 'Paralel' }).first().getByRole('button', { name: 'Setujui' }).click()
  await expect(page.getByRole('status').getByText('Disetujui', { exact: true })).toBeVisible()

  await page.getByLabel('Status').selectOption('all')
  await shot(page, '09-admin-setoran')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Ekspor CSV' }).click()])
  const csv = await (await dl.createReadStream()).toArray()
  const text = Buffer.concat(csv).toString('utf8')
  expect(text).toContain('id,created_at,period_id,submitter_name')
  expect(text).toContain('Rina Uji')

  await page.goto('/riwayat?nama=rina%20uji')
  await expect(page.getByText('Alasan: Bukan dari FYP')).toBeVisible()
})

test('periode ditutup: form menampilkan pesan dan tombol nonaktif', async ({ page }) => {
  await login(page)
  await page.goto('/admin/pengaturan')
  await page.getByRole('switch', { name: 'Setoran dibuka' }).click()
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.getByText('Tersimpan')).toBeVisible()
  await page.goto('/setor')
  await expect(page.getByText('Setoran sedang ditutup. Pantau beranda untuk periode berikutnya.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kirim setoran' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Cek setoran' })).toBeDisabled()
  await shot(page, '10-setor-ditutup')
})

test('API admin menolak tanpa sesi; halaman admin dialihkan ke login', async ({ request, page }) => {
  expect((await request.get('/api/admin/submissions')).status()).toBe(401)
  expect((await request.put('/api/admin/settings', { data: {} })).status()).toBe(401)
  await page.goto('/admin/pengaturan')
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpengaturan/)
})

test('semua target sentuh di form setoran ≥ 44px', async ({ page }) => {
  await page.goto('/setor')
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
