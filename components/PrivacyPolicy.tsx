'use client'
import Link from 'next/link'
import { MapPin, ArrowLeft, ShieldCheck } from '@phosphor-icons/react'

export function PrivacyPolicy() {
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

      <div className="relative z-[1] max-w-2xl mx-auto px-6 md:px-12">
        {/* Nav bar */}
        <nav className="flex items-center justify-between pt-8 pb-10">
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

        {/* Page header */}
        <div className="anim-card flex items-start gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-[#1C1917] border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck size={24} weight="duotone" className="text-brand" />
          </div>
          <div>
            <h1 className="font-heading text-[clamp(1.6rem,5vw,2.4rem)] font-extrabold text-[#F5F0EB] tracking-[-0.03em] leading-tight">
              개인정보처리방침
            </h1>
            <p className="text-[13px] text-[#57534E] mt-1.5">최종 수정일: 2026년 3월 17일</p>
          </div>
        </div>

        {/* Intro */}
        <div className="anim-card mb-8 p-5 rounded-2xl bg-[#1C1917] border border-white/[0.06]">
          <p className="text-[14px] text-[#A8A29E] leading-[1.9]">
            <strong className="text-[#F5F0EB] font-semibold">요즘 뭐가 맛있어?</strong>(이하 &quot;서비스&quot;)는 전국 트렌드 디저트·간식 맛집을 지도 위에서 소개하는 큐레이션 서비스입니다. 본 방침은 서비스가 수집·이용하는 정보의 범위와 처리 방법을 안내합니다.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-4 pb-20">

          <Section number="1" title="수집하는 개인정보">
            <p>서비스는 <strong className="text-[#F5F0EB]">회원가입·로그인을 요구하지 않으며</strong>, 이름·이메일·전화번호 등 식별 가능한 개인정보를 직접 수집하지 않습니다.</p>
            <p>다만, 서비스 운영 및 광고 제공 과정에서 아래 정보가 자동으로 수집될 수 있습니다.</p>
            <ul>
              <li>브라우저 종류, 운영체제, 화면 해상도 등 기기 정보</li>
              <li>접속 IP 주소 및 접속 일시</li>
              <li>서비스 내 페이지 방문 기록 및 클릭 이벤트</li>
              <li>광고 식별자(Google AdSense가 설정하는 쿠키·광고 ID)</li>
            </ul>
          </Section>

          <Section number="2" title="개인정보의 이용목적">
            <p>수집된 정보는 다음 목적에 한해 사용됩니다.</p>
            <ul>
              <li>서비스의 정상적인 제공 및 기술적 오류 분석</li>
              <li>방문자 트래픽 통계 파악 (집계·익명 처리된 형태)</li>
              <li>관심사 기반 맞춤형 광고 노출 (Google AdSense)</li>
            </ul>
            <p>수집된 정보는 이용목적 이외의 용도로 사용되지 않습니다.</p>
          </Section>

          <Section number="3" title="쿠키 사용">
            <p>서비스는 두 가지 방식으로 데이터를 로컬에 저장합니다.</p>
            <Subsection title="localStorage (즐겨찾기 기능)">
              <p>이용자가 저장한 즐겨찾기(찜한 맛집) 목록은 브라우저의 <code>localStorage</code>에만 저장됩니다. 이 데이터는 서버로 전송되지 않으며, 오직 해당 기기·브라우저에서만 유지됩니다. 브라우저 데이터를 삭제하면 즐겨찾기 목록도 함께 삭제됩니다.</p>
            </Subsection>
            <Subsection title="광고 쿠키 (Google AdSense)">
              <p>Google AdSense는 맞춤형 광고 제공을 위해 쿠키 및 유사 기술을 사용합니다. 이 쿠키는 Google이 관리하며, 이용자의 관심사·방문 이력 등을 바탕으로 광고를 최적화합니다.</p>
              <p>브라우저 설정에서 쿠키를 차단하거나 삭제할 수 있으나, 일부 기능이 제한될 수 있습니다.</p>
            </Subsection>
          </Section>

          <Section number="4" title="광고">
            <p>서비스는 <strong className="text-[#F5F0EB]">Google AdSense</strong>를 통해 광고를 운영합니다. Google은 DoubleClick 쿠키 등을 사용하여 이용자에게 관련성 높은 광고를 제공할 수 있습니다.</p>
            <ul>
              <li>광고 개인화 설정 변경: <ExtLink href="https://adssettings.google.com">adssettings.google.com</ExtLink></li>
              <li>Google 개인정보처리방침: <ExtLink href="https://policies.google.com/privacy">policies.google.com/privacy</ExtLink></li>
              <li>맞춤 광고 비활성화: <ExtLink href="https://www.aboutads.info/choices">aboutads.info/choices</ExtLink></li>
            </ul>
            <p>광고 수익은 서비스의 유지·개선에 사용됩니다.</p>
          </Section>

          <Section number="5" title="지도 서비스 이용">
            <p>서비스는 지도 표시를 위해 <strong className="text-[#F5F0EB]">Kakao Maps API</strong> 및 <strong className="text-[#F5F0EB]">Leaflet</strong> 오픈소스 라이브러리를 사용합니다. Kakao Maps 이용 시 Kakao의 개인정보처리방침이 적용될 수 있습니다.</p>
            <ul>
              <li>Kakao 개인정보처리방침: <ExtLink href="https://www.kakao.com/policy/privacy">kakao.com/policy/privacy</ExtLink></li>
            </ul>
          </Section>

          <Section number="6" title="제3자 제공">
            <p>서비스는 이용자의 정보를 광고 파트너(Google)를 제외하고 제3자에게 판매·제공·공유하지 않습니다. 법령에 따른 수사기관의 요청이 있는 경우 관련 법률이 정한 절차에 따라 제공할 수 있습니다.</p>
          </Section>

          <Section number="7" title="개인정보의 보관 및 파기">
            <p>서비스는 서버에 개인정보를 저장하지 않습니다. 이용자 기기의 <code>localStorage</code>에 저장된 즐겨찾기 데이터는 이용자가 직접 브라우저 저장 데이터를 삭제하면 즉시 파기됩니다.</p>
            <p>Google AdSense 등 제3자 쿠키의 보관 기간은 각 사업자의 방침에 따릅니다.</p>
          </Section>

          <Section number="8" title="이용자의 권리">
            <p>이용자는 언제든지 브라우저 설정을 통해 다음 조치를 취할 수 있습니다.</p>
            <ul>
              <li>쿠키 저장 거부 또는 삭제</li>
              <li><code>localStorage</code> 데이터 삭제 (즐겨찾기 초기화)</li>
              <li>Google 광고 개인화 비활성화</li>
            </ul>
          </Section>

          <Section number="9" title="아동 이용자">
            <p>서비스는 만 14세 미만 아동을 대상으로 개인정보를 수집하지 않습니다. 만 14세 미만 아동의 개인정보가 수집된 사실을 확인하는 경우 즉시 삭제 조치합니다.</p>
          </Section>

          <Section number="10" title="방침 변경">
            <p>본 개인정보처리방침은 법령 변경 또는 서비스 변경에 따라 업데이트될 수 있습니다. 변경 시 페이지 상단의 최종 수정일을 갱신하며, 중요한 변경은 서비스 내 공지를 통해 안내합니다.</p>
          </Section>

          <Section number="11" title="문의">
            <p>개인정보 처리에 관한 문의는 아래 채널을 통해 연락주시기 바랍니다.</p>
            <p>개인정보 침해에 관한 신고·상담은 개인정보보호위원회(<ExtLink href="https://www.privacy.go.kr">privacy.go.kr</ExtLink>) 또는 한국인터넷진흥원(<ExtLink href="https://privacy.kisa.or.kr">privacy.kisa.or.kr</ExtLink>)에 문의하실 수 있습니다.</p>
          </Section>

        </div>
      </div>
    </div>
  )
}

// -- Sub-components --

interface SectionProps {
  number: string
  title: string
  children: React.ReactNode
}

function Section({ number, title, children }: SectionProps) {
  return (
    <section className="anim-card rounded-2xl bg-[#1C1917] border border-white/[0.06] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
        <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand text-[11px] font-bold font-heading flex items-center justify-center flex-shrink-0">
          {number}
        </span>
        <h2 className="font-heading text-[15px] font-bold text-[#F5F0EB] tracking-tight">{title}</h2>
      </div>
      <div className="px-5 py-4 text-[13px] text-[#A8A29E] leading-[1.95] space-y-2.5 [&_ul]:mt-2 [&_ul]:space-y-1.5 [&_ul]:pl-4 [&_ul]:list-none [&_ul_li]:before:content-['—'] [&_ul_li]:before:text-[#57534E] [&_ul_li]:before:mr-2.5 [&_ul_li]:flex [&_ul_li]:items-start [&_code]:bg-[#141210] [&_code]:text-brand/80 [&_code]:text-[12px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:font-mono [&_strong]:font-semibold">
        {children}
      </div>
    </section>
  )
}

interface SubsectionProps {
  title: string
  children: React.ReactNode
}

function Subsection({ title, children }: SubsectionProps) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">{title}</p>
      <div className="pl-3 border-l border-brand/20 space-y-1.5">
        {children}
      </div>
    </div>
  )
}

interface ExtLinkProps {
  href: string
  children: React.ReactNode
}

function ExtLink({ href, children }: ExtLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand/80 hover:text-brand underline underline-offset-2 decoration-brand/30 hover:decoration-brand transition-colors duration-150"
    >
      {children}
    </a>
  )
}
