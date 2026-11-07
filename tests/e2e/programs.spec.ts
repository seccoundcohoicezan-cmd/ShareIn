import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.E2E_SHOTS || 'test-results/shots'
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })

async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('owner@sharein.test')
  await page.getByLabel('Sandi').fill('rahasia-e2e-123')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('heading', { name: 'Dasbor' })).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test('landing: menu hanya Tutorial & Aturan, tutorial interaktif, kartu program', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
  await expect(nav.getByRole('link')).toHaveText(['Tutorial', 'Aturan'])
  await page.getByRole('button', { name: 'Pilih video' }).click()
  await expect(page.getByText('Upload selesai')).toBeVisible()
  await page.getByRole('button', { name: 'Lanjut' }).click()
  await page.getByRole('button', { name: 'Salin link' }).click()
  await page.getByRole('button', { name: 'Lanjut' }).click()
  await page.getByRole('button', { name: /penonton/ }).click()
  await expect(page.getByText('Reward terbuka!')).toBeVisible()
  await shot(page, '11-landing')
  await page.getByRole('button', { name: 'Selesai' }).click()
  await expect(page.getByText('Tutorial selesai.')).toBeVisible()
  for (const [name, path] of [[/Golden Ticket/, '/goldenticket'], [/Pelatihan Content/, '/pelatihancontent'], [/Duta Teladan/, '/dutateladan']] as const) {
    await expect(page.locator(`a[href="${path}"]`).filter({ hasText: name })).toBeVisible()
  }
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

test('pelatihan: admin buat tugas → peserta dapat kode → admin setujui → spin → pemenang tampil', async ({ page, browser }) => {
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
  const code = peserta.locator('p.font-mono')
  await expect(code).toHaveText(/^PC-[A-Z2-9]{6}$/)
  const theCode = (await code.textContent())!
  await shot(peserta, '13-pelatihan-kode')
  await expect(peserta.getByRole('list', { name: 'Daftar kode' })).toContainText(theCode)
  await expect(peserta.getByRole('list', { name: 'Daftar kode' })).toContainText('Menunggu verifikasi')

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
  await expect(page.getByText('1 kode siap diundi')).toBeVisible()
  await page.getByLabel('Nominal hadiah').fill('150000')
  await page.getByRole('button', { name: 'Putar' }).click()
  await expect(page.getByText('Pemenang', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('p.font-mono')).toHaveText(theCode)
  await expect(page.locator('svg text', { hasText: theCode })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Hubungi via WhatsApp' })).toHaveAttribute('href', 'https://wa.me/6281234567890')
  await shot(page, '14-admin-spin')

  await expect
    .poll(async () => {
      await peserta.goto('/pelatihancontent')
      return peserta.locator('section', { hasText: 'Pemenang spin wheel' }).textContent()
    }, { timeout: 40_000, intervals: [2000] })
    .toContain('Rina U.')
  const winners = peserta.locator('section', { hasText: 'Pemenang spin wheel' })
  await expect(winners).toContainText('Rp150.000')
  await expect(winners).not.toContainText('Utami')
  await expect(peserta.getByRole('list', { name: 'Daftar kode' })).toContainText('Menang!')
  await shot(peserta, '15-pelatihan-pemenang')
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
  await expect(duta.locator('p.font-mono')).toHaveText(/^DT-/)
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
