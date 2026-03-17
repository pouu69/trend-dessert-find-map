'use client'
import Link from 'next/link'
import { MapPin, ArrowLeft, Compass, CheckCircle, Storefront } from '@phosphor-icons/react'
import { products } from '@/data/products'
import { ProductIcon } from './ProductIcon'

export function About() {
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
          background: 'radial-gradient(ellipse 60% 50% at 80% 80%, rgba(232,97,42,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-[1] max-w-2xl mx-auto px-8 md:px-16">
        {/* Nav bar */}
        <nav className="flex items-center justify-between pt-8 pb-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center">
              <MapPin size={18} weight="fill" className="text-[#141210]" />
            </div>
            <span className="font-heading text-[15px] font-bold text-[#F5F0EB] tracking-tight">맛집 지도</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] text-[#78716C] hover:text-[#F5F0EB] transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={15} weight="bold" />
            <span>홈으로</span>
          </Link>
        </nav>

        {/* Page title */}
        <div className="anim-card">
          <div className="flex items-center gap-2 mb-4">
            <Compass size={14} weight="bold" className="text-brand" />
            <span className="text-[12px] text-brand font-semibold tracking-widest uppercase">About</span>
          </div>
          <h1
            className="font-heading text-[clamp(2rem,6vw,3.5rem)] font-extrabold text-[#F5F0EB] tracking-[-0.04em] leading-[1]"
            style={{ textWrap: 'balance' }}
          >
            요즘 뭐가
            <br />
            <span className="text-brand">맛있어?</span>
          </h1>
          <p className="text-[16px] text-[#A8A29E] mt-5 leading-[1.8] max-w-[480px]">
            전국 트렌드 디저트 & 간식 맛집을 지도 위에서 한눈에 찾는 서비스입니다.
            SNS에서 핫한 상품의 검증된 판매처를 쉽게 발견할 수 있어요.
          </p>
        </div>

        {/* Divider */}
        <div className="mt-12 border-t border-white/[0.06]" />

        {/* How it works */}
        <section className="mt-10 anim-card" style={{ animationDelay: '80ms' }}>
          <h2 className="text-[13px] font-semibold text-[#78716C] tracking-widest uppercase mb-5">
            어떻게 만드나요?
          </h2>
          <div className="space-y-4">
            {[
              {
                step: '01',
                title: '공개 데이터 수집',
                desc: '네이버 지도, 카카오맵 등 공개된 플랫폼 데이터를 기반으로 판매처 목록을 구성합니다.',
              },
              {
                step: '02',
                title: '직접 검증',
                desc: '수집된 데이터는 실제 판매 여부와 정확성을 직접 확인하는 검증 과정을 거칩니다.',
              },
              {
                step: '03',
                title: '지도에 등록',
                desc: '검증된 맛집만 지도에 올라갑니다. 잘못된 정보는 지속적으로 업데이트됩니다.',
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="flex gap-4 bg-[#1C1917] rounded-2xl px-5 py-4 border border-white/[0.06]"
              >
                <span className="font-heading text-[11px] font-bold text-brand/50 pt-0.5 w-5 flex-shrink-0">
                  {step}
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-[#F5F0EB] leading-snug">{title}</p>
                  <p className="text-[13px] text-[#78716C] mt-1 leading-[1.7]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="mt-12 border-t border-white/[0.06]" />

        {/* Currently tracking */}
        <section className="mt-10 anim-card" style={{ animationDelay: '160ms' }}>
          <h2 className="text-[13px] font-semibold text-[#78716C] tracking-widest uppercase mb-5">
            지금 추적 중인 상품
          </h2>
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.slug}
                className="flex items-center gap-4 bg-[#1C1917] rounded-2xl px-5 py-4 border border-white/[0.06]"
              >
                <div className="w-10 h-10 rounded-xl bg-[#292524] flex items-center justify-center flex-shrink-0">
                  <ProductIcon name={product.iconName} size={20} weight="fill" className="text-brand" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#F5F0EB] leading-snug">{product.name}</p>
                  <p className="text-[12px] text-[#57534E] mt-0.5">전국 판매처 지도</p>
                </div>
                <CheckCircle size={16} weight="fill" className="text-brand/60 flex-shrink-0" />
              </div>
            ))}

            {/* Coming soon placeholder */}
            <div className="flex items-center gap-4 bg-[#1C1917]/50 rounded-2xl px-5 py-4 border border-white/[0.03]">
              <div className="w-10 h-10 rounded-xl bg-[#1C1917] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                <Storefront size={18} weight="duotone" className="text-[#3D3733]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-[#3D3733] leading-snug">다음 상품</p>
                <p className="text-[12px] text-[#3D3733]/70 mt-0.5">곧 추가됩니다</p>
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="mt-12 border-t border-white/[0.06]" />

        {/* Footer */}
        <footer className="mt-8 pb-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[#57534E]">
            &copy; 2025 요즘 뭐가 맛있어?
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-[12px] text-[#57534E] hover:text-[#A8A29E] transition-colors duration-150 cursor-pointer"
            >
              개인정보처리방침
            </Link>
            <Link
              href="/terms"
              className="text-[12px] text-[#57534E] hover:text-[#A8A29E] transition-colors duration-150 cursor-pointer"
            >
              이용약관
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
