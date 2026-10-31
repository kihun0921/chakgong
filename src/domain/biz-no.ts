// 사업자등록번호: 업체 식별 키 (SRS SR-FEE-15, docs/RETENTION.md 7장)
// 순수 함수. 화면·로그에는 마스킹한 값만 쓴다(SR-NF-13).

const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5];

/** 하이픈·공백을 없애 숫자 10자리로 만든다. 10자리가 아니면 null. */
export function normalizeBizNo(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

/** 10자리이고 마지막 검증 자릿수가 맞는가 */
export function isValidBizNo(raw: string): boolean {
  const n = normalizeBizNo(raw);
  if (n === null) return false;
  const d = [...n].map(Number);
  const sum = WEIGHTS.reduce((acc, w, i) => acc + d[i] * w, 0) + Math.floor((d[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === d[9];
}

/** 뒤 5자리를 가려 표시한다. 형식이 맞지 않으면 숫자를 모두 가린다. */
export function maskBizNo(raw: string): string {
  const n = normalizeBizNo(raw);
  if (n === null) return raw.replace(/\d/g, "*");
  return `${n.slice(0, 3)}-${n.slice(3, 5)}-*****`;
}
