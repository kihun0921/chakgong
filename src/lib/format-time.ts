// 시각 표기: 서버와 브라우저가 같은 글자를 만들도록 지역 설정에 기대지 않고 한국 시간(KST)으로 직접 만든다.
// (toLocaleString은 서버는 '오후', 브라우저는 'PM'처럼 달라 화면이 다시 그려지는 오류를 냈다.)

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO 시각 → 'yyyy-mm-dd hh:mm' (한국 시간). 올바르지 않은 값은 빈 문자열 */
export function formatKst(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 9 * 3600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
