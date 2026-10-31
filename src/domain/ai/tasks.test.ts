import { describe, expect, it } from "vitest";
import { buildPrompt, parseOutput, validateInput } from "./tasks";

// T-60~T-63: Gemini 보조 4개 기능의 입력 검사·프롬프트·응답 검사. 금액·일정 계산과 검증 판정은 바꾸지 않는다.
const items = [
  { id: "s1", name: "01 토공", amountWon: 1_000_000 },
  { id: "s2", name: "가설공사 외", amountWon: 500_000 },
];
const processes = [
  { key: "p1", name: "토공", startDay: 1, endDay: 20 },
  { key: "p2", name: "배수공", startDay: 15, endDay: 50 },
];
const issues = [
  { code: "V-1", message: "공정표 순공사비 합계가 집계표와 1,000원 다릅니다." },
  { code: "V-2", message: "구간 진도율 누계가 100%가 아닙니다." },
];

describe("입력 검사 (T-60~T-63)", () => {
  it("필요한 항목만 골라 담고 그 밖의 항목은 버린다", () => {
    const r = validateInput("parseAssist", { items: [{ ...items[0], companyBizNo: "123-45-67891", extra: 1 }] });
    expect(r).toEqual({ ok: true, value: { items: [items[0]] } });
  });

  it("개인정보로 보이는 값이 있으면 보내지 않는다", () => {
    const r = validateInput("parseAssist", { items: [{ id: "s1", name: "대표 010-0000-0000", amountWon: 1 }] });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain("전화번호");
  });

  it("형식이 틀리면 거부한다", () => {
    expect(validateInput("parseAssist", { items: "x" })).toMatchObject({ ok: false });
    expect(validateInput("parseAssist", { items: [] })).toMatchObject({ ok: false });
    expect(validateInput("remarkDraft", { durationDays: 0, processes })).toMatchObject({ ok: false });
    expect(validateInput("validationExplain", { issues: [] })).toMatchObject({ ok: false });
    expect(validateInput("followUp", { stage: "unknown" })).toMatchObject({ ok: false });
  });

  it("항목 수·글자 수 한도를 넘으면 거부한다", () => {
    const many = Array.from({ length: 81 }, (_, i) => ({ id: `s${i}`, name: "토공", amountWon: 1 }));
    expect(validateInput("parseAssist", { items: many })).toMatchObject({ ok: false });
    expect(validateInput("parseAssist", { items: [{ id: "s1", name: "가".repeat(81), amountWon: 1 }] })).toMatchObject({ ok: false });
  });
});

describe("프롬프트 (T-60~T-63)", () => {
  it("입력 값만 담고 개인정보·계산 변경 금지 규칙을 알린다", () => {
    const v = validateInput("parseAssist", { items });
    if (!v.ok) throw new Error("setup");
    const p = buildPrompt("parseAssist", v.value);
    expect(p.prompt).toContain("01 토공");
    expect(p.system).toContain("JSON");
    expect(p.system).toMatch(/금액|숫자/);
  });

  it("업체 응대 문안은 단계 정보만 담는다", () => {
    const v = validateInput("followUp", { stage: "feedback30" });
    if (!v.ok) throw new Error("setup");
    const p = buildPrompt("followUp", v.value);
    expect(p.prompt).toContain("feedback30");
    expect(p.prompt).not.toMatch(/\d{3}-\d{2}-\d{5}/);
  });
});

describe("내역서 파싱 보조 응답 (T-60)", () => {
  const input = { items };
  it("정리한 이름 제안을 읽는다. 이름이 같은 제안은 뺀다", () => {
    const raw = JSON.stringify({
      suggestions: [
        { id: "s1", name: "토공", reason: "번호 접두어 제거" },
        { id: "s2", name: "가설공사 외", reason: "변경 없음" },
      ],
    });
    expect(parseOutput("parseAssist", raw, input)).toEqual({
      ok: true,
      value: { suggestions: [{ id: "s1", name: "토공", reason: "번호 접두어 제거" }] },
    });
  });

  it("코드 블록으로 감싼 JSON도 읽는다", () => {
    const raw = "```json\n" + JSON.stringify({ suggestions: [{ id: "s1", name: "토공", reason: "x" }] }) + "\n```";
    expect(parseOutput("parseAssist", raw, input)).toMatchObject({ ok: true });
  });

  it("모르는 id·빈 이름·너무 긴 이름·중복 id는 거부한다", () => {
    const bad = (s: unknown) => parseOutput("parseAssist", JSON.stringify({ suggestions: s }), input);
    expect(bad([{ id: "zz", name: "토공", reason: "" }])).toMatchObject({ ok: false });
    expect(bad([{ id: "s1", name: " ", reason: "" }])).toMatchObject({ ok: false });
    expect(bad([{ id: "s1", name: "가".repeat(61), reason: "" }])).toMatchObject({ ok: false });
    expect(bad([{ id: "s1", name: "토공", reason: "" }, { id: "s1", name: "토목", reason: "" }])).toMatchObject({ ok: false });
  });

  it("JSON이 아니면 거부한다", () => {
    expect(parseOutput("parseAssist", "죄송합니다", input)).toMatchObject({ ok: false });
  });
});

describe("공정 내용 문안 초안 응답 (T-61)", () => {
  const input = { durationDays: 70, processes };
  it("공정 키별 초안을 읽는다", () => {
    const raw = JSON.stringify({ drafts: [{ key: "p1", text: "터파기 및 되메우기" }] });
    expect(parseOutput("remarkDraft", raw, input)).toEqual({ ok: true, value: { drafts: [{ key: "p1", text: "터파기 및 되메우기" }] } });
  });

  it("모르는 공정 키·긴 문안·개인정보가 든 문안은 거부한다", () => {
    const bad = (d: unknown) => parseOutput("remarkDraft", JSON.stringify({ drafts: d }), input);
    expect(bad([{ key: "zz", text: "x" }])).toMatchObject({ ok: false });
    expect(bad([{ key: "p1", text: "가".repeat(61) }])).toMatchObject({ ok: false });
    expect(bad([{ key: "p1", text: "연락처 010-0000-0000" }])).toMatchObject({ ok: false });
  });
});

describe("검증 결과 설명 응답 (T-62)", () => {
  const input = { issues };
  it("요약과 조치 순서를 읽는다", () => {
    const raw = JSON.stringify({ summary: "금액이 맞지 않습니다.", steps: ["1. 공정별 금액을 확인하세요.", "2. 집계표와 비교하세요."] });
    expect(parseOutput("validationExplain", raw, input)).toMatchObject({ ok: true, value: { steps: expect.any(Array) } });
  });

  it("조치 단계가 너무 많거나 요약이 비면 거부한다", () => {
    const steps = Array.from({ length: 7 }, (_, i) => `단계 ${i}`);
    expect(parseOutput("validationExplain", JSON.stringify({ summary: "요약", steps }), input)).toMatchObject({ ok: false });
    expect(parseOutput("validationExplain", JSON.stringify({ summary: "", steps: ["a"] }), input)).toMatchObject({ ok: false });
  });
});

describe("업체 응대 문안 응답 (T-63)", () => {
  const input = { stage: "delivered3" as const };
  it("본문을 읽는다", () => {
    const body = "안녕하세요. 납품해 드린 착공 서류를 발주기관에 제출하셨는지 여쭙습니다. 보완 요구가 있으면 바로 수정해 드립니다.";
    expect(parseOutput("followUp", JSON.stringify({ body }), input)).toEqual({ ok: true, value: { body } });
  });

  it("너무 짧거나 길거나 링크·개인정보가 있으면 거부한다", () => {
    const bad = (b: string) => parseOutput("followUp", JSON.stringify({ body: b }), input);
    expect(bad("짧음")).toMatchObject({ ok: false });
    expect(bad("가".repeat(701))).toMatchObject({ ok: false });
    expect(bad("자세한 내용은 http://example.com 에서 확인하세요. 감사합니다 감사합니다.")).toMatchObject({ ok: false });
    expect(bad("문의는 010-0000-0000 으로 연락 주세요. 감사합니다 감사합니다 감사합니다.")).toMatchObject({ ok: false });
  });
});
