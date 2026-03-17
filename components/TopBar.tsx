'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlass, CaretDown, Heart, Check, X, MapPin } from '@phosphor-icons/react'
import { ProductIcon } from './ProductIcon'
import type { Product } from '@/data/products'
import type { Shop } from '@/types/shop'

interface TopBarProps {
  currentProduct: Product
  products: Product[]
  showFavoritesOnly: boolean
  onToggleFavorites: () => void
  favoriteCount: number
  searchQuery: string
  onSearchChange: (q: string) => void
  regions: string[]
  selectedRegion: string | null
  onRegionChange: (r: string | null) => void
  shops: Shop[]
  onShopClick: (shop: Shop) => void
}

export function TopBar({
  currentProduct, products,
  showFavoritesOnly, onToggleFavorites, favoriteCount,
  searchQuery, onSearchChange,
  regions, selectedRegion, onRegionChange,
  shops,
}: TopBarProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => { const t = setTimeout(() => onSearchChange(localQuery), 300); return () => clearTimeout(t) }, [localQuery, onSearchChange])
  useEffect(() => { setLocalQuery(searchQuery) }, [searchQuery])
  useEffect(() => { setActiveIdx(-1) }, [localQuery])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const q = localQuery.trim().toLowerCase()
  const suggestions = useMemo(() => {
    if (q.length < 1) return []
    return shops.filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)).slice(0, 5)
  }, [q, shops])
  const showSuggestions = searchFocused && suggestions.length > 0

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(p => (p + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(p => (p <= 0 ? suggestions.length - 1 : p - 1)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); setLocalQuery(suggestions[activeIdx].name); onSearchChange(suggestions[activeIdx].name); setSearchFocused(false) }
    else if (e.key === 'Escape') setSearchFocused(false)
  }

  function handleProductChange(product: Product) {
    router.push('/' + product.slug)
    setMenuOpen(false)
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="pointer-events-auto m-2 md:m-3 glass rounded-2xl">
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2">
          {/* Product */}
          <div ref={menuRef} className="relative flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(232,97,42,0.25)]">
              <ProductIcon name={currentProduct.iconName} size={16} weight="fill" className="text-white" />
            </div>
            <button onClick={() => setMenuOpen(p => !p)} className="flex items-center gap-1">
              <span className="text-[13px] md:text-[14px] font-bold text-ink tracking-tight">{currentProduct.name}</span>
              <CaretDown size={11} weight="bold" className={`text-ink-caption transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 glass rounded-xl overflow-hidden z-30">
                {products.map(p => (
                  <button key={p.slug} onClick={() => handleProductChange(p)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${p.slug === currentProduct.slug ? 'bg-brand-soft' : 'hover:bg-panel-hover'}`}>
                    <ProductIcon name={p.iconName} size={16} weight="fill" className="text-brand" />
                    <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                    {p.slug === currentProduct.slug && <Check size={12} weight="bold" className="text-brand ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-line" />

          {/* Search */}
          <div ref={searchRef} className="relative flex-1 min-w-0">
            <MagnifyingGlass size={14} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-caption pointer-events-none" />
            <input type="text" value={localQuery}
              onChange={e => { setLocalQuery(e.target.value); setSearchFocused(true) }}
              onFocus={() => setSearchFocused(true)} onKeyDown={handleKeyDown}
              placeholder="검색"
              className="w-full h-8 bg-bg-search rounded-lg pl-8 pr-8 text-[13px] font-medium text-ink placeholder-ink-caption outline-none border border-transparent focus:border-brand/30 transition-colors"
            />
            {localQuery && <button onClick={() => setLocalQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={10} weight="bold" className="text-ink-caption" /></button>}
            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1.5 glass rounded-xl overflow-hidden z-20">
                {suggestions.map((shop, i) => (
                  <button key={shop.id}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${i === activeIdx ? 'bg-panel-active' : 'hover:bg-panel-hover'}`}
                    onMouseEnter={() => setActiveIdx(i)} onClick={() => { setLocalQuery(shop.name); onSearchChange(shop.name); setSearchFocused(false) }}>
                    <MapPin size={13} weight="bold" className="text-ink-caption flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink truncate">{shop.name}</p>
                      <p className="text-[11px] text-ink-caption truncate">{shop.address}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Favorite */}
          <button onClick={onToggleFavorites}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all active:scale-[0.96] flex-shrink-0 ${
              showFavoritesOnly ? 'bg-danger text-white' : 'bg-bg-search text-ink-caption hover:text-ink-secondary'
            }`}>
            <Heart size={13} weight={showFavoritesOnly ? 'fill' : 'regular'} />
            {favoriteCount > 0 && <span>{favoriteCount}</span>}
          </button>
        </div>

        {/* Chips */}
        <div className="flex gap-1.5 px-3 md:px-4 pb-2 md:pb-2.5 overflow-x-auto scrollbar-none">
          <Chip label="전체" active={selectedRegion === null} onClick={() => onRegionChange(null)} />
          {regions.map(r => <Chip key={r} label={r} active={selectedRegion === r} onClick={() => onRegionChange(r === selectedRegion ? null : r)} />)}
        </div>
      </div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all active:scale-[0.96] flex-shrink-0 ${
        active ? 'bg-ink text-ink-on-dark' : 'bg-bg-chip text-ink-caption hover:text-ink-secondary'
      }`}>
      {label}
    </button>
  )
}
