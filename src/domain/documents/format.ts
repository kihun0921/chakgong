// 서류에 쓰는 표기 규칙 (SRS 8.4): 날짜 'yyyy년 m월 d일', 금액 천 단위 구분, 주민등록번호 마스킹

import { parseDate } from "../calendar";

export function koreanDate(s: string): string {
  if (s === "") return "";
  const d = parseDate(s);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

/** 'yyyy년 m월     일'처럼 일을 비워 두는 제출일 표기 */
export function blankableDate(s: string): string {
  return s === "" ? "20    년     월     일" : koreanDate(s);
}

export function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 화면 표시용 마스킹: 앞 6자리만 보이고 뒤는 가린다 (SR-NF-15) */
export function maskRrn(rrn: string): string {
  const digits = rrn.replace(/\D/g, "");
  if (digits.length === 0) return "";
  const front = digits.slice(0, 6);
  return `${front}-${"*".repeat(Math.max(0, digits.length - 6))}`;
}

/** 출력 PDF용: 000000-0000000 형식으로 정리 */
export function formatRrn(rrn: string): string {
  const digits = rrn.replace(/\D/g, "");
  return digits.length === 13 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : rrn;
}

/** 교차 검사용 정규화: 날짜는 yyyy-mm-dd, 금액은 숫자만, 그 외는 공백 제거 */
export function normalizeFact(value: string): string {
  const v = value.trim();
  const m = /^(\d{4})\s*[.\-년/]\s*(\d{1,2})\s*[.\-월/]\s*(\d{1,2})\s*(일)?\.?$/.exec(v);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if (/^[\d,]+\s*원?$/.test(v)) return v.replace(/[^\d]/g, "");
  return v.replace(/\s+/g, "");
}

const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL_UNITS = ["", "십", "백", "천"];
const BIG_UNITS = ["", "만", "억", "조", "경"];

/**
 * 금액을 한글로 쓴다: 17,511,921,000 → '일백칠십오억일천일백구십이만일천원'.
 * 계약서·착공계 관례대로 백·천 자리의 '일'은 쓴다(일백, 일천). 십 자리는 '십'이다(5,549,924,648 → 오십오억…).
 * 만 단위 묶음(4자리)마다 읽고 묶음이 모두 0이면 단위를 쓰지 않는다. 0원은 '영원'.
 */
export function koreanWon(n: number): string {
  if (!Number.isFinite(n)) return "";
  const neg = n < 0;
  let v = Math.abs(Math.round(n));
  if (v === 0) return "영원";
  const groups: string[] = [];
  for (let g = 0; v > 0; g++) {
    const part = v % 10000;
    v = Math.floor(v / 10000);
    if (part === 0) continue;
    let s = "";
    for (let k = 3; k >= 0; k--) {
      const d = Math.floor(part / 10 ** k) % 10;
      if (d === 0) continue;
      s += (k === 1 && d === 1 ? "" : DIGITS[d]) + SMALL_UNITS[k]; // 십 자리 1은 '십'
    }
    groups.push(s + BIG_UNITS[g]);
  }
  return `${neg ? "마이너스 " : ""}${groups.reverse().join("")}원`;
}

/** 조사 '과/와': 마지막 한글 글자에 받침이 있으면 '과' */
export function gwa(word: string): string {
  const letters = [...word].filter((c) => /[가-힣]/.test(c));
  const last = letters.at(-1);
  if (!last) return "와";
  return (last.charCodeAt(0) - 0xac00) % 28 === 0 ? "와" : "과";
}
