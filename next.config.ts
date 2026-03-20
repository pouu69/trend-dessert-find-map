import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: false,
  allowedDevOrigins: ['192.168.124.111'],
}

export default nextConfig
