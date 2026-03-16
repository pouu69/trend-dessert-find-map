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

  return (
    <div className="anim-detail flex-1 overflow-y-auto">
      {/* Navigation */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-ink transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          목록
        </button>

        <button
          onClick={() => onToggleFavorite(shop.id)}
          className={`
            flex items-center gap-1.5 px-4 py-2 rounded-lg
            text-[13px] font-semibold transition-colors duration-150
            ${isFavorite
              ? 'bg-danger text-ink-on-dark'
              : 'bg-bg-search text-ink-secondary hover:bg-line-bold'
            }
          `}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {isFavorite ? '저장됨' : '즐겨찾기'}
        </button>
      </div>

      {/* Header */}
      <div className="px-5 py-4 border-b border-line">
        <h2 className="text-[22px] font-extrabold text-ink leading-tight tracking-[-0.02em]">
          {shop.name}
        </h2>

        <p className="text-[14px] text-ink-secondary mt-3 leading-relaxed">{shop.address}</p>

        {shop.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-4">
            {shop.tags.map(tag => (
              <span
                key={tag}
                className="bg-brand-soft text-brand font-bold px-3 py-1.5 rounded-lg text-[12px]"
              >
                {tag}
              </span>
            ))}
            <span className="bg-bg-search text-ink-caption font-medium px-3 py-1.5 rounded-lg text-[12px]">
              {shop.region}
            </span>
          </div>
        )}
      </div>

      {/* 빠른 액션 버튼 */}
      <div className="flex gap-3 px-5 py-5 border-b border-line">
        {shop.phone && (
          <a
            href={`tel:${shop.phone}`}
            className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl bg-bg-section hover:bg-line transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B2C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span className="text-[12px] font-semibold text-ink-secondary">전화</span>
          </a>
        )}

        <a
          href={kakaoMapUrl(shop.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl bg-bg-section hover:bg-line transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B2C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3,11 22,2 13,21 11,13" />
          </svg>
          <span className="text-[12px] font-semibold text-ink-secondary">길찾기</span>
        </a>

        <button
          onClick={() => {
            const url = window.location.origin + `?shop=${shop.id}`
            navigator.clipboard.writeText(url).then(() => alert('링크가 복사되었습니다.'))
          }}
          className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl bg-bg-section hover:bg-line transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B2C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span className="text-[12px] font-semibold text-ink-secondary">공유</span>
        </button>
      </div>

      {/* 기본 정보 */}
      {hasInfo && (
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[12px] font-bold text-ink-caption uppercase tracking-wider mb-4">기본 정보</h3>

          <table className="w-full text-[14px]">
            <tbody>
              {shop.phone && (
                <InfoRow label="전화" icon="phone">
                  <a href={`tel:${shop.phone}`} className="text-link font-semibold hover:underline">
                    {shop.phone}
                  </a>
                </InfoRow>
              )}
              {shop.hours && (
                <InfoRow label="영업시간" icon="clock">
                  <span className="font-medium text-ink">{shop.hours}</span>
                </InfoRow>
              )}
              {shop.closedDays.length > 0 && (
                <InfoRow label="휴무일" icon="calendar">
                  <span className="text-danger font-semibold">{shop.closedDays.join(', ')}</span>
                </InfoRow>
              )}
              {shop.priceRange && (
                <InfoRow label="가격대" icon="price">
                  <span className="text-brand font-bold">{shop.priceRange}원</span>
                </InfoRow>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 소개 */}
      {shop.description && (
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[12px] font-bold text-ink-caption uppercase tracking-wider mb-3">소개</h3>
          <p className="text-[14px] text-ink-secondary leading-[1.8]">
            {shop.description}
          </p>
        </div>
      )}

      {/* 카카오맵 */}
      <div className="px-5 py-4">
        <a
          href={kakaoMapUrl(shop.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border border-line text-[13px] font-semibold text-ink-secondary hover:bg-bg-section transition-colors"
        >
          카카오맵에서 보기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15,3 21,3 21,9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  )
}

function InfoRow({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="py-3 pr-3 align-middle w-9">
        <div className="w-8 h-8 rounded-lg bg-bg-section flex items-center justify-center">
          <InfoIcon type={icon} />
        </div>
      </td>
      <td className="py-3 pr-4 align-middle text-[12px] text-ink-caption font-semibold whitespace-nowrap w-16">
        {label}
      </td>
      <td className="py-3 align-middle">
        {children}
      </td>
    </tr>
  )
}

function InfoIcon({ type }: { type: string }) {
  const props = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: '#9CA3AF', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (type) {
    case 'phone':
      return <svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>
    case 'calendar':
      return <svg {...props}><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
    case 'price':
      return <svg {...props}><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
    default:
      return null
  }
}
