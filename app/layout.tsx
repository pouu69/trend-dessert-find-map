import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import 'leaflet/dist/leaflet.css'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://trend-dessert.com'),
  title: '요즘 뭐가 맛있어? — 트렌드 간식 맛집 지도',
  description: '전국 트렌드 디저트 & 간식 맛집을 지도에서 한눈에 찾아보세요.',
  keywords: ['트렌드디저트', '간식맛집', '맛집지도', '디저트맛집', '간식맵'],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: '요즘 뭐가 맛있어? — 트렌드 간식 맛집 지도',
    description: '전국 트렌드 디저트 & 간식 맛집을 지도에서 한눈에 찾아보세요.',
    type: 'website',
    locale: 'ko_KR',
    url: 'https://trend-dessert.com',
    siteName: '요즘 뭐가 맛있어?',
  },
  twitter: {
    card: 'summary',
    title: '요즘 뭐가 맛있어? — 트렌드 간식 맛집 지도',
    description: '전국 트렌드 디저트 & 간식 맛집을 지도에서 한눈에 찾아보세요.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={outfit.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body>{children}</body>
    </html>
  )
}
