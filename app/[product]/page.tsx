import type { Metadata } from 'next'
import { getShopsByProduct } from '@/lib/data'
import { getProductBySlug, products } from '@/data/products'
import { notFound } from 'next/navigation'
import { MapView } from '@/components/MapView'
import { ShopDirectory } from '@/components/ShopDirectory'

export function generateStaticParams() {
  return products.map(p => ({ product: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ product: string }>
}): Promise<Metadata> {
  const { product } = await params
  const productData = getProductBySlug(product)
  if (!productData) return {}

  const shops = getShopsByProduct(product)
  const title = `${productData.name} 파는곳 지도 — 요즘 뭐가 맛있어?`
  const description = `전국 ${productData.name} 파는곳 ${shops.length}곳을 지도에서 한눈에 찾아보세요. 내 주변 ${productData.name} 맛집을 검색하세요.`

  return {
    title,
    description,
    keywords: productData.keywords,
    alternates: {
      canonical: `/${product}`,
    },
    openGraph: {
      title,
      description,
      url: `/${product}`,
      images: [
        {
          url: `/og-${product}.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/og-${product}.png`],
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ product: string }>
}) {
  const { product } = await params
  const productData = getProductBySlug(product)
  if (!productData) notFound()

  const shops = getShopsByProduct(product)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${productData.name} 맛집 목록`,
    numberOfItems: shops.length,
    itemListElement: shops.slice(0, 50).map((shop, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: shop.name,
        address: shop.address,
        ...(shop.phone && { telephone: shop.phone }),
      },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <MapView product={productData} initialShops={shops} />
      <ShopDirectory shops={shops} productName={productData.name} />
    </>
  )
}
