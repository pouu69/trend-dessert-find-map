import { useState } from 'react'
import { MapPin, ArrowRight, Compass } from '@phosphor-icons/react'
import { products, type Product } from '../data/products'
import { ProductIcon } from './ProductIcon'

interface LandingProps {
  onProductSelect: (product: Product) => void
}

export function Landing({ onProductSelect }: LandingProps) {
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)

  return (
    <div className="min-h-[100dvh] w-screen bg-[#141210] overflow-y-auto relative">
      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 20% 20%, rgba(232,97,42,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-[1] max-w-5xl mx-auto px-8 md:px-16">
        {/* Nav bar */}
        <nav className="flex items-center justify-between pt-8 pb-16 md:pb-24">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center">
              <MapPin size={18} weight="fill" className="text-[#141210]" />
            </div>
            <span className="font-heading text-[15px] font-bold text-[#F5F0EB] tracking-tight">맛집 지도</span>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#78716C]">
            <Compass size={14} weight="bold" />
            <span>전국 트렌드 간식</span>
          </div>
        </nav>

        {/* Hero — left-aligned, asymmetric */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-12 md:gap-20 items-start">
          <div>
            <h1
              className="font-heading text-[clamp(2.5rem,8vw,5rem)] font-extrabold text-[#F5F0EB] tracking-[-0.04em] leading-[0.95]"
              style={{ textWrap: 'balance' }}
            >
              요즘 뭐가
              <br />
              <span className="text-brand">맛있어?</span>
            </h1>

            <p className="text-[16px] text-[#A8A29E] mt-6 leading-[1.8] max-w-[380px]">
              전국 트렌드 디저트와 간식 맛집을 지도 위에서 한눈에.
              지금 핫한 상품을 골라보세요.
            </p>
          </div>

          {/* Floating decorative element */}
          <div className="hidden md:flex items-center justify-center anim-float" aria-hidden="true">
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-brand/20 to-transparent border border-white/[0.06] backdrop-blur-sm flex items-center justify-center">
              <MapPin size={48} weight="duotone" className="text-brand/60" />
            </div>
          </div>
        </div>

        {/* Product cards */}
        <div className="mt-16 md:mt-20 space-y-3 max-w-lg">
          {products.map((product, index) => (
            <button
              key={product.slug}
              onClick={() => onProductSelect(product)}
              onMouseEnter={() => setHoveredSlug(product.slug)}
              onMouseLeave={() => setHoveredSlug(null)}
              className="
                anim-card group w-full text-left
                flex items-center gap-5
                bg-[#1C1917] rounded-2xl
                px-5 py-4
                border border-white/[0.06]
                hover:border-brand/20
                hover:bg-[#292524]
                active:scale-[0.985]
                transition-all duration-200
              "
              style={{ animationDelay: `${index * 80 + 200}ms` }}
            >
              <div
                className={`
                  w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                  transition-all duration-300
                  ${hoveredSlug === product.slug
                    ? 'bg-brand text-[#141210] scale-110 rotate-[-4deg]'
                    : 'bg-[#292524] text-brand'
                  }
                `}
              >
                <ProductIcon name={product.iconName} size={24} weight="fill" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-bold text-[#F5F0EB] leading-snug">
                  {product.name}
                </h2>
                <p className="text-[13px] text-[#78716C] mt-0.5">
                  전국 맛집 지도 탐색
                </p>
              </div>

              <ArrowRight
                size={18}
                weight="bold"
                className="text-[#78716C] group-hover:text-brand group-hover:translate-x-1 transition-all duration-200 flex-shrink-0"
              />
            </button>
          ))}
        </div>

        {/* Footer */}
        <p className="text-[12px] text-[#57534E] mt-16 pb-12">
          더 많은 상품이 곧 추가됩니다
        </p>
      </div>
    </div>
  )
}
