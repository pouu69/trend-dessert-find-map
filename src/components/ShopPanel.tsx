import { useEffect, useRef } from 'react'
import { Heart, MapPin, MagnifyingGlass } from '@phosphor-icons/react'
import type { Shop } from '../types/shop'

interface ShopPanelProps {
  shops: Shop[]
  highlightedShopId: string | null
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
  onShopClick: (shop: Shop) => void
  onShopHover: (shop: Shop) => void
  onShopLeave: () => void
}

export function ShopPanel({
  shops, highlightedShopId, isFavorite, onToggleFavorite,
  onShopClick, onShopHover, onShopLeave,
}: ShopPanelProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (highlightedShopId) {
      const el = cardRefs.current.get(highlightedShopId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [highlightedShopId])

  if (shops.length === 0) {
    return (
      <div className="absolute top-[108px] left-3 bottom-3 w-[280px] z-[999] pointer-events-auto">
        <div className="h-full glass rounded-2xl flex flex-col items-center justify-center px-6">
          <MagnifyingGlass size={28} weight="duotone" className="text-ink-caption mb-3" />
          <p className="text-[13px] text-ink-secondary font-medium text-center">검색 결과가 없습니다</p>
          <p className="text-[11px] text-ink-caption mt-1 text-center">다른 키워드로 검색하거나 지도를 이동해 보세요</p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-[108px] left-3 bottom-3 w-[280px] z-[999] pointer-events-auto anim-panel">
      <div className="h-full glass rounded-2xl overflow-hidden flex flex-col">
        <div className="px-3.5 py-2 border-b border-line flex-shrink-0">
          <span className="text-[11px] font-semibold text-ink-caption">{shops.length}개 가게</span>
        </div>

        <div className="flex-1 overflow-y-auto py-0.5">
          {shops.map((shop, index) => {
            const active = highlightedShopId === shop.id
            return (
              <div
                key={shop.id}
                ref={el => { if (el) cardRefs.current.set(shop.id, el); else cardRefs.current.delete(shop.id) }}
                className={`
                  anim-card mx-1.5 my-0.5 px-3 py-2 rounded-xl
                  cursor-pointer select-none transition-all duration-200
                  active:scale-[0.99]
                  ${active
                    ? 'bg-brand-soft shadow-[inset_3px_0_0_var(--color-brand)]'
                    : 'hover:bg-panel-hover'
                  }
                `}
                style={{ animationDelay: `${index * 18}ms` }}
                onClick={() => onShopClick(shop)}
                onMouseEnter={() => onShopHover(shop)}
                onMouseLeave={onShopLeave}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] font-bold text-ink leading-snug truncate">{shop.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={10} weight="bold" className="text-ink-caption flex-shrink-0" />
                      <p className="text-[11px] text-ink-caption truncate">{shop.address.split(' ').slice(0, 3).join(' ')}</p>
                    </div>
                    {(shop.tags.length > 0 || shop.priceRange) && (
                      <div className="flex items-center gap-1 mt-1.5">
                        {shop.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] font-medium text-tag-text bg-tag-bg px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                        {shop.priceRange && (
                          <span className="text-[10px] font-bold text-brand bg-brand-soft px-1.5 py-0.5 rounded">{shop.priceRange}원</span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onToggleFavorite(shop.id) }}
                    className={`flex-shrink-0 mt-0.5 active:scale-[0.85] transition-all ${isFavorite(shop.id) ? 'text-danger' : 'text-line-bold hover:text-ink-caption'}`}
                  >
                    <Heart size={13} weight={isFavorite(shop.id) ? 'fill' : 'regular'} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
