export function normalizeName(name: string): string {
  return name.replace(/[\s\-·.,():/]/g, '').toLowerCase()
}

export function extractRegion(address: string): string {
  const parts = address.split(/\s+/)
  if (parts.length === 0) return '기타'
  const first = parts[0]
  const regionMap: Record<string, string> = {
    서울특별시: '서울', 서울시: '서울', 서울: '서울',
    부산광역시: '부산', 부산시: '부산', 부산: '부산',
    대구광역시: '대구', 대구시: '대구', 대구: '대구',
    인천광역시: '인천', 인천시: '인천', 인천: '인천',
    광주광역시: '광주', 광주시: '광주', 광주: '광주',
    대전광역시: '대전', 대전시: '대전', 대전: '대전',
    울산광역시: '울산', 울산시: '울산', 울산: '울산',
    세종특별자치시: '세종', 세종시: '세종', 세종: '세종',
    경기도: '경기', 경기: '경기',
    강원특별자치도: '강원', 강원도: '강원', 강원: '강원',
    충청북도: '충북', 충북: '충북',
    충청남도: '충남', 충남: '충남',
    전북특별자치도: '전북', 전라북도: '전북', 전북: '전북',
    전라남도: '전남', 전남: '전남',
    경상북도: '경북', 경북: '경북',
    경상남도: '경남', 경남: '경남',
    제주특별자치도: '제주', 제주도: '제주', 제주: '제주',
  }
  return regionMap[first] || first
}

export function extractDistrict(address: string): string {
  return address.split(/\s+/).slice(0, 3).join(' ')
}

export function isDuplicate(a: { name: string; address: string }, b: { name: string; address: string }): boolean {
  return normalizeName(a.name) === normalizeName(b.name) && extractDistrict(a.address) === extractDistrict(b.address)
}

export function isGenericName(name: string): boolean {
  const genericPatterns = [
    /카페$/, /^.{1,3}카페$/, /동카페$/, /구카페$/, /시카페$/,
    /^디저트카페$/, /^베이커리카페$/, /^맛집카페$/,
    /^네이버/, /^검색 결과/, /위치찾기/,
  ]
  return genericPatterns.some(p => p.test(name.trim()))
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
