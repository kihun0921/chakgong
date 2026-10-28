// 착공계 서류의 실제 제출 양식 (기준: 연천읍지구 풍수해생활권 종합정비사업 착공계 한 세트)
// 법정 고정 문안은 그 샘플에서 그대로 옮긴 것이다. 임의로 고치지 않는다. 샘플에 없는 문안(국가계약용 합의서 근거 조항 등)은 만들지 않는다.

import { koreanDate, blankableDate, formatRrn, gwa, koreanWon } from "./format";
import { commonFacts, consortiumMembers, eulo, period, receiverName, receiverOf, shortDate, spaceTitle } from "./common";
import {
  ROLE_LABEL,
  TOC_ITEMS,
  type Block,
  type DocInput,
  type DocSpec,
  type Engineer,
  type FactKey,
  type GridCell,
} from "./model";

// ── 공통 조각 ─────────────────────────────────────────────

const ymdSpaced = (s: string) => {
  if (s === "") return "      년      월      일";
  const [y, m, d] = s.split("-");
  return `${y} 년 ${m} 월 ${d} 일`;
};

/** 'yy.m.d' (안전보건관리책임자 선임서의 공사기간 표기) */
const yymd = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${y.slice(2)}.${Number(m)}.${Number(d)}`;
};

const dotYmd = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${y}.${Number(m)}.${Number(d)}`;
};

const gap = (size = 16): Block => ({ type: "spacer", size });

/** 제출일 아래의 회사 표기(주소·상호·대표자) — 오른쪽 */
function companyPairs(i: DocInput): Block {
  return {
    type: "pairs",
    indent: 230,
    labelWidth: 58,
    rows: [
      { label: "주 소", value: i.company.address },
      { label: "상 호", value: i.company.name },
      { label: "대 표 자", value: i.company.representative },
    ],
  };
}

const recipientLine = (i: DocInput): Block => ({ type: "paragraph", text: receiverOf(i), bold: true, size: 15 });

/** 공동수급체 전체(없으면 시공사 하나)의 이름 */
const namesOf = (i: DocInput) => consortiumMembers(i).map((m) => m.name);

// ── 공문 ─────────────────────────────────────────────────

export function buildCoverLetter(i: DocInput): DocSpec {
  const attachNote = `1. 착공 서류 일체 ${i.copies || "1"}부.    끝.`;
  const honor = receiverName(i).includes("청") ? "귀 청" : "귀 기관";
  const contact = [i.company.address, [`T. ${i.company.phone}`, i.company.fax ? `F. ${i.company.fax}` : ""].filter(Boolean).join(" ")].filter((x) => x.trim() !== "").join(" ");
  return {
    id: "cover",
    title: "공문(착공서류 제출)",
    toc: [],
    facts: commonFacts(i),
    blocks: [
      { type: "letterhead", title: i.company.name, subtitle: contact },
      {
        type: "pairs",
        indent: 8,
        labelWidth: 58,
        size: 10.5,
        rows: [
          { label: "문서번호", value: i.docNumber },
          { label: "수 신", value: receiverName(i) },
          { label: "참 조", value: i.reference ?? "" },
        ],
      },
      gap(8),
      { type: "pairs", indent: 8, labelWidth: 58, size: 10.5, rows: [{ label: "제 목", value: "착공서류제출" }] },
      { type: "rule", thick: true },
      { type: "paragraph", text: `1. ${honor}의 무궁한 발전을 기원합니다.`, indent: 8 },
      { type: "paragraph", text: `2. “${i.projectName}”${gwa(i.projectName)} 관련하여 아래와 같이 착공계를 제출합니다.`, indent: 8 },
      gap(70),
      { type: "paragraph", text: "-  아            래  -", align: "center" },
      gap(50),
      { type: "paragraph", text: "※ 제출서류", indent: 8 },
      { type: "paragraph", text: attachNote, indent: 8 },
      gap(110),
      { type: "paragraph", text: `${i.company.name} 대표이사 ${i.company.representative}`, align: "center", bold: true, size: 20 },
    ],
  };
}

// ── 간지(표지) ───────────────────────────────────────────

export function buildCover(i: DocInput, name: string, toc: number[], id: string): DocSpec {
  return {
    id,
    title: `간지 — ${name}`,
    toc,
    frame: true,
    facts: commonFacts(i),
    blocks: [{ type: "cover", title: name, projectName: i.projectName, dateText: shortDate(i, false), names: namesOf(i) }],
  };
}

// ── 착공계 ───────────────────────────────────────────────

export function buildStartNotice(i: DocInput): DocSpec {
  const p = period(i);
  const hasSub = i.engineers.some((e) => e.role === "qualitySub");
  const enclosures = [
    "현장대리인 선임계 1부.",
    hasSub ? "품질관리인 선임계(주력,보조인력) 각1부." : "품질관리인 선임계 1부.",
    "안전관리인 선임계 1부.",
    "예정공정표 1부.",
  ];
  return {
    id: "startNotice",
    title: "착공계",
    toc: [],
    facts: {
      ...commonFacts(i),
      contractAmount: String(i.contractAmount),
      startDate: p.start,
      completionDate: p.end,
      contractAgency: i.contractAgency,
    },
    blocks: [
      { type: "title", text: "착 공 계" },
      gap(24),
      {
        type: "pairs",
        indent: 8,
        labelWidth: 80,
        gap: 9,
        rows: [
          { label: "공 사 명", value: i.projectName },
          { label: "계 약 금 액", value: `금${koreanWon(i.contractAmount)}정 ( ₩${i.contractAmount.toLocaleString("ko-KR")}원)` },
          { label: "계약년월일", value: koreanDate(i.contractDate) },
          { label: "착공년월일", value: koreanDate(p.start) },
          { label: "준공년월일", value: koreanDate(p.end) },
        ],
      },
      gap(14),
      { type: "paragraph", text: "위와 같이 착공하기에 소정의 서류를 첨부하여 착공신고서를 제출합니다.", align: "center" },
      gap(8),
      {
        type: "pairs",
        indent: 62,
        labelWidth: 28,
        gap: 7,
        rows: enclosures.map((t, k) => ({ label: k === 0 ? "붙임" : "", value: `${k + 1}. ${t}` })),
      },
      gap(70),
      { type: "paragraph", text: blankableDate(i.submitDate), align: "center" },
      gap(36),
      companyPairs(i),
      gap(46),
      recipientLine(i),
    ],
  };
}

// ── 제출서류 목차 ─────────────────────────────────────────

export function buildToc(i: DocInput): DocSpec {
  return {
    id: "toc",
    title: "제출서류 목차",
    toc: [],
    facts: { projectName: i.projectName },
    blocks: [
      { type: "title", text: "【목    차】" },
      gap(8),
      ...i.tocOrder.map<Block>((n) => ({ type: "paragraph", text: `-. ${TOC_ITEMS[n] ?? `서류 ${n}`}`, indent: 60, bold: true, size: 11.5, leading: 1.3 })),
    ],
  };
}

// ── 현장기술자 지정신고서: 목차 ────────────────────────────

const ROLE_ORDER: Engineer["role"][] = ["siteManager", "qualityMain", "qualitySub", "safetyManager"];
export const sortedEngineers = (i: DocInput) => [...i.engineers].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));

export function buildEngineersToc(i: DocInput): DocSpec {
  const has = (r: Engineer["role"]) => i.engineers.some((e) => e.role === r);
  const common = ["재직증명서", "국가기술자격증사본", "건설기술자 경력증명서"];
  const groups: { head: string; items: string[] }[] = [];
  if (has("siteManager")) groups.push({ head: "현장대리인 선임계", items: [...common, "현장대리인 사용인감신고서"] });
  if (has("qualityMain") || has("qualitySub")) groups.push({ head: `품질관리자 선임계${has("qualitySub") ? "(주력, 보조인력)" : ""}`, items: common });
  if (has("safetyManager")) groups.push({ head: "안전관리자 선임계", items: common });
  const blocks: Block[] = [{ type: "title", text: "【목    차】" }, gap(8)];
  groups.forEach((g, n) => {
    blocks.push({ type: "paragraph", text: `${n + 1}. ${g.head}`, indent: 56, bold: true, size: 11.5, leading: 1.3 });
    g.items.forEach((t) => blocks.push({ type: "paragraph", text: `-. ${t}`, indent: 82, size: 11, leading: 1.3 }));
    blocks.push(gap(10));
  });
  return { id: "engineersToc", title: "현장기술자 지정신고서 목차", toc: [1], facts: { projectName: i.projectName }, blocks };
}

// ── 선임계 ───────────────────────────────────────────────

const attachmentLines = "1. 건설기술자 재직 증명서 1부\n2. 건설기술자 자격 수첩사본 1부\n3. 건설기술자 경력 증명서 1부              -끝-";

export function buildAppointment(i: DocInput, e: Engineer): DocSpec {
  // 품질관리자 주력·보조 모두 제목은 '품질관리자 선임계'
  const role = e.role === "qualitySub" || e.role === "qualityMain" ? "품질관리자" : ROLE_LABEL[e.role];
  const field = `${e.techField} ${e.grade}`.trim();
  return {
    id: `appointment:${e.id}`,
    title: `${ROLE_LABEL[e.role]} 선임계`,
    toc: [1],
    facts: { ...commonFacts(i), [`engineer:${e.id}`]: e.name },
    blocks: [
      { type: "title", text: spaceTitle(`${role}선임계`) },
      gap(20),
      { type: "pairs", indent: 0, labelWidth: 78, gap: 6, size: 10, rows: [{ label: "공 사 명", value: i.projectName }, { label: role, value: e.name }] },
      {
        type: "pairs",
        indent: 78,
        labelWidth: 78,
        gap: 5,
        size: 9.5,
        rows: [
          { label: "주 소", value: e.address },
          { label: "주민등록번호", value: formatRrn(e.rrn) },
          { label: "기 술 종 목", value: field },
          { label: "기술면허번호", value: e.licenseNo },
        ],
      },
      gap(18),
      { type: "paragraph", text: `상기 공사에 대하여 위 사람을 ${role}${eulo(role)} 선임하여 선임계를 제출합니다.`, indent: 40, size: 10 },
      gap(36),
      { type: "pairs", indent: 0, labelWidth: 78, size: 9.5, rows: [{ label: "첨 부 문 서", value: attachmentLines }] },
      gap(24),
      { type: "paragraph", text: blankableDate(i.submitDate), align: "center", size: 10 },
      gap(26),
      companyPairs(i),
      gap(60),
      recipientLine(i),
    ],
  };
}

// ── 재직증명서 (표 양식) ──────────────────────────────────

export function buildEmployment(i: DocInput, e: Engineer): DocSpec {
  const cell = (r: number, c: number, text: string, o: Partial<GridCell> = {}): GridCell => ({ r, c, text, align: "center", ...o });
  const cells: GridCell[] = [
    cell(0, 0, "성   명"),
    cell(0, 1, e.name, { cs: 5, spaced: true, bold: true }),
    cell(1, 0, "생년월일"),
    cell(1, 1, ymdSpaced(e.birthDate), { cs: 3 }),
    cell(1, 4, "주민등록번호"),
    cell(1, 5, formatRrn(e.rrn)),
    cell(2, 0, "주   소"),
    cell(2, 1, e.address, { cs: 5 }),
    cell(3, 0, "면허종목"),
    cell(3, 1, e.techField),
    cell(3, 2, "등 급"),
    cell(3, 3, e.grade),
    cell(3, 4, "등 록 번 호"),
    cell(3, 5, e.licenseNo),
    cell(4, 0, "입사일자"),
    cell(4, 1, ymdSpaced(e.hireDate), { cs: 5 }),
    cell(5, 0, "상기자는 당사에 재직 중 임을 증명합니다.", { cs: 6, noBorder: true, bold: true }),
    cell(6, 0, blankableDate(i.submitDate), { cs: 6, noBorder: true }),
    cell(7, 3, "주   소", { noBorder: true, align: "right" }),
    cell(7, 4, i.company.address, { cs: 2, noBorder: true, align: "left", bold: true }),
    cell(8, 3, "상   호", { noBorder: true, align: "right" }),
    cell(8, 4, i.company.name, { cs: 2, noBorder: true, align: "left", bold: true }),
    cell(9, 3, "대 표 자", { noBorder: true, align: "right" }),
    cell(9, 4, i.company.representative, { cs: 2, noBorder: true, align: "left", bold: true }),
    cell(10, 0, receiverOf(i), { cs: 6, noBorder: true, align: "left", valign: "bottom", bold: true, size: 14 }),
  ];
  return {
    id: `employment:${e.id}`,
    title: `${ROLE_LABEL[e.role]} 재직증명서`,
    toc: [1],
    facts: { ...commonFacts(i), [`engineer:${e.id}`]: e.name },
    blocks: [
      { type: "title", text: "건설기술자 재직 증명서" },
      gap(8),
      { type: "grid", outer: true, cols: [77, 50, 45, 75, 72, 140], rowHeights: [36, 36, 36, 36, 36, 150, 70, 44, 26, 26, 90], cells },
    ],
  };
}

// ── 현장대리인 사용인감 신고서 ─────────────────────────────

export function buildSeal(i: DocInput, e: Engineer): DocSpec {
  return {
    id: `seal:${e.id}`,
    title: "현장대리인 사용인감 신고서",
    toc: [1],
    facts: { ...commonFacts(i), [`engineer:${e.id}`]: e.name },
    blocks: [
      { type: "title", text: "현장대리인 사용인감 신고서" },
      gap(40),
      {
        type: "grid",
        cols: [95, 388],
        rowHeights: [104],
        cells: [
          { r: 0, c: 0, text: "사용인감", align: "center", valign: "top", size: 10 },
          { r: 0, c: 1, noBorder: true, text: `주        소  :  ${i.company.address}\n\n상        호  :  ${i.company.name}\n\n현 장 대 리 인  :  ${e.name}`, size: 10 },
        ],
      },
      gap(40),
      { type: "pairs", indent: 0, labelWidth: 60, size: 10, rows: [{ label: "공 사 명", value: i.projectName }] },
      gap(16),
      {
        type: "paragraph",
        text: "위 인감은 공사현장 대리인이 사용하는 인감으로서 향후 관급자재 수령 및 반납시등에 위 인감을 사용코저 제출합니다.",
        indent: 40,
        size: 10,
        leading: 2.2,
      },
      gap(40),
      { type: "paragraph", text: blankableDate(i.submitDate), align: "center", size: 10 },
      gap(40),
      companyPairs(i),
      gap(50),
      recipientLine(i),
    ],
  };
}

// ── 안전보건관리책임자 선임서 (공식 표 양식) ────────────────

export function buildSafetyChief(i: DocInput, chief: Engineer): DocSpec {
  const p = period(i);
  const s = i.siteScale;
  const owner = (i.demandAgency || i.contractAgency).trim();
  const C = (r: number, c: number, text: string, o: Partial<GridCell> = {}): GridCell => ({ r, c, text, align: "center", size: 8.5, ...o });
  const L = (r: number, c: number, text: string, o: Partial<GridCell> = {}) => C(r, c, text, { bold: false, ...o });
  const cells: GridCell[] = [
    C(0, 0, "안전보건관리책임자 선임서", { cs: 9, size: 17, bold: true }),
    L(1, 0, "본\n사", { rs: 2 }),
    L(1, 1, "① 사 업 장 명"),
    L(1, 2, i.company.name, { cs: 3 }),
    L(1, 5, "② 사업주 또는\n대 표 자", { cs: 2 }),
    L(1, 7, i.company.representative, { cs: 2 }),
    L(2, 1, "③ 소 재 지"),
    L(2, 2, i.company.address, { cs: 5, align: "left" }),
    L(2, 7, i.company.phone, { cs: 2 }),
    L(3, 0, "현\n장\n개\n요", { rs: 6 }),
    L(3, 1, "④ 현 장 명"),
    L(3, 2, i.projectName, { cs: 3 }),
    L(3, 5, "⑤ 발주자\n또는 도급인", { cs: 2 }),
    L(3, 7, owner, { cs: 2 }),
    L(4, 1, "⑥ 소 재 지"),
    L(4, 2, i.siteAddress, { cs: 3 }),
    L(4, 5, "(전화:                    )", { cs: 4, align: "right" }),
    L(5, 1, "⑦ 공 사 기 간"),
    L(5, 2, `${yymd(p.start)}   ~   ${yymd(p.end)}`, { cs: 3 }),
    L(5, 5, "⑧ 공 사 금 액", { cs: 2 }),
    L(5, 7, `₩${i.contractAmount.toLocaleString("ko-KR")}`, { cs: 2 }),
    L(6, 1, "⑨상시근로자수"),
    L(6, 2, s.workerCount, { cs: 3 }),
    L(6, 5, "⑩ 굴착깊이(M)", { cs: 2 }),
    L(6, 7, s.excavationDepth, { cs: 2 }),
    L(7, 1, "⑪건축물·공작물의\n최대높이(M)"),
    L(7, 2, s.maxHeight, { cs: 3 }),
    L(7, 5, "⑫ 교량의 최대\n지간거리(M)", { cs: 2 }),
    L(7, 7, s.maxBridgeSpan, { cs: 2 }),
    L(8, 1, "⑬ 터널길이(M)"),
    L(8, 2, s.tunnelLength, { cs: 3 }),
    L(8, 5, "⑭ 제방높이(M)", { cs: 2 }),
    L(8, 7, s.embankmentHeight, { cs: 2 }),
    L(9, 0, "내  역  /  구  분", { cs: 2 }),
    L(9, 2, "성  명"),
    L(9, 3, "자  격"),
    L(9, 4, "선임 년월일", { cs: 2 }),
    L(9, 6, "직위 및 직책", { cs: 2 }),
    L(9, 8, "전담·겸임 구분"),
    L(10, 0, "안전보건관리책임자", { cs: 2 }),
    L(10, 2, chief.name),
    L(10, 3, `${chief.techField} ${chief.grade}`.trim()),
    L(10, 4, dotYmd(p.start), { cs: 2 }),
    L(10, 6, chief.position, { cs: 2 }),
    L(10, 8, chief.dedicated),
    C(11, 0, "「산업안전보건법 시행규칙」 제14조 1항의 규정에 의하여\n위와 같이 선임합니다.", { cs: 9, noBorder: true, size: 10.5 }),
    C(12, 0, blankableDate(i.submitDate), { cs: 9, noBorder: true, size: 10 }),
    C(13, 4, "주   소 :", { noBorder: true, align: "right", size: 9.5 }),
    C(13, 5, i.company.address, { cs: 4, noBorder: true, align: "left", size: 9.5 }),
    C(14, 4, "상   호 :", { noBorder: true, align: "right", size: 9.5 }),
    C(14, 5, i.company.name, { cs: 4, noBorder: true, align: "left", size: 9.5 }),
    C(15, 4, "대 표 자 :", { noBorder: true, align: "right", size: 9.5 }),
    C(15, 5, i.company.representative, { cs: 4, noBorder: true, align: "left", size: 9.5 }),
    C(16, 0, receiverOf(i), { cs: 9, noBorder: true, align: "left", valign: "bottom", bold: true, size: 14 }),
  ];
  return {
    id: "safetyChief",
    title: "안전보건관리책임자 선임서",
    toc: [15],
    facts: {
      ...commonFacts(i),
      contractAmount: String(i.contractAmount),
      startDate: p.start,
      completionDate: p.end,
      [`engineer:${chief.id}`]: chief.name,
    },
    blocks: [{ type: "grid", outer: true, cols: [20, 90, 72, 45, 53, 37, 51, 37, 57], rowHeights: [44, 34, 34, 34, 34, 34, 30, 38, 30, 38, 34, 90, 46, 36, 24, 24, 80], cells }],
  };
}

// ── 현장관리조직도 ─────────────────────────────────────────

export type OrgChartData = Extract<Block, { type: "orgchart" }>;

/** 조직도 내용: 서류(PDF)와 작성 화면 미리보기가 같이 쓴다 */
export function orgChartData(i: Pick<DocInput, "engineers"> & { company: { name: string; phone: string } }): OrgChartData {
  const by = (r: Engineer["role"]) => i.engineers.filter((e) => e.role === r);
  const mgr = by("siteManager")[0];
  const gradeOf = (e: Engineer) => /(특급|고급|중급|초급)/.exec(e.grade)?.[0] ?? "";
  const staff = [
    ...by("safetyManager").map((e) => ({ label: "안전", e })),
    ...by("qualityMain").map((e) => ({ label: `품질${gradeOf(e)}`, e })),
    ...by("qualitySub").map((e) => ({ label: `품질${gradeOf(e)}`, e })),
  ].map(({ label, e }) => ({ label, position: e.position, name: e.name, phone: e.phone ?? "" }));
  return {
    type: "orgchart",
    head: { label: "본사", lines: [i.company.name, i.company.phone] },
    manager: { label: "현장대리인", lines: [mgr?.name ?? "", mgr?.phone ?? ""] },
    staff,
  };
}

export function buildOrg(i: DocInput): DocSpec {
  const facts: Partial<Record<FactKey, string>> = { ...commonFacts(i) };
  for (const e of i.engineers) facts[`engineer:${e.id}`] = e.name;
  return {
    id: "org",
    title: "현장관리조직도",
    toc: [15],
    facts,
    blocks: [
      { type: "paragraph", text: "현 장 관 리 조 직 도", align: "center", bold: true, size: 17 },
      { type: "rule", thick: true },
      { type: "paragraph", text: i.projectName, align: "center", bold: true, size: 9 },
      gap(10),
      orgChartData(i),
    ],
  };
}

// ── 노무비 구분관리 및 지급확인제 합의서 (서식1-1, 지방계약) ──

export function buildLaborAgreement(i: DocInput): DocSpec | null {
  // 국가계약용 합의서의 근거 조항 문안은 샘플이 없어 만들지 않는다
  if (i.contractType !== "지방") return null;
  const a = i.laborAgreement;
  const direct = a && a.directLaborCost.trim() !== "" ? Number(a.directLaborCost.replace(/[^\d]/g, "")) : (i.budgetDirectLabor ?? 0);
  const C = (r: number, c: number, text: string, o: Partial<GridCell> = {}): GridCell => ({ r, c, text, align: "center", size: 9.5, ...o });
  const amountText = `금${koreanWon(i.contractAmount)} ( \\${i.contractAmount.toLocaleString("ko-KR")}원)`;
  const directText = direct > 0 ? `금${koreanWon(direct)}(\\${direct.toLocaleString("ko-KR")}원)` : "";
  const cells: GridCell[] = [
    C(0, 0, "「노무비 구분관리 및 지급확인제」합의서", { cs: 5, size: 15, bold: true }),
    C(1, 0, "공 사 명", { cs: 2, bold: true }),
    C(1, 2, i.projectName, { cs: 3, align: "left", bold: true }),
    C(2, 0, "계약상대자", { rs: 4 }),
    C(2, 1, "상 호 및 대 표 자", { bold: true }),
    C(2, 2, i.company.name, { cs: 3, align: "left", bold: true }),
    C(3, 1, "사 업 자 등 록 번 호", { bold: true }),
    C(3, 2, i.company.bizNo, { cs: 3, align: "left", bold: true }),
    C(4, 1, "영 업 소 소 재 지", { bold: true }),
    C(4, 2, i.company.address, { cs: 3, align: "left", size: 8.5 }),
    C(5, 1, "전 화 번 호 ( 휴 대 폰 )", { bold: true }),
    C(5, 2, `${i.company.phone}${i.company.mobile ? ` ( ${i.company.mobile} )` : ""}`, { cs: 3, align: "left", bold: true }),
    C(6, 0, "계약내용", { rs: 2 }),
    C(6, 1, "계 약 금 액", { bold: true }),
    C(6, 2, amountText, { cs: 3, align: "left", size: 8.5, bold: true }),
    C(7, 1, "계약상의 직접노무비", { bold: true }),
    C(7, 2, directText, { cs: 3, align: "left", size: 8.5, bold: true }),
  ];
  const agreementBody =
    "위 시설공사의 계약에 대하여 ｢노무비 구분관리 및 지급확인제｣ 운영을 위하여 계약상대자와 하수급인은 다음 사항에 대하여 합의하고, 합의사항을 성실히 이행할 것을 확약합니다.";
  const billing = [
    ["청구일", "지급기일", "은행명", "계좌번호"],
    [a?.billingDay ? `매월 ${a.billingDay} 일` : "매월     일", a?.paymentDay ? `매월 ${a.paymentDay} 일` : "매월     일", a?.bankName ?? "", a?.accountNo ?? ""],
  ];
  const art = (t: string): Block => ({ type: "paragraph", text: t, size: 9.5, leading: 1.75 });
  const p1: Block[] = [
    { type: "paragraph", text: "【서식1-1】계약상대자 제출(원도급)", size: 8.5 },
    { type: "grid", outer: true, cols: [62, 150, 90, 90, 91], rowHeights: [36, 24, 24, 24, 24, 24, 24, 24], cells },
    { type: "paragraph", text: agreementBody, size: 9.5, leading: 1.75, indent: 6 },
    { type: "table", header: billing[0], rows: [billing[1]], fontSize: 9.5, align: ["center", "center", "center", "center"] },
    { type: "paragraph", text: "붙임 : 통장사본 각1부.", size: 9.5, indent: 30 },
    art("제1조(근거) 본 합의서는 행정안전부 예규 ｢지방자치단체 입찰 및 계약 집행기준｣ 제13장 ｢공사계약 일반조건｣ 제9절의 “7” (공사계약에서 노무비의 구분관리 및 지급확인)의 규정에 근거한 ‘노무비 구분관리 및 지급확인제’ (이하 ‘노무비 구분관리제’라 합니다.) 및 ｢건설근로자의 고용개선 등에 관한 법률｣ (이하 ‘건설근로자법’라 합니다.) 에 따른 ‘임금비용의 구분지급 및 확인’ 세부추진사항을 합의하는데 그 목적이 있습니다."),
    art("제2조(정의) ‘노무비 구분관리제’란 발주기관, 계약상대자가 노무비를 노무비 이외의 대가와 구분하여 발주기관이 계약상대자에게 노무비를 매월 지급하고 근로자에게 대금이 지급되었는지 여부를 확인 하는 제도를 말합니다."),
    art("제3조(대상공사 및 지급범위) 2012년 4월 2일 이후 입찰공고된 공사의 공사현장에서 근무하는 모든 근로자(직접 노무비 대상)에게 지급합니다."),
    art("제4조(업무처리절차) 지방계약예규 및 발주처 세부계획에 따르며, 이 외 규정되어 있지 않은 사항은 ｢건설근로자법｣ 등에 따라 양 당사자 간의 합의에 따라 정합니다."),
    art("제5조(노무비 전용통장) 계약상대자는 노무비 전용통장을 계약상대자 명의로 개설하고 전용통장의 변경 시 발주기관에 통보 하여야 합니다. 단, 전자대금시스템을 이용할 경우 전자대금시스템에 전용계좌를 등록(변경)하면 발주기관에 통보 생략 가능합니다."),
  ];
  const p2: Block[] = [
    { type: "paragraph", text: "「노무비 구분관리 및 지급확인제」합의서", align: "center", bold: true, size: 13 },
    art("제6조(선금지급) 선급금에서 노무비는 제외되므로 선급금 신청금액은 발주기관과 협의하여 신청하도록 합니다."),
    art("제7조(지급상한) 노무비 청구액은 잔여 기성액을 초과하여 청구할 수 없으며, 하도급계약액을 초과한 노무비에 대해서는 계약상대자가 지급하여야 합니다."),
    art("제8조(지급방법) 계약상대자는 매월 근로자 본인 명의의 계좌로 노무비를 이체하여야 합니다. 다만, 근로자가 계좌를 개설할 수 없는 등 부득이한 경우에는 선지급 가능하며, 이 경우 근로자의 수령인이 첨부된 현금수령확인서를 제출하여야 합니다."),
    art("제9조(지급방법의 예외) 계약상대자의 경영상태 악화 등의 사유로 노무비 구분관리제 실시가 어렵다고 판단될 경우 계약상대자의 요청(동의)시에 발주기관이 계약상대자의 근로자에게 노무비를 직접 지급할 수 있습니다."),
    art("제10조(성실의무) 계약상대자는 노무비 청구내역의 누락 등이 발생하지 않도록 노무비 구분관리제를 성실하게 수행해야 합니다. 노무비 체불, 허위 청구 및 유용의 사례가 확인될 경우 발주기관은 처분청 통보 및 형사고발 등의 행정조치를 할 수 있으며, 이에 대해 계약상대자는 이의를 제기할 수 없습니다."),
    art("제11조 이 합의서에서 정하지 아니한 사항에 대하여는 발주기관과 계약상대자가 협의하여 정할 수 있습니다."),
    gap(24),
    { type: "paragraph", text: blankableDate(i.submitDate), align: "center", size: 10 },
    gap(20),
    { type: "pairs", indent: 10, labelWidth: 90, size: 10, gap: 12, rows: [{ label: "발 주 기 관", value: `${receiverName(i)} (인)` }, { label: "계 약 상 대 자", value: `${i.company.name} 대표 ${i.company.representative} (인)` }, { label: "하 수 급 인", value: "대표                    (인)" }] },
  ];
  return {
    id: "laborAgreement",
    title: "노무비 구분관리 및 지급확인제 합의서",
    toc: [7],
    facts: { ...commonFacts(i), contractAmount: String(i.contractAmount) },
    blocks: [...p1, { type: "pagebreak" }, ...p2],
  };
}

// ── 확약서 3종 ────────────────────────────────────────────

function pledge(i: DocInput, id: string, toc: number, tag: string, title: string, body: Block[]): DocSpec {
  return {
    id,
    title,
    toc: [toc],
    frame: true,
    facts: commonFacts(i),
    blocks: [
      ...(tag ? ([{ type: "paragraph", text: tag, size: 9 }] as Block[]) : []),
      gap(20),
      { type: "title", text: title },
      gap(6),
      ...body,
      gap(34),
      { type: "paragraph", text: shortDate(i, true), align: "center" },
      gap(14),
      {
        type: "pairs",
        indent: 200,
        labelWidth: 52,
        gap: 4,
        rows: consortiumMembers(i).flatMap((m, k) => [
          { label: k === 0 ? "서약자" : "", value: `회사명 : ${m.name}` },
          { label: "", value: `대표자 : ${m.representative}` },
        ]),
      },
      gap(40),
      recipientLine(i),
    ],
  };
}

const P = (text: string): Block => ({ type: "paragraph", text, indent: 8, size: 10.5, leading: 1.9 });

export function buildPledges(i: DocInput): DocSpec[] {
  return [
    pledge(i, "pledge:direct", 13, "【붙임1】", "하도급대금 직불조건부 입찰참가 확약서", [
      P(
        "본인 또는 본인이 소속한 회사는 만일 각 중앙관서와 체결한 계약에서 「건설산업기본법」 제34조제1항 또는 「하도급거래 공정화에 관한 법률」 제13조제1항 이나 제3항을 위반하여 각 중앙관서에서 그 사실을 확인하여 귀 청에 통보한 일자의 1년 이내에 본 건 입찰공고일이 도래한 경우에는 「국가를 당사자로 하는 계약에 관한 법률」제27조의4 제1항 및 제2항 및 「지방자치단체를 당사자로 하는 계약에 관한 법률」제31조의4 제1항 및 제2항에 의거 당해 입찰참가를 위하여 「국가를 당사자로 하는 계약에 관한 법률」 제15조제1항 및 「지방자치단체를 당사자로 하는 계약에 관한 법률」 제18조에 따른 대가 지급 시 하도급 대금을 수요기관이 하수급인에게 직접 지급토록 할 것임을 확약합니다.",
      ),
    ]),
    pledge(i, "pledge:keeper", 2, "【붙임2】", "「하도급지킴이」이용 확약서", [
      P("당 사는 본 공사 낙찰을 받아 계약을 체결하는 경우, 본 공사에 대한 하도급계약 체결ㆍ이행에 있어 계약상대자이자 원수급인으로서 아래 사항을 성실히 이행할 것을 확약합니다."),
      P(
        "○ 당 사는「하도급지킴이」를 이용(‘표준하도급계약서‘에 기반)하여 하도급 계약을 체결하겠습니다. 아울러, 하도급자(자재ㆍ장비업체 포함)와 수기로 하도급계약을 체결하는 경우에도 시스템에 등록하겠습니다.\n(※ PQ심사 및 적격심사 시, ‘표준하도급계약서 등의 사용계획서’를 제출하여 평가받은 경우에는 사용계획서에 정한 바를 준수하여야 합니다)",
      ),
      P(
        "○ 당 사는 하도급 대금, 노무비, 장비ㆍ자재대금 등을「하도급지킴이」를 이용하여 전자적으로 지급하겠습니다.\n- 당 사 몫 외의 하도급대금, 노무비, 장비 ‧ 자재대금 등의 지급은 “인출 제한” 기능을 사용하겠습니다.\n- 수요기관의 하도급대금, 노무비, 장비ㆍ자재대금의 직접 지급 또는 적정 지급 여부 확인에 적극 응하겠습니다.",
      ),
    ]),
    pledge(i, "pledge:jobs", 2, "", "「공공건설 일자리알리미」 이용 확약서", [
      P("당 사는 본 공사 낙찰을 받아 계약을 체결하는 경우 계약상대자이자 원수급인으로서 본 사업에 「공공건설 일자리알리미」 사용과 관련하여 아래 사항을 성실히 이행할 것을 확약합니다"),
      P("○ 당 사는 건설근로자 일자리 지원을 통한 근로 및 복지 환경 개선을 위해 「공공건설 일자리알리미」를 사용에 적극 협력 하겠습니다."),
      P(
        "○ 당 사는 건설근로자 고용 안정을 위해 근로자 구직을 지원하겠습니다.\n- 현장 작업 인력 구인 시 「공공건설 일자리알리미」 구인 공고를 적극 활용하겠습니다.\n- 하도급 계약 체결 즉시 「공공건설 일자리알리미」를 통하여 하도급계약 정보(업종, 연락처 등)를 근로자에게 제공하여 근로자의 자발적인 구직을 지원하겠습니다.\n- 당 사와 계약 체결하는 하도급업체에도 건설근로자 구인 시 「공공건설 일자리알리미」를 적극 사용토록 협조 조치하겠습니다.\n- 건설근로자와 계약 체결 시에는 「공공건설 일자리알리미」 전자계약서를 적극 활용하겠습니다.",
      ),
    ]),
  ];
}

