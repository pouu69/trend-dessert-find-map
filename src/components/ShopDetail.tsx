import type { Shop } from '../types/shop'

interface ShopDetailProps {
  shop: Shop
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onBack: () => void
}

export function ShopDetail({ shop, isFavorite, onToggleFavorite, onBack }: ShopDetailProps) {
  return (
    <div className="p-4 space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-[#999] hover:text-[#1a1a1a] transition-colors"
      >
        ← 목록으로
      </button>

      <div className="flex justify-between items-start">
        <h2 className="text-lg font-bold text-[#1a1a1a]">{shop.name}</h2>
        <button
          onClick={() => onToggleFavorite(shop.id)}
          className={`text-xl transition-colors ${
            isFavorite ? 'text-[#FF9500]' : 'text-[#ddd] hover:text-[#FF9500]'
          }`}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
      </div>

      {shop.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {shop.tags.map(tag => (
            <span
              key={tag}
              className="bg-[#FFF3E0] text-[#FF9500] px-2 py-0.5 rounded text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3 text-sm">
        <div>
          <span className="text-[#999]">주소</span>
          <p className="text-[#1a1a1a] mt-0.5">{shop.address}</p>
        </div>

        {shop.phone && (
          <div>
            <span className="text-[#999]">전화</span>
            <p className="text-[#1a1a1a] mt-0.5">
              <a href={`tel:${shop.phone}`} className="text-[#FF9500] hover:underline">
                {shop.phone}
              </a>
            </p>
          </div>
        )}

        {shop.hours && (
          <div>
            <span className="text-[#999]">영업시간</span>
            <p className="text-[#1a1a1a] mt-0.5">{shop.hours}</p>
          </div>
        )}

        {shop.closedDays.length > 0 && (
          <div>
            <span className="text-[#999]">휴무일</span>
            <p className="text-[#1a1a1a] mt-0.5">{shop.closedDays.join(', ')}</p>
          </div>
        )}

        {shop.priceRange && (
          <div>
            <span className="text-[#999]">가격대</span>
            <p className="text-[#1a1a1a] mt-0.5">₩{shop.priceRange}</p>
          </div>
        )}

        {shop.description && (
          <div>
            <span className="text-[#999]">설명</span>
            <p className="text-[#1a1a1a] mt-0.5 leading-relaxed">{shop.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
