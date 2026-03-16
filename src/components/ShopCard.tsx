import type { Shop } from '../types/shop'

interface ShopCardProps {
  shop: Shop
  isHighlighted: boolean
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onClick: (shop: Shop) => void
  onMouseEnter: (shop: Shop) => void
  onMouseLeave: () => void
}

export function ShopCard({
  shop,
  isHighlighted,
  isFavorite,
  onToggleFavorite,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ShopCardProps) {
  return (
    <div
      className={`bg-white border rounded-xl p-3 cursor-pointer transition-all ${
        isHighlighted
          ? 'border-[#FF9500] shadow-md'
          : 'border-[#F0F0F0] hover:border-[#ddd] shadow-sm'
      }`}
      onClick={() => onClick(shop)}
      onMouseEnter={() => onMouseEnter(shop)}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#1a1a1a] truncate">{shop.name}</h3>
          <p className="text-xs text-[#999] mt-1 truncate">{shop.address}</p>
        </div>
        <button
          onClick={e => {
            e.stopPropagation()
            onToggleFavorite(shop.id)
          }}
          className={`text-base flex-shrink-0 ml-2 transition-colors ${
            isFavorite ? 'text-[#FF9500]' : 'text-[#ddd] hover:text-[#FF9500]'
          }`}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
      </div>
      {shop.tags.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {shop.tags.map(tag => (
            <span
              key={tag}
              className="bg-[#FFF3E0] text-[#FF9500] px-1.5 py-0.5 rounded text-[10px]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
