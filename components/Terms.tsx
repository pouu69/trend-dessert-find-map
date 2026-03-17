'use client'
import Link from 'next/link'
import { MapPin, ArrowLeft, FileText, Shield, Copyright, WarningCircle, ArrowsClockwise, Notepad } from '@phosphor-icons/react'

export function Terms() {
  const lastUpdated = '2026년 3월 17일'

  const sections = [
    {
      id: 'intro',
      icon: FileText,
      title: '제1조 서비스 소개',
      content: [
        '"요즘 뭐가 맛있어?"(이하 "서비스")는 전국의 트렌드 디저트 및 간식 맛집 정보를 지도 위에서 탐색할 수 있도록 제공하는 무료 큐레이션 서비스입니다.',
        '서비스는 회원가입 및 로그인 없이 누구나 자유롭게 이용할 수 있습니다.',
        '이용자는 지도 탐색, 지역 필터링, 검색, 즐겨찾기 저장(기기 내 저장) 등의 기능을 이용할 수 있습니다.',
      ],
    },
    {
      id: 'conditions',
      icon: Shield,
      title: '제2조 이용 조건',
      content: [
        '서비스는 만 14세 이상 누구나 이용할 수 있습니다.',
        '이용자는 서비스를 상업적 목적으로 무단 복제·배포·크롤링하거나, 서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.',
        '즐겨찾기 등 이용자 설정 데이터는 이용 기기의 브라우저 localStorage에만 저장되며, 운영자는 해당 데이터를 수집하거나 처리하지 않습니다.',
        '서비스 이용에 별도의 개인정보 제공이 요구되지 않습니다.',
      ],
    },
    {
      id: 'copyright',
      icon: Copyright,
      title: '제3조 콘텐츠 저작권',
      content: [
        '서비스에 표시되는 가게 명칭, 주소, 영업시간, 이미지 등의 정보는 네이버 플레이스 등 공개된 출처에서 수집한 데이터입니다.',
        '수집된 데이터의 원 저작권은 각 원천 플랫폼 및 해당 업체에 있으며, 서비스는 정보 제공 목적으로만 이를 활용합니다.',
        '서비스의 UI 디자인, 큐레이션 구성 및 서비스 코드에 대한 저작권은 운영자에게 있습니다.',
        '서비스 내 콘텐츠를 허가 없이 상업적으로 이용하거나 재배포하는 행위는 금지됩니다.',
      ],
    },
    {
      id: 'disclaimer',
      icon: WarningCircle,
      title: '제4조 면책 조항',
      content: [
        '서비스에 게재된 가게 정보(영업 여부, 메뉴, 가격 등)는 외부 공개 데이터를 기반으로 하며, 실제 현황과 다를 수 있습니다. 방문 전 반드시 직접 확인하시기 바랍니다.',
        '운영자는 정보의 정확성·최신성·완전성을 보장하지 않으며, 정보 오류로 인해 발생한 손해에 대해 책임을 지지 않습니다.',
        '서비스 이용 중 발생하는 통신 요금, 데이터 사용 등 부수적 비용은 이용자가 부담합니다.',
        '서비스는 외부 링크(네이버 지도, 인스타그램 등)를 포함할 수 있으며, 해당 외부 사이트의 내용에 대해 운영자는 책임을 지지 않습니다.',
      ],
    },
    {
      id: 'changes',
      icon: ArrowsClockwise,
      title: '제5조 서비스 변경 및 중단',
      content: [
        '운영자는 운영상 또는 기술상의 이유로 사전 공지 없이 서비스의 전부 또는 일부를 변경, 중단할 수 있습니다.',
        '서비스는 무료로 제공되며, 서비스 변경·중단으로 인한 손해에 대해 운영자는 별도의 보상 의무를 지지 않습니다.',
      ],
    },
    {
      id: 'amendments',
      icon: Notepad,
      title: '제6조 약관 변경',
      content: [
        '운영자는 필요한 경우 이 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지 또는 본 페이지 갱신을 통해 효력이 발생합니다.',
        '이용자는 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단할 수 있습니다. 변경 공지 이후에도 서비스를 계속 이용하는 경우 변경된 약관에 동의한 것으로 간주합니다.',
        `본 약관의 최종 업데이트 일자: ${lastUpdated}`,
      ],
    },
  ]

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
          background: 'radial-gradient(ellipse 60% 50% at 80% 10%, rgba(232,97,42,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-[1] max-w-3xl mx-auto px-6 md:px-12">
        {/* Nav bar */}
        <nav className="flex items-center justify-between pt-8 pb-10 md:pb-14">
          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] text-[#78716C] hover:text-[#F5F0EB] transition-colors duration-150 group cursor-pointer"
          >
            <ArrowLeft
              size={16}
              weight="bold"
              className="group-hover:-translate-x-0.5 transition-transform duration-150"
            />
            홈으로 돌아가기
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
              <MapPin size={16} weight="fill" className="text-[#141210]" />
            </div>
            <span className="font-heading text-[14px] font-bold text-[#F5F0EB] tracking-tight">맛집 지도</span>
          </div>
        </nav>

        {/* Page header */}
        <header className="mb-12">
          <div className="inline-flex items-center gap-2 bg-[#1C1917] border border-white/[0.06] rounded-full px-4 py-1.5 mb-5">
            <FileText size={13} weight="fill" className="text-brand" />
            <span className="text-[12px] text-[#78716C] font-medium tracking-wide uppercase">이용약관</span>
          </div>

          <h1 className="font-heading text-[clamp(1.75rem,6vw,3rem)] font-extrabold text-[#F5F0EB] tracking-[-0.03em] leading-[1.1]">
            요즘 뭐가 맛있어?
            <br />
            <span className="text-brand">이용약관</span>
          </h1>

          <p className="text-[14px] text-[#78716C] mt-4 leading-relaxed">
            최종 업데이트: {lastUpdated}
          </p>

          <div className="mt-6 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
        </header>

        {/* Sections */}
        <div className="space-y-2 pb-20">
          {sections.map((section, index) => {
            const Icon = section.icon
            return (
              <section
                key={section.id}
                className="bg-[#1C1917] rounded-2xl border border-white/[0.06] overflow-hidden anim-card"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Section header */}
                <div className="flex items-center gap-3.5 px-5 pt-5 pb-4">
                  <div className="w-9 h-9 rounded-xl bg-[#292524] flex items-center justify-center flex-shrink-0">
                    <Icon size={18} weight="fill" className="text-brand" />
                  </div>
                  <h2 className="text-[15px] font-bold text-[#F5F0EB] leading-snug">{section.title}</h2>
                </div>

                {/* Divider */}
                <div className="mx-5 h-px bg-white/[0.06]" />

                {/* Content */}
                <ul className="px-5 pt-4 pb-5 space-y-3">
                  {section.content.map((paragraph, pIndex) => (
                    <li key={pIndex} className="flex items-start gap-3">
                      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-brand/50 flex-shrink-0" />
                      <p className="text-[14px] text-[#A8A29E] leading-[1.8]">{paragraph}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {/* Footer note */}
          <div className="pt-8 pb-4 text-center">
            <p className="text-[12px] text-[#57534E] leading-relaxed">
              서비스 이용 관련 문의는 서비스 내 피드백 채널을 통해 전달해 주세요.
              <br />
              본 약관은 대한민국 법령에 따라 해석됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
