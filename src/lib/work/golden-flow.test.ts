import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { round2 } from "@/domain/progress";
import { DAAI } from "@/domain/golden/daai-fixture";
import { detectLayout, loadWorkbook, parseBudget, type ParsedBudget } from "@/lib/budget/parse";
import { buildPlan, type ExtraLine } from "./buildPlan";
import {
  addProcess,
  checkComposition,
  defaultComposition,
  mergeProcesses,
  renameProcess,
  splitByChildren,
  splitManual,
  type Composition,
  type Edit,
} from "./composition";

// 처음부터 끝까지: 실제 제출 내역서 → 공정 구성 편집(나누기·합치기·직접 나누기·추가) → 가정 입력 → 계산.
// 결과가 기준 공정표(정답표)의 숫자와 같아야 한다. 환경변수 SAMPLE_DAAI(대아이앤씨 제출 내역서 xlsx 경로)가 있을 때만 돈다.
// 고객 자료라 저장소에 넣지 않는다.
const ok = <T,>(e: Edit<T>): T => {
  if (!e.ok) throw new Error(e.error);
  return e.value;
};

async function loadParsed(): Promise<ParsedBudget> {
  const wb = await loadWorkbook(new Uint8Array(readFileSync(process.env.SAMPLE_DAAI as string)));
  const layout = detectLayout(wb);
  if (!layout.ok) throw new Error(layout.reason);
  return parseBudget(wb, layout.mapping);
}

/** 정답표의 공정 편성(25개)과 같아지도록 편집한다. 사람이 화면에서 하는 순서와 같다. */
function composeLikeGolden(parsed: ParsedBudget): Composition {
  let comp = defaultComposition(parsed);
  const idOf = (name: string, from = comp) => {
    const d = from.find((x) => x.name === name);
    if (!d) throw new Error(`공정 '${name}'을 찾을 수 없습니다: ${from.map((x) => x.name).join(" / ")}`);
    return d.id;
  };
  const rename = (from: string, to: string) => {
    comp = renameProcess(comp, idOf(from), to);
  };

  // 0105 냉난방기: 내역서 소분류 그룹 5개로 나눈다
  comp = ok(splitByChildren(parsed, comp, idOf("냉난방기설치공사")));
  rename("히트펌프 냉난방기(물품)", "1.냉난방기 물품·판넬 반입");
  rename("냉매배관공사", "4.냉매배관공사");
  rename("드레인배관공사", "5.드레인배관공사");
  rename("제어기 및 제어선 설치공사", "6.제어기 및 제어선 설치공사");
  rename("배관커버 및 트레이 설치공사", "7.배관커버 및 트레이 설치공사");
  // 장비설치 그룹은 직접 나눈다: 실외기(크레인·받침대) / 실내기·점검구. 노무·장비 행(크레인)은 첫 부분이 받는다
  comp = ok(
    splitManual(comp, idOf("냉난방기설치공사 장비설치공사"), [
      { name: "2.실외기 양중·설치(옥상)", amount: 15_717_191, laborCost: 8_464_250 },
      { name: "3.실내기·점검구 설치", amount: 15_573_966, laborCost: 13_549_542 },
    ]),
  );

  // 0106 바닥공조: 층 그룹 16개 + 공용견적 → 층군 4개로 합치고 공용견적은 직접 나눈다
  comp = ok(splitByChildren(parsed, comp, idOf("바닥공조설치공사")));
  const floorIds = (from: number, to: number) =>
    comp.filter((d) => /^\d+층$/.test(d.name) && Number(d.name.replace("층", "")) >= from && Number(d.name.replace("층", "")) <= to).map((d) => d.id);
  comp = ok(mergeProcesses(comp, floorIds(2, 5), "2.FTU 이설·신설(2~5층)"));
  comp = ok(mergeProcesses(comp, floorIds(6, 9), "3.FTU 이설·신설(6~9층)"));
  comp = ok(mergeProcesses(comp, floorIds(10, 13), "4.FTU 이설·신설(10~13층)"));
  comp = ok(mergeProcesses(comp, floorIds(14, 17), "5.FTU 이설(14~17층)"));
  comp = ok(
    splitManual(comp, idOf("공용견적"), [
      { name: "1.설계검토 및 도면작업", amount: 5_000_000, laborCost: 0 },
      { name: "6.BMS 및 잡자재(공용)", amount: 60_165_000, laborCost: 0 },
    ]),
  );

  // 관급(분리발주) 4개 → 협조 공정 하나, 내역서에 없는 시운전·준공검사는 새로 추가(금액 없음)
  const gov = comp.filter((d) => ["0201", "0202", "0203", "0204"].includes(d.id)).map((d) => d.id);
  comp = ok(mergeProcesses(comp, gov, "1.관급(분리발주) 공정 협조"));
  comp = ok(addProcess(comp, "2.시운전·준공검사 및 정리"));

  // 나머지 공종은 이름만 정답표와 같게
  rename("장비설치공사", "Ⅲ. 장비설치공사");
  rename("공조덕트설치공사", "Ⅳ. 공조덕트설치공사");
  rename("위생기구설치공사", "3.위생기구설치공사");
  rename("급수급탕배관공사", "1.급수급탕배관공사");
  rename("오배수배관공사", "2.오배수배관공사");
  rename("철거공사", "Ⅱ. 철거공사");
  rename("바닥난방설치공사", "Ⅷ. 바닥난방설치공사");
  rename("기계설비T.A.B공사", "Ⅸ. 기계설비 T.A.B공사");
  rename("안전관리비작성용역", "2.안전관리비 작성용역");
  rename("가설사무소공사", "1.가설사무소·창고 설치및해체");
  return comp;
}

describe.skipIf(!process.env.SAMPLE_DAAI)("실제 제출 내역서 → 공정 편성 → 기준 공정표 재현", () => {
  it("편성한 공정 25개의 이름·금액이 기준 공정표와 같고 금액 합이 집계표와 같다", async () => {
    const parsed = await loadParsed();
    const comp = composeLikeGolden(parsed);
    expect(comp).toHaveLength(25);
    expect(checkComposition(parsed, comp).ok).toBe(true);
    const gold = new Map<string, number>(DAAI.processes.map((p) => [p.name, p.amount]));
    for (const d of comp) expect(gold.get(d.name), `공정 금액 ${d.name}`).toBe(d.amount);
    expect(new Set(comp.map((d) => d.name))).toEqual(new Set(DAAI.processes.map((p) => p.name)));
  }, 60_000);

  it("같은 일정·가정으로 계산하면 진도율·인원·장비가 기준 공정표와 같다", async () => {
    const parsed = await loadParsed();
    const comp = composeLikeGolden(parsed);
    const idByName = new Map(comp.map((d) => [d.name, d.id]));
    const goldKeyName = new Map<string, string>(DAAI.keys.map((k) => [k.key, k.name.trim()]));
    const idOfKey = (key: string) => idByName.get(goldKeyName.get(key)!)!;

    // 일정: 기준 공정표의 착수·완료 일차
    const schedule = Object.fromEntries(DAAI.processes.map((p) => [idByName.get(p.name)!, { startDay: p.startDay, endDay: p.endDay }]));

    // 가정 인원: 노무비 환산은 공정 노무비 × 배분율 ÷ 노임단가, 그 밖의 가정은 인일을 직접 입력
    let n = 0;
    const extraLabor: ExtraLine[] = DAAI.laborDetail
      .filter((l) => l.method !== "내역서")
      .map((l) =>
        l.method === "환산"
          ? { id: ++n, processKey: idOfKey(l.key), name: l.trade, perDay: 0, workdays: 0, mode: "cost" as const, share: l.ratio ?? 0, wage: l.wage ?? 0 }
          : { id: ++n, processKey: idOfKey(l.key), name: l.trade, perDay: 0, workdays: 0, mode: "days" as const, manDays: l.manDays },
      );
    // 가정 장비: 대수 × 일수. 크레인은 내역서의 HR 행에서 오므로 넣지 않는다
    const extraEquipment: ExtraLine[] = DAAI.equipDetail
      .filter((e) => !e.name.startsWith("타이어크레인"))
      .map((e) => ({ id: ++n, processKey: idOfKey(e.key), name: e.name, perDay: e.units, workdays: e.days }));

    const out = buildPlan({
      parsed,
      startDate: DAAI.start,
      durationDays: String(DAAI.durationDays),
      holidaysText: DAAI.holidays.join(" "),
      schedule,
      composition: comp,
      extraLabor,
      extraEquipment,
    });
    expect(out.error).toBeUndefined();
    const r = out.result!;
    expect(r.validation).toEqual({ passed: true, issues: [] });
    expect(out.warnings.filter((w) => w.includes("제외"))).toEqual([]);

    expect(r.completion).toBe("2027-01-10");
    expect(r.progress.cumulative.map(round2)).toEqual([2.99, 34.17, 67.34, 95.98, 100]);
    expect(r.progress.periodTotals.map(round2)).toEqual([...DAAI.expected.periodProgress]);
    expect(r.labor.total).toBe(1338);
    expect(r.equipment.total).toBe(296);
    expect(r.labor.byName).toEqual(DAAI.expected.labor);
    // 장비 이름만 표기가 다르다: 내역서 '크레인(타이어) 100ton' ↔ 정답표 '타이어크레인 100T'
    const equip = Object.fromEntries(Object.entries(r.equipment.byName).map(([k, v]) => [k === "크레인(타이어) 100ton" ? "타이어크레인 100T" : k, v]));
    expect(equip).toEqual(DAAI.expected.equipment);
    expect(r.labor.periodTotals).toEqual([...DAAI.expected.laborPeriodTotals]);
    expect(r.equipment.periodTotals).toEqual([...DAAI.expected.equipmentPeriodTotals]);
    expect(r.dailyAverage.map((v) => (v === null ? null : round2(v)))).toEqual([...DAAI.expected.dailyAverage]);

    // 내역서 수량(●)으로 들어간 노무가 가정 환산과 섞이지 않았다: 급수급탕 배관공 44는 급수급탕 공정으로
    const wsup = r.labor.basisList.find((b) => b.name === "배관공" && b.processKey === idByName.get("1.급수급탕배관공사"));
    expect(wsup).toMatchObject({ manDays: 44, method: "내역서" });
  }, 60_000);
});
