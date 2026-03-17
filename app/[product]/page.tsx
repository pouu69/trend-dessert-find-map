import type { Metadata } from 'next'
import { getShopsByProduct } from '@/lib/data'
import { getProductBySlug, products } from '@/data/products'
import { notFound } from 'next/navigation'
import { MapView } from '@/components/MapView'

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

  return {
    title: `${productData.name} 맛집 지도 — 요즘 뭐가 맛있어?`,
    description: `전국 ${productData.name} 판매처를 지도에서 한눈에 찾아보세요.`,
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

  return <MapView product={productData} initialShops={shops} />
}
