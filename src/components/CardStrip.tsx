import { useEffect, useRef } from 'react'
import { Heart, MapPin } from '@phosphor-icons/react'
import type { Shop } from '../types/shop'

interface CardStripProps {
  shops: Shop[]
  highlightedShopId: string | null
  selectedShopId: string | null
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
  onShopClick: (shop: Shop) => void
  onShopHover: (shop: Shop) => void
  onShopLeave: () => void
}

export function CardStrip({
  shops,
  highlightedShopId,
  selectedShopId,
  isFavorite,
  onToggleFavorite,
  onShopClick,
  onShopHover,
  onShopLeave,
}: CardStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (highlightedShopId) {
      const el = cardRefs.current.get(highlightedShopId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [highlightedShopId])

  if (shops.length === 0) {
    return (
      <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-auto">
        <div className="bg-[#1C1917]/90 backdrop-blur-xl rounded-2xl border border-white/[0.06] px-6 py-4 text-center">
          <p className="text-[13px] text-[#A8A29E] font-medium">검색 결과가 없습니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute bottom-3 left-3 right-3 z-[999] pointer-events-none">
      <div
        ref={scrollRef}
        className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory"
      >
        {shops.map((shop, index) => {
          const isActive = highlightedShopId === shop.id || selectedShopId === shop.id
          return (
            <div
              key={shop.id}
              ref={el => { if (el) cardRefs.current.set(shop.id, el); else cardRefs.current.delete(shop.id) }}
              className={`
                anim-card snap-start flex-shrink-0
                w-[220px] p-3.5
                bg-[#1C1917]/90 backdrop-blur-xl
                rounded-xl border
                cursor-pointer select-none
                transition-all duration-200
                active:scale-[0.98]
                ${isActive
                  ? 'border-brand/40 bg-[#1C1917]/95 shadow-[0_0_20px_rgba(232,97,42,0.15)]'
                  : 'border-white/[0.06] hover:border-white/[0.12]'
                }
              `}
              style={{ animationDelay: `${index * 20}ms` }}
              onClick={() => onShopClick(shop)}
              onMouseEnter={() => onShopHover(shop)}
              onMouseLeave={onShopLeave}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[13px] font-bold text-[#F5F0EB] leading-snug truncate flex-1">
                  {shop.name}
                </h3>
                <button
                  onClick={e => { e.stopPropagation(); onToggleFavorite(shop.id) }}
                  className={`flex-shrink-0 transition-colors active:scale-[0.9] ${isFavorite(shop.id) ? 'text-danger' : 'text-[#57534E] hover:text-[#78716C]'}`}
                >
                  <Heart size={13} weight={isFavorite(shop.id) ? 'fill' : 'regular'} />
                </button>
              </div>

              <div className="flex items-center gap-1 mt-1.5">
                <MapPin size={11} weight="bold" className="text-[#57534E] flex-shrink-0" />
                <p className="text-[11px] text-[#78716C] truncate">{shop.address.split(' ').slice(0, 3).join(' ')}</p>
              </div>

              {(shop.tags.length > 0 || shop.priceRange) && (
                <div className="flex items-center gap-1.5 mt-2">
                  {shop.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[10px] font-medium text-[#78716C] bg-white/[0.06] px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                  {shop.priceRange && (
                    <span className="text-[10px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                      {shop.priceRange}원
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
