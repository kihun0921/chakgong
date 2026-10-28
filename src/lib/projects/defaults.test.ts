import { describe, expect, it } from "vitest";
import { INITIAL_WORK, withDefaults } from "./types";

// 이전에 저장한 공사에는 이후에 생긴 입력 칸(노무비 합의서, 공정 구성, 회사 팩스 등)이 없다. 열 때 기본값으로 채워야 화면이 죽지 않는다.
describe("저장된 공사의 빠진 입력 칸 채우기", () => {
  it("이전 저장본(새 칸 없음)을 열어도 모든 입력 묶음이 있다", () => {
    const { laborAgreement: _l, composition: _c, direct: _d, remarks: _r, locations: _o, ...old } = INITIAL_WORK;
    void [_l, _c, _d, _r, _o];
    const oldGeneral = { ...INITIAL_WORK.general } as Record<string, unknown>;
    delete oldGeneral.companyFax;
    delete oldGeneral.reference;
    const w = withDefaults({ ...old, general: oldGeneral as typeof INITIAL_WORK.general });
    expect(w.laborAgreement).toEqual({ directLaborCost: "", billingDay: "5", paymentDay: "12", bankName: "", accountNo: "" });
    expect(w.composition).toBeNull();
    expect(w.remarks).toEqual({});
    expect(w.locations).toEqual([]);
    expect(w.direct.items).toEqual([]);
    expect(w.general.companyFax).toBe("");
    expect(w.general.reference).toBe("");
  });

  it("저장된 값은 덮어쓰지 않는다", () => {
    const w = withDefaults({ ...INITIAL_WORK, general: { ...INITIAL_WORK.general, projectName: "연천" }, laborAgreement: { ...INITIAL_WORK.laborAgreement, bankName: "신한은행" } });
    expect(w.general.projectName).toBe("연천");
    expect(w.laborAgreement.bankName).toBe("신한은행");
    expect(w.laborAgreement.billingDay).toBe("5"); // 빠진 칸만 채운다
  });
});
