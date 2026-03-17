import Link from 'next/link'
import { MapPin } from '@phosphor-icons/react/dist/ssr'

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-screen bg-[#141210] flex items-center justify-center relative">
      <div className="fixed inset-0 pointer-events-none z-10 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      <div className="relative z-[1] text-center px-6">
        <div className="w-16 h-16 bg-[#1C1917] border border-white/[0.06] rounded-3xl flex items-center justify-center mx-auto mb-6">
          <MapPin size={32} weight="duotone" className="text-brand" />
        </div>
        <h1 className="font-heading text-[2rem] font-extrabold text-[#F5F0EB] tracking-tight mb-3">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-[14px] text-[#78716C] mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-brand text-[#141210] font-semibold text-[14px] px-6 py-3 rounded-xl hover:bg-brand-hover transition-colors"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
