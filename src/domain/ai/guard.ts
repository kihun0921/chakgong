// 외부 AI(Gemini)로 보내는 글의 개인정보 검사 (SRS SR-AI-02, SR-NF-13·15)
// 순수 함수. 주민등록번호·전화번호·사업자등록번호·계좌번호로 보이는 값을 찾거나 가린다.

export type PiiKind = "주민등록번호" | "전화번호" | "사업자등록번호" | "계좌번호";

// 앞에서부터 차례로 가린다(긴 형식을 먼저). 날짜(2026-11-02)·금액(622,764,021)·문서번호는 걸리지 않는다.
const PATTERNS: { kind: PiiKind; re: RegExp }[] = [
  { kind: "주민등록번호", re: /(?<!\d)\d{6}-?[1-8]\d{6}(?!\d)/g },
  { kind: "사업자등록번호", re: /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g },
  { kind: "전화번호", re: /(?<!\d)0\d{1,2}-?\d{3,4}-?\d{4}(?!\d)/g },
  { kind: "계좌번호", re: /(?<!\d)\d{2,6}-\d{2,6}-\d{4,8}(?!\d)/g },
];

export const PII_PLACEHOLDER = "[제외]";

/** 개인정보로 보이는 값의 종류. 없으면 빈 배열 */
export function detectPii(text: string): PiiKind[] {
  return PATTERNS.filter(({ re }) => new RegExp(re.source).test(text)).map((p) => p.kind);
}

/** 개인정보로 보이는 값을 [제외]로 바꾼다 */
export function scrubPii(text: string): string {
  return PATTERNS.reduce((t, { re }) => t.replace(re, PII_PLACEHOLDER), text);
}
