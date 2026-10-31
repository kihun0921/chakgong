import { describe, expect, it } from "vitest";
import { buildDivider, generateDocs } from "./build";
import { sampleEngineer, sampleInput } from "./fixtures";
import { DEFAULT_TOC_ORDER, type DocInput, type DocSpec, type GridCell } from "./model";

// 실제 제출본(연천읍지구 착공계 한 세트)의 양식·문안·구성 순서를 따르는지 확인한다.
const consortium = sampleInput({
  contractType: "지방",
  receiver: "경기도 연천군청",
  contractAgency: "경기도 연천군청",
  reference: "안전총괄과",
  docNumber: "가나 제 2026-03-001 호",
  copies: "2",
  company: { name: "가나종합건설㈜", representative: "김대표", address: "서울특별시 가나구 다라로 1", phone: "02-000-0001", bizNo: "000-00-00000", fax: "02-000-0002", mobile: "010-0000-0000" },
  jointMembers: [
    { id: "j2", name: "㈜다라파트너스", representative: "최대표", shareRate: "", isLead: false },
    { id: "j1", name: "가나종합건설㈜", representative: "김대표", shareRate: "", isLead: true },
    { id: "j3", name: "마바건설㈜", representative: "박대표", shareRate: "", isLead: false },
  ],
  contractAmount: 17_511_921_000,
  budgetDirectLabor: 5_549_924_648,
  laborAgreement: { directLaborCost: "", billingDay: "5", paymentDay: "12", bankName: "신한은행", accountNo: "000-000-000000" },
});

function gen(input: DocInput) {
  const r = generateDocs(input);
  if (!r.ok) throw new Error(r.missing.join());
  return r;
}
const byId = (specs: DocSpec[], id: string) => specs.find((s) => s.id === id)!;
const json = (s: DocSpec) => JSON.stringify(s.blocks);
const grid = (s: DocSpec) => s.blocks.find((b) => b.type === "grid") as Extract<DocSpec["blocks"][number], { type: "grid" }>;
const cellsOf = (g: { cells: GridCell[] }) => g.cells.map((c) => c.text);
// JSON 문자열 안에서 역슬래시는 두 번 쓰인다
const WON = "\\\\";

describe("기본 목차 순서와 합본 구성 (실제 제출본)", () => {
  it("기본 순서는 현장기술자 → 조직도 → 품질 → 안전 → 환경 → 공정표 → 인원장비 → 사진 → 고용·산재 → 계약서 → 내역서 → 직접시공 → 노무비 합의서 → 직불조건부 → 하도급지킴이", () => {
    expect(DEFAULT_TOC_ORDER).toEqual([1, 15, 14, 3, 8, 4, 9, 10, 11, 5, 6, 12, 7, 13, 2]);
  });

  it("제출서류 목차는 쪽수 없는 '-.' 목록이다", () => {
    const toc = byId(gen(consortium).specs, "toc");
    const items = toc.blocks.filter((b) => b.type === "paragraph").map((b) => (b as { text: string }).text);
    expect(items.slice(0, 3)).toEqual(["-. 현장기술자 지정신고서", "-. 조직도", "-. 품질관리계획서"]);
    expect(items).toHaveLength(15);
    expect(toc.blocks.some((b) => b.type === "table")).toBe(false);
  });

  it("앞부분은 공문 → 착공신고서 표지 → 착공계 → 목차 순서로 만들어진다", () => {
    const ids = gen(consortium).specs.map((s) => s.id);
    expect(ids.slice(0, 4)).toEqual(["cover", "coverStart", "startNotice", "toc"]);
  });

  it("현장기술자 지정신고서는 표지 → 목차 → 선임계·재직증명서(사용인감신고서는 현장대리인만) 순이고 기술인은 역할 순서로 나온다", () => {
    const input = sampleInput({
      engineers: [
        sampleEngineer({ id: "s", role: "safetyManager", name: "안전" }),
        sampleEngineer({ id: "q2", role: "qualitySub", name: "보조" }),
        sampleEngineer({ id: "m", role: "siteManager", name: "대리인" }),
        sampleEngineer({ id: "q1", role: "qualityMain", name: "주력" }),
      ],
    });
    const ids = gen(input).specs.map((s) => s.id);
    const from = ids.indexOf("coverEngineers");
    expect(ids.slice(from, from + 12)).toEqual([
      "coverEngineers",
      "engineersToc",
      "appointment:m",
      "employment:m",
      "seal:m",
      "appointment:q1",
      "employment:q1",
      "appointment:q2",
      "employment:q2",
      "appointment:s",
      "employment:s",
      "org",
    ]);
  });
});

describe("공문과 착공계", () => {
  const specs = gen(consortium).specs;

  it("공문: 회사 머리글(주소·전화·팩스), 문서번호·수신·참조·제목, 제출서류 부수, 대표이사 서명", () => {
    const s = byId(specs, "cover");
    const t = json(s);
    expect(s.blocks[0]).toMatchObject({ type: "letterhead", title: "가나종합건설㈜" });
    expect(t).toContain("T. 02-000-0001 F. 02-000-0002");
    expect(t).toContain("가나 제 2026-03-001 호");
    expect(t).toContain("경기도 연천군청");
    expect(t).toContain("안전총괄과");
    expect(t).toContain("착공서류제출");
    expect(t).toContain("1. 착공 서류 일체 2부.");
    expect(t).toContain("가나종합건설㈜ 대표이사 김대표");
    expect(t).toContain("귀 청의"); // 수신이 '청'으로 끝나는 기관
  });

  it("착공계: 계약금액을 한글로 함께 쓰고 붙임은 품질관리자 주력·보조를 구분한다", () => {
    const withSub = sampleInput({
      ...consortium,
      engineers: [
        sampleEngineer({ id: "m", role: "siteManager", name: "대리인" }),
        sampleEngineer({ id: "q1", role: "qualityMain", name: "주력" }),
        sampleEngineer({ id: "q2", role: "qualitySub", name: "보조" }),
      ],
    });
    const t = json(byId(gen(withSub).specs, "startNotice"));
    expect(t).toContain("금일백칠십오억일천일백구십이만일천원정 ( ₩17,511,921,000원)");
    expect(t).toContain("품질관리인 선임계(주력,보조인력) 각1부.");
    expect(json(byId(gen(consortium).specs, "startNotice"))).toContain("품질관리인 선임계 1부.");
  });

  it("공동수급체가 있으면 간지에 대표사를 먼저 모든 회사가 나온다", () => {
    const s = byId(specs, "coverStart");
    expect(s.frame).toBe(true);
    expect(s.blocks[0]).toMatchObject({ type: "cover", title: "착공신고서", names: ["가나종합건설㈜", "㈜다라파트너스", "마바건설㈜"] });
  });

  it("간지 이름은 실제 제출본과 같다", () => {
    const names = specs.filter((s) => s.id.startsWith("divider:")).map((s) => (s.blocks[0] as { title: string }).title);
    expect(names).toEqual(["품질관리계획서", "안전관리계획서", "환경관리계획서", "공사예정공정표", "고용,산재보험 가입증명원", "공사도급계약서", "공사도급내역서", "직접시공계획서"]);
    expect(buildDivider(consortium, "X", 99).toc).toEqual([99]);
  });
});

describe("선임계·재직증명서·사용인감신고서", () => {
  const input = sampleInput({
    engineers: [
      sampleEngineer({ id: "m", role: "siteManager", name: "김대리", techField: "토목분야", grade: "특급기술자", licenseNo: "G001", address: "경기 고양시" }),
      sampleEngineer({ id: "q", role: "qualityMain", name: "허품질", techField: "품질", grade: "특급", licenseNo: "Q001" }),
    ],
  });
  const specs = gen(input).specs;

  it("선임계: 제목, 인적 사항, 고정 문안, 첨부문서 3종", () => {
    const t = json(byId(specs, "appointment:m"));
    expect(t).toContain("현 장 대 리 인 선 임 계");
    expect(t).toContain("토목분야 특급기술자");
    expect(t).toContain("상기 공사에 대하여 위 사람을 현장대리인으로 선임하여 선임계를 제출합니다.");
    expect(t).toContain("1. 건설기술자 재직 증명서 1부");
    expect(t).toContain("3. 건설기술자 경력 증명서 1부");
    // 품질관리자는 주력이든 보조든 제목이 '품질관리자 선임계'
    expect(json(byId(specs, "appointment:q"))).toContain("품 질 관 리 자 선 임 계");
  });

  it("재직증명서: 표 양식에 성명·주민번호·면허·입사일과 고정 문안이 들어간다", () => {
    const g = grid(byId(specs, "employment:m"));
    expect(g.outer).toBe(true);
    const t = cellsOf(g).join("|");
    expect(t).toContain("김대리");
    expect(t).toContain("800101-1000000");
    expect(t).toContain("상기자는 당사에 재직 중 임을 증명합니다.");
  });

  it("사용인감신고서는 현장대리인에게만 만들고 고정 문안이 들어간다", () => {
    expect(specs.some((s) => s.id === "seal:m")).toBe(true);
    expect(specs.some((s) => s.id === "seal:q")).toBe(false);
    expect(json(byId(specs, "seal:m"))).toContain("위 인감은 공사현장 대리인이 사용하는 인감으로서 향후 관급자재 수령 및 반납시등에 위 인감을 사용코저 제출합니다.");
  });
});

describe("노무비 구분관리 및 지급확인제 합의서 (서식1-1, 지방계약)", () => {
  it("지방계약이면 제1~11조 문안과 계약 정보·청구일·계좌가 들어간다 (직접노무비는 내역서 값)", () => {
    const s = byId(gen(consortium).specs, "laborAgreement");
    const t = json(s);
    for (let n = 1; n <= 11; n++) expect(t).toContain(`제${n}조`);
    expect(t).toContain("행정안전부 예규");
    expect(t).toContain(`금일백칠십오억일천일백구십이만일천원 ( ${WON}17,511,921,000원)`);
    expect(t).toContain(`금오십오억사천구백구십이만사천육백사십팔원(${WON}5,549,924,648원)`);
    expect(t).toContain("000-00-00000");
    expect(t).toContain("신한은행");
    expect(t).toContain("000-000-000000");
    expect(t).toContain("매월 5 일");
    expect(s.toc).toEqual([7]);
    expect(s.blocks.some((b) => b.type === "pagebreak")).toBe(true); // 2쪽
  });

  it("직접노무비를 직접 적으면 내역서 값 대신 그 값을 쓴다", () => {
    const t = json(byId(gen({ ...consortium, laborAgreement: { ...consortium.laborAgreement!, directLaborCost: "1,000,000" } }).specs, "laborAgreement"));
    expect(t).toContain(`금일백만원(${WON}1,000,000원)`);
  });

  it("국가계약은 근거 조항 문안 샘플이 없어 만들지 않는다(임의 작성 금지)", () => {
    expect(gen({ ...consortium, contractType: "국가" }).specs.some((s) => s.id === "laborAgreement")).toBe(false);
  });
});

describe("확약서 3종", () => {
  const specs = gen(consortium).specs;
  const direct = byId(specs, "pledge:direct");
  const keeper = byId(specs, "pledge:keeper");
  const jobs = byId(specs, "pledge:jobs");

  it("목차 번호: 직불조건부는 13, 하도급지킴이와 일자리알리미는 2", () => {
    expect(direct.toc).toEqual([13]);
    expect(keeper.toc).toEqual([2]);
    expect(jobs.toc).toEqual([2]);
  });

  it("고정 문안이 실제 제출본과 같다", () => {
    expect(json(direct)).toContain("하도급대금 직불조건부 입찰참가 확약서");
    expect(json(direct)).toContain("「건설산업기본법」 제34조제1항 또는 「하도급거래 공정화에 관한 법률」 제13조제1항 이나 제3항을 위반하여");
    expect(json(keeper)).toContain("「하도급지킴이」이용 확약서");
    expect(json(keeper)).toContain("“인출 제한” 기능을 사용하겠습니다.");
    expect(json(jobs)).toContain("「공공건설 일자리알리미」 이용 확약서");
    expect(json(jobs)).toContain("전자계약서를 적극 활용하겠습니다.");
  });

  it("서약자는 공동수급체 회사 모두(대표사 먼저)와 대표자, 수신처 귀하", () => {
    const t = json(direct);
    expect(t.indexOf("가나종합건설㈜")).toBeLessThan(t.indexOf("㈜다라파트너스"));
    expect(t).toContain("대표자 : 최대표");
    expect(t).toContain("대표자 : 박대표");
    expect(t).toContain("경기도 연천군청 귀하");
    expect(direct.frame).toBe(true);
  });

  it("공동수급체가 아니면 시공사 하나가 서약자다", () => {
    const solo = byId(gen(sampleInput({ jointMembers: [], contractType: "지방" })).specs, "pledge:keeper");
    expect(json(solo)).toContain("회사명 : 시험건설");
  });
});
