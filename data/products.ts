export interface Product {
  slug: string
  name: string
  iconName: 'butter' | 'cookie'
  keywords: string[]
}

export const products: Product[] = [
  {
    slug: 'butter-tteok',
    name: '버터떡',
    iconName: 'butter',
    keywords: ['버터떡', '상하이버터떡', '버터떡맵', '버터떡파는곳', '버터모찌'],
  },
  {
    slug: 'dujjonku',
    name: '두쫀쿠',
    iconName: 'cookie',
    keywords: ['두쫀쿠', '두쫀쿠맵', '두쫀쿠파는곳'],
  },
]

export const defaultProduct = products[0]

export function getProductBySlug(slug: string): Product | undefined {
  return products.find(p => p.slug === slug)
}
