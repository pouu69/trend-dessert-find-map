'use client'

import { Heart } from '@phosphor-icons/react'
import type { Shop } from '@/types/shop'

function shortenAddress(address: string): string {
  const cleaned = address
    .replace(/특별시|광역시|특별자치시|특별자치도/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const parts = cleaned.split(' ')
  if (parts.length >= 2) return parts.slice(0, 2).join(' ')
  return parts[0] || address
}

interface ShopCardProps {
  shop: Shop
  isHighlighted: boolean
  isFavorite: boolean
  index: number
  onToggleFavorite: (id: string) => void
  onClick: (shop: Shop) => void
  onMouseEnter: (shop: Shop) => void
  onMouseLeave: () => void
}

export function ShopCard({
  shop,
  isHighlighted,
  isFavorite,
  index,
  onToggleFavorite,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ShopCardProps) {
  return (
    <div
      className={`
        anim-card
        flex items-start gap-3
        mx-2 my-0.5 px-3 py-2.5
        rounded-xl
        cursor-pointer select-none
        transition-all duration-200
        active:scale-[0.99]
        ${isHighlighted
          ? 'bg-white/[0.06] shadow-[inset_3px_0_0_var(--color-brand)]'
          : 'hover:bg-white/[0.04]'
        }
      `}
      style={{ animationDelay: `${index * 25}ms` }}
      onClick={() => onClick(shop)}
      onMouseEnter={() => onMouseEnter(shop)}
      onMouseLeave={onMouseLeave}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-bold text-ink leading-snug truncate">
          {shop.name}
        </h3>

        <p className="text-[12px] text-ink-caption mt-1 leading-normal">
          {shortenAddress(shop.address)}
        </p>

        {(shop.tags.length > 0 || shop.priceRange) && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {shop.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="text-[11px] font-medium text-tag-text bg-tag-bg px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
            {shop.priceRange && (
              <span className="text-[11px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded">
                {shop.priceRange}원
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={e => {
          e.stopPropagation()
          onToggleFavorite(shop.id)
        }}
        className={`
          flex-shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center
          rounded-full transition-all duration-150
          active:scale-[0.9]
          ${isFavorite
            ? 'text-danger'
            : 'text-[#57534E] hover:text-ink-caption'
          }
        `}
      >
        <Heart size={15} weight={isFavorite ? 'fill' : 'regular'} />
      </button>
    </div>
  )
}
