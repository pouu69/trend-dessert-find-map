import { Landing } from '@/components/Landing'

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: '요즘 뭐가 맛있어?',
  url: 'https://trendeat.org',
  description: '전국 트렌드 디저트 & 간식 맛집을 지도에서 한눈에 찾아보세요.',
  inLanguage: 'ko',
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '요즘 뭐가 맛있어?',
  url: 'https://trendeat.org',
  logo: 'https://trendeat.org/favicon.svg',
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, '\\u003c') }}
      />
      <Landing />
    </>
  )
}
