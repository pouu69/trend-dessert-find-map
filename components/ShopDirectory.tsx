import type { Shop } from '@/types/shop'

interface ShopDirectoryProps {
  shops: Shop[]
  productName: string
}

export function ShopDirectory({ shops, productName }: ShopDirectoryProps) {
  const grouped = shops.reduce<Record<string, Shop[]>>((acc, shop) => {
    const region = shop.region || '기타'
    if (!acc[region]) acc[region] = []
    acc[region].push(shop)
    return acc
  }, {})

  const regions = Object.keys(grouped).sort()

  return (
    <section className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-ink mb-2">
        {productName} 맛집 목록
      </h1>
      <p className="text-sm text-ink-secondary mb-8">
        전국 {shops.length}개 매장 정보
      </p>

      {regions.map(region => (
        <div key={region} className="mb-8">
          <h2 className="text-lg font-bold text-ink mb-3 border-b border-line pb-2">
            {region}
          </h2>
          <div className="space-y-4">
            {grouped[region].map(shop => (
              <article key={shop.id} className="py-3">
                <h3 className="text-base font-bold text-ink">{shop.name}</h3>
                <address className="text-sm text-ink-secondary not-italic mt-1">
                  {shop.address}
                </address>
                {shop.description && (
                  <p className="text-sm text-ink-secondary mt-1">{shop.description}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-caption">
                  {shop.priceRange && <span>가격: {shop.priceRange}원</span>}
                  {shop.hours && <span>영업시간: {shop.hours}</span>}
                  {shop.closedDays.length > 0 && (
                    <span>휴무: {shop.closedDays.join(', ')}</span>
                  )}
                  {shop.phone && <span>전화: {shop.phone}</span>}
                </div>
                {shop.tags.length > 0 && (
                  <ul className="flex gap-1.5 mt-2">
                    {shop.tags.map(tag => (
                      <li key={tag} className="text-xs text-tag-text bg-tag-bg px-2 py-0.5 rounded">
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
