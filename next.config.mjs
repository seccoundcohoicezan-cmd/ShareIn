/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['@googleapis/sheets', '@googleapis/drive', 'bcryptjs'],
  },
  async redirects() {
    return [
      { source: '/setor', destination: '/goldenticket/setor', permanent: true },
      { source: '/riwayat', destination: '/goldenticket/riwayat', permanent: true },
      { source: '/golden-ticket', destination: '/goldenticket', permanent: true },
      { source: '/pelatihan-content-creator', destination: '/pelatihancontent', permanent: true },
      { source: '/pelatihan', destination: '/pelatihancontent', permanent: true },
      { source: '/duta', destination: '/dutateladan', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}
export default nextConfig
