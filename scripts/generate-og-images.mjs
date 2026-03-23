import sharp from 'sharp'

const WIDTH = 1200
const HEIGHT = 630

// Map pin SVG icon (matches the site's nav icon)
const pinIcon = `
<g transform="translate({{x}},{{y}}) scale({{s}})">
  <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z" fill="{{fill}}" opacity="{{opacity}}"/>
</g>`

function pin(x, y, s, fill, opacity = 1) {
  return pinIcon
    .replace('{{x}}', x).replace('{{y}}', y).replace('{{s}}', s)
    .replace('{{fill}}', fill).replace('{{opacity}}', opacity)
}

function buildSvg({ title, subtitle, footer, accent = '#E8612A' }) {
  return `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1C1917"/>
      <stop offset="100%" style="stop-color:#141210"/>
    </linearGradient>
    <radialGradient id="glow" cx="20%" cy="25%" r="60%">
      <stop offset="0%" style="stop-color:${accent};stop-opacity:0.12"/>
      <stop offset="100%" style="stop-color:${accent};stop-opacity:0"/>
    </radialGradient>
    <linearGradient id="accent-line" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${accent};stop-opacity:0"/>
      <stop offset="50%" style="stop-color:${accent};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${accent};stop-opacity:0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>

  <!-- Subtle grid pattern -->
  <g opacity="0.04" stroke="#F5F0EB" stroke-width="0.5">
    ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 65}" y1="0" x2="${i * 65}" y2="${HEIGHT}"/>`).join('')}
    ${Array.from({ length: 10 }, (_, i) => `<line x1="0" y1="${i * 70}" x2="${WIDTH}" y2="${i * 70}"/>`).join('')}
  </g>

  <!-- Decorative floating pins -->
  ${pin(900, 60, 0.28, accent, 0.15)}
  ${pin(1020, 180, 0.2, accent, 0.08)}
  ${pin(80, 400, 0.22, accent, 0.1)}
  ${pin(950, 380, 0.18, accent, 0.06)}

  <!-- Accent line -->
  <rect x="100" y="285" width="160" height="3" rx="1.5" fill="${accent}"/>

  <!-- Title -->
  <text x="100" y="350" font-family="sans-serif" font-size="58" font-weight="800" fill="#F5F0EB" letter-spacing="-1">${title}</text>

  <!-- Subtitle -->
  <text x="100" y="400" font-family="sans-serif" font-size="24" font-weight="400" fill="#A8A29E">${subtitle}</text>

  <!-- Footer -->
  <text x="100" y="560" font-family="sans-serif" font-size="16" fill="#57534E">${footer}</text>

  <!-- Bottom accent bar -->
  <rect x="0" y="620" width="${WIDTH}" height="10" fill="${accent}" opacity="0.8"/>

  <!-- Logo area: pin icon + text -->
  <g transform="translate(100, 120)">
    <rect width="44" height="44" rx="12" fill="${accent}"/>
    <g transform="translate(9, 7) scale(0.1)">
      <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z" fill="#141210"/>
    </g>
    <text x="56" y="31" font-family="sans-serif" font-size="17" font-weight="700" fill="#F5F0EB">맛집 지도</text>
  </g>

  <!-- Domain -->
  <text x="1100" y="560" text-anchor="end" font-family="monospace" font-size="15" fill="#57534E">trend-dessert.com</text>
</svg>`
}

const images = [
  {
    path: 'public/og-default.png',
    title: '요즘 뭐가 맛있어?',
    subtitle: '전국 트렌드 디저트 &amp; 간식 맛집을 지도에서 한눈에',
    footer: '상하이버터떡 · 두쫀쿠 · 촉촉한황치즈칩',
  },
  {
    path: 'public/og-shanghai-butter-rice.png',
    title: '상하이버터떡',
    subtitle: '전국 판매처를 지도에서 한눈에 찾아보세요',
    footer: '요즘 뭐가 맛있어?',
  },
  {
    path: 'public/og-dujjonku.png',
    title: '두쫀쿠',
    subtitle: '전국 판매처를 지도에서 한눈에 찾아보세요',
    footer: '요즘 뭐가 맛있어?',
  },
  {
    path: 'public/og-chokchokhan-cheese-chip.png',
    title: '촉촉한황치즈칩',
    subtitle: '전국 판매처를 지도에서 한눈에 찾아보세요',
    footer: '요즘 뭐가 맛있어?',
  },
]

for (const img of images) {
  const svg = buildSvg(img)
  await sharp(Buffer.from(svg)).png().toFile(img.path)
  console.log(`✓ ${img.path}`)
}
