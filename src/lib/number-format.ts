// 숫자 표기: 입력칸과 화면, 서류에서 3자리마다 쉼표를 찍는다.
// 저장·계산에는 쉼표 없는 숫자 문자열("1234567.5")을 쓰고, 보여 줄 때만 쉼표를 넣는다.

/** 입력 글자에서 숫자(와 소수점)만 남긴다. allowDecimal이 아니면 소수점도 지운다. 소수점은 하나만 둔다. */
export function stripNumber(input: string, allowDecimal = false): string {
  if (!allowDecimal) return input.replace(/[^\d]/g, "");
  const cleaned = input.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

/** "1234567.5" → "1,234,567.5". 소수점 뒤는 그대로 두고(입력 중인 "12." 보존), 앞 0은 하나만 남긴다. */
export function groupDigits(raw: string): string {
  if (raw === "") return "";
  const dot = raw.indexOf(".");
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const frac = dot === -1 ? "" : raw.slice(dot);
  const trimmed = intPart.replace(/^0+(?=\d)/, "");
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + frac;
}

/** 숫자 → 쉼표 표기 문자열. 서류·표에 쓴다 (소수는 maxFraction자리까지 반올림, 끝의 0은 지운다) */
export function formatNumber(n: number, maxFraction = 0): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: maxFraction });
}
