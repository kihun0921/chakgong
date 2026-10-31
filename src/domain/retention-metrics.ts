// 리텐션 지표 (SRS SR-FEE-15, docs/RETENTION.md 4장)
// 순수 함수. 업체는 사업자등록번호(정규화)로 구분하고, 형식이 맞지 않는 번호는 집계에서 뺀다.

import { diffDays, type DateStr } from "./calendar";
import { normalizeBizNo } from "./biz-no";

export type DeliveryRecord = { bizNo: string; deliveredAt: DateStr };

/** 업체별 납품일(오름차순) */
function byCompany(deliveries: DeliveryRecord[]): Map<string, DateStr[]> {
  const map = new Map<string, DateStr[]>();
  for (const d of deliveries) {
    const key = normalizeBizNo(d.bizNo);
    if (key === null) continue;
    map.set(key, [...(map.get(key) ?? []), d.deliveredAt]);
  }
  for (const dates of map.values()) dates.sort();
  return map;
}

export type ReorderRate = { eligible: number; reordered: number; rate: number | null };

/**
 * 재의뢰율: 첫 납품 후 windowDays 안에 다시 납품받은 업체 ÷ 관찰 기간이 지난 업체.
 * 첫 납품 후 windowDays가 아직 지나지 않은 업체는 분모에서 뺀다. 대상이 없으면 rate는 null이다.
 */
export function reorderRate(deliveries: DeliveryRecord[], asOf: DateStr, windowDays = 180): ReorderRate {
  let eligible = 0;
  let reordered = 0;
  for (const dates of byCompany(deliveries).values()) {
    if (diffDays(dates[0], asOf) < windowDays) continue;
    eligible += 1;
    if (dates.length > 1 && diffDays(dates[0], dates[1]) <= windowDays) reordered += 1;
  }
  return { eligible, reordered, rate: eligible === 0 ? null : reordered / eligible };
}

export type ReorderInterval = { bizNo: string; count: number; avgDays: number };

/** 납품이 2건 이상인 업체의 납품일 사이 평균 일수. 사업자등록번호 순으로 정렬한다. */
export function reorderIntervals(deliveries: DeliveryRecord[]): ReorderInterval[] {
  const out: ReorderInterval[] = [];
  for (const [bizNo, dates] of byCompany(deliveries)) {
    if (dates.length < 2) continue;
    out.push({ bizNo, count: dates.length, avgDays: diffDays(dates[0], dates[dates.length - 1]) / (dates.length - 1) });
  }
  return out.sort((a, b) => (a.bizNo < b.bizNo ? -1 : a.bizNo > b.bizNo ? 1 : 0));
}

export type ReferralRate = { newCompanies: number; referred: number; rate: number | null };

/** 소개율: 신규 업체 중 소개한 업체가 기록된 비율 */
export function referralRate(newCompanies: { referrerBizNo: string | null }[]): ReferralRate {
  const referred = newCompanies.filter((c) => c.referrerBizNo !== null).length;
  return { newCompanies: newCompanies.length, referred, rate: newCompanies.length === 0 ? null : referred / newCompanies.length };
}
