// 용역비 금액 규칙 (SRS SR-FEE-01): 공급가액 + 부가세 = 합계, 모두 원 단위 정수.
// 금액은 기준정보 설정값으로 바꿀 수 있어야 하므로 상수가 아니라 인자로 받는다.

export type Fee = {
  supply: number; // 공급가액(원)
  vat: number; // 부가세(원)
  total: number; // 합계(원)
};

export const DEFAULT_SUPPLY_WON = 500_000;
export const VAT_RATE = 0.1;

export function calcFee(supply: number = DEFAULT_SUPPLY_WON): Fee {
  if (!Number.isInteger(supply) || supply < 0) {
    throw new RangeError("공급가액은 0 이상의 정수(원)여야 합니다.");
  }
  const vat = Math.round(supply * VAT_RATE);
  return { supply, vat, total: supply + vat };
}

export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}
