import { useState, useEffect } from 'react'
import { CaretLeft, Heart, Phone, NavigationArrow, ShareNetwork, Clock, CalendarX, CurrencyDollar, ArrowSquareOut, Check } from '@phosphor-icons/react'
import type { Shop } from '../types/shop'

interface ShopDetailProps {
  shop: Shop
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onBack: () => void
}

function kakaoMapUrl(name: string) {
  return `https://map.kakao.com/?q=${encodeURIComponent(name)}`
}

export function ShopDetail({ shop, isFavorite, onToggleFavorite, onBack }: ShopDetailProps) {
  const hasInfo = shop.phone || shop.hours || shop.closedDays.length > 0 || shop.priceRange
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <div className="anim-detail flex-1 overflow-y-auto">
      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] font-medium text-ink-secondary hover:text-ink transition-colors"
        >
          <CaretLeft size={16} weight="bold" />
          목록
        </button>

        <button
          onClick={() => onToggleFavorite(shop.id)}
          className={`
            flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg
            text-[13px] font-semibold transition-all duration-150
            active:scale-[0.96]
            ${isFavorite
              ? 'bg-danger text-[#F5F0EB] shadow-[0_2px_12px_rgba(239,68,68,0.3)]'
              : 'bg-bg-search text-ink-secondary hover:bg-white/[0.1]'
            }
          `}
        >
          <Heart size={14} weight={isFavorite ? 'fill' : 'regular'} />
          {isFavorite ? '저장됨' : '즐겨찾기'}
        </button>
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b border-line">
        <h2 className="text-[20px] font-extrabold text-ink leading-tight tracking-tight">
          {shop.name}
        </h2>

        <p className="text-[13px] text-ink-secondary mt-1.5 leading-relaxed">{shop.address}</p>

        {shop.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-3">
            {shop.tags.map(tag => (
              <span
                key={tag}
                className="bg-brand-soft text-brand font-bold px-2.5 py-1 rounded-lg text-[11px]"
              >
                {tag}
              </span>
            ))}
            <span className="bg-white/[0.06] text-ink-caption font-medium px-2.5 py-1 rounded-lg text-[11px]">
              {shop.region}
            </span>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 px-4 py-3 border-b border-line">
        {shop.phone && (
          <a
            href={`tel:${shop.phone}`}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-bg-section hover:bg-white/[0.08] active:scale-[0.97] transition-all duration-150"
          >
            <Phone size={18} weight="duotone" className="text-brand" />
            <span className="text-[11px] font-semibold text-ink-secondary">전화</span>
          </a>
        )}

        <a
          href={kakaoMapUrl(shop.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-bg-section hover:bg-white/[0.08] active:scale-[0.97] transition-all duration-150"
        >
          <NavigationArrow size={18} weight="duotone" className="text-brand" />
          <span className="text-[11px] font-semibold text-ink-secondary">길찾기</span>
        </a>

        <button
          onClick={() => {
            const url = window.location.origin + `?shop=${shop.id}`
            navigator.clipboard.writeText(url).then(() => setCopied(true))
          }}
          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-bg-section hover:bg-white/[0.08] active:scale-[0.97] transition-all duration-150"
        >
          {copied
            ? <Check size={18} weight="bold" className="text-emerald-400" />
            : <ShareNetwork size={18} weight="duotone" className="text-brand" />
          }
          <span className={`text-[11px] font-semibold ${copied ? 'text-emerald-400' : 'text-ink-secondary'} transition-colors`}>
            {copied ? '복사됨' : '공유'}
          </span>
        </button>
      </div>

      {/* Info */}
      {hasInfo && (
        <div className="px-4 py-3 border-b border-line space-y-2.5">
          <h3 className="text-[11px] font-bold text-ink-caption uppercase tracking-wider">기본 정보</h3>

          {shop.phone && (
            <InfoRow icon={<Phone size={14} weight="bold" className="text-ink-caption" />} label="전화">
              <a href={`tel:${shop.phone}`} className="text-link font-semibold hover:underline text-[13px]">
                {shop.phone}
              </a>
            </InfoRow>
          )}
          {shop.hours && (
            <InfoRow icon={<Clock size={14} weight="bold" className="text-ink-caption" />} label="영업시간">
              <span className="font-medium text-ink text-[13px]">{shop.hours}</span>
            </InfoRow>
          )}
          {shop.closedDays.length > 0 && (
            <InfoRow icon={<CalendarX size={14} weight="bold" className="text-ink-caption" />} label="휴무일">
              <span className="text-danger font-semibold text-[13px]">{shop.closedDays.join(', ')}</span>
            </InfoRow>
          )}
          {shop.priceRange && (
            <InfoRow icon={<CurrencyDollar size={14} weight="bold" className="text-ink-caption" />} label="가격대">
              <span className="text-brand font-bold text-[13px]">{shop.priceRange}원</span>
            </InfoRow>
          )}
        </div>
      )}

      {/* Description */}
      {shop.description && (
        <div className="px-4 py-3 border-b border-line">
          <h3 className="text-[11px] font-bold text-ink-caption uppercase tracking-wider mb-2">소개</h3>
          <p className="text-[13px] text-ink-secondary leading-[1.8]">
            {shop.description}
          </p>
        </div>
      )}

      {/* Kakao map link */}
      <div className="px-4 py-3">
        <a
          href={kakaoMapUrl(shop.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-line text-[13px] font-semibold text-ink-secondary hover:bg-white/[0.04] active:scale-[0.98] transition-all duration-150"
        >
          카카오맵에서 보기
          <ArrowSquareOut size={14} weight="bold" />
        </a>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <span className="text-[11px] text-ink-caption font-semibold w-14 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
