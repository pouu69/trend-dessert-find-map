import { useEffect, useRef, useState } from 'react'
import { MapPin, CaretDown, Heart, Check } from '@phosphor-icons/react'
import { ProductIcon } from './ProductIcon'
import type { Product } from '../data/products'

interface HeaderProps {
  currentProduct: Product
  products: Product[]
  onProductChange: (product: Product) => void
  showFavoritesOnly: boolean
  onToggleFavorites: () => void
  favoriteCount: number
  totalCount: number
  visibleCount: number
}

export function Header({
  currentProduct,
  products,
  onProductChange,
  showFavoritesOnly,
  onToggleFavorites,
  favoriteCount,
  visibleCount,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-line flex-shrink-0">
      <div ref={menuRef} className="relative flex items-center gap-3">
        <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center flex-shrink-0">
          <MapPin size={18} weight="fill" className="text-[#141210]" />
        </div>
        <button
          onClick={() => setMenuOpen(prev => !prev)}
          className="text-left group"
        >
          <div className="flex items-center gap-1.5">
            <h1 className="font-heading text-[16px] font-bold text-ink tracking-tight leading-none">
              {currentProduct.name} 지도
            </h1>
            <CaretDown
              size={12}
              weight="bold"
              className={`text-ink-caption transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
            />
          </div>
          <p className="text-[11px] text-ink-caption mt-1 font-medium">
            {showFavoritesOnly
              ? `즐겨찾기 ${favoriteCount}개 표시 중`
              : `지도 내 ${visibleCount}개 가게`
            }
          </p>
        </button>

        {menuOpen && (
          <div className="absolute left-0 top-full mt-2 w-52 bg-[#292524] rounded-xl border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.4)] overflow-hidden z-30">
            <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold text-ink-caption uppercase tracking-wider">상품 선택</p>
            {products.map(product => (
              <button
                key={product.slug}
                onClick={() => {
                  onProductChange(product)
                  setMenuOpen(false)
                }}
                className={`
                  w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors
                  ${product.slug === currentProduct.slug ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'}
                `}
              >
                <ProductIcon name={product.iconName} size={18} weight="fill" className="text-brand" />
                <span className="text-[13px] font-semibold text-ink">{product.name}</span>
                {product.slug === currentProduct.slug && (
                  <Check size={14} weight="bold" className="text-brand ml-auto" />
                )}
              </button>
            ))}
            <div className="border-t border-white/[0.06] px-3 py-2.5">
              <p className="text-[11px] text-ink-caption">더 많은 상품이 곧 추가됩니다</p>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onToggleFavorites}
        className={`
          flex items-center gap-1.5
          text-[13px] font-semibold
          px-3.5 py-1.5 rounded-lg
          transition-all duration-150
          active:scale-[0.96]
          ${showFavoritesOnly
            ? 'bg-danger text-[#F5F0EB] shadow-[0_2px_12px_rgba(239,68,68,0.3)]'
            : 'bg-bg-search text-ink-secondary hover:bg-white/[0.1]'
          }
        `}
      >
        <Heart size={14} weight={showFavoritesOnly ? 'fill' : 'regular'} />
        {favoriteCount > 0 && <span>{favoriteCount}</span>}
      </button>
    </header>
  )
}
