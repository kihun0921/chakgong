import { describe, expect, it } from "vitest";
import { createFakeAiModel } from "@/lib/ports/ai";
import { createMemoryAuditLog } from "@/lib/ports/audit";
import { runAiTask } from "./service";

// T-64: Gemini 호출은 관리자가 요청한 보조 기능일 뿐이다. 실패해도 서류 작성은 막지 않고, 이력에는 내용을 남기지 않는다.
const remarkInput = { durationDays: 70, processes: [{ key: "p1", name: "토공", startDay: 1, endDay: 20 }] };
const goodReply = JSON.stringify({ drafts: [{ key: "p1", text: "터파기 및 되메우기" }] });

describe("AI 보조 실행 (T-64)", () => {
  it("성공하면 검사한 결과를 돌려주고, 이력에는 종류·결과·글자 수만 남긴다", async () => {
    const audit = createMemoryAuditLog();
    const model = createFakeAiModel(() => goodReply);
    const r = await runAiTask({ model, audit }, "remarkDraft", remarkInput, "admin");
    expect(r).toEqual({ ok: true, task: "remarkDraft", data: { drafts: [{ key: "p1", text: "터파기 및 되메우기" }] } });

    const rows = await audit.list({ action: "ai.request" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user: "admin", detail: { task: "remarkDraft", ok: true } });
    expect(typeof rows[0].detail?.inputChars).toBe("number");
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain("토공");
    expect(dump).not.toContain("터파기");
  });

  it("허용한 항목만 모델에 보낸다(업체 번호 같은 다른 값은 버린다)", async () => {
    const model = createFakeAiModel(() => goodReply);
    await runAiTask(
      { model, audit: createMemoryAuditLog() },
      "remarkDraft",
      { ...remarkInput, companyBizNo: "123-45-67891", processes: [{ ...remarkInput.processes[0], representative: "김대표" }] },
      "admin",
    );
    expect(model.calls).toHaveLength(1);
    const sent = model.calls[0].system + model.calls[0].prompt;
    expect(sent).not.toContain("123-45-67891");
    expect(sent).not.toContain("김대표");
    expect(sent).toContain("토공");
  });

  it("개인정보로 보이는 값이 있으면 모델을 부르지 않는다", async () => {
    const model = createFakeAiModel(() => goodReply);
    const audit = createMemoryAuditLog();
    const r = await runAiTask({ model, audit }, "remarkDraft", { ...remarkInput, processes: [{ key: "p1", name: "전화 010-0000-0000", startDay: 1, endDay: 5 }] }, "admin");
    expect(r).toMatchObject({ ok: false, code: "invalid" });
    expect(model.calls).toHaveLength(0);
    expect(await audit.list({ action: "ai.request" })).toHaveLength(1);
  });

  it("알 수 없는 기능이나 잘못된 입력은 거부한다", async () => {
    const model = createFakeAiModel(() => goodReply);
    const deps = { model, audit: createMemoryAuditLog() };
    expect(await runAiTask(deps, "hack", {}, "admin")).toMatchObject({ ok: false, code: "invalid" });
    expect(await runAiTask(deps, "remarkDraft", null, "admin")).toMatchObject({ ok: false, code: "invalid" });
    expect(model.calls).toHaveLength(0);
  });

  it("API 키가 없어 모델이 없으면 '사용 안 함'으로 알린다", async () => {
    const audit = createMemoryAuditLog();
    const r = await runAiTask({ model: null, audit }, "remarkDraft", remarkInput, "admin");
    expect(r).toMatchObject({ ok: false, code: "disabled" });
    if (!r.ok) expect(r.message).toContain("GEMINI_API_KEY");
    expect(await audit.list({ action: "ai.request" })).toHaveLength(1);
  });

  it("모델이 실패하면 일반 안내만 돌려주고 오류 내용은 노출하지 않는다", async () => {
    const model = createFakeAiModel(() => {
      throw new Error("API key sk-secret-123 rejected");
    });
    const r = await runAiTask({ model, audit: createMemoryAuditLog() }, "remarkDraft", remarkInput, "admin");
    expect(r).toMatchObject({ ok: false, code: "failed" });
    if (!r.ok) expect(r.message).not.toContain("sk-secret-123");
  });

  it("시간이 넘으면 중단하고 실패로 처리한다", async () => {
    const model = createFakeAiModel(
      (req) => new Promise<string>((_, reject) => req.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    const t0 = Date.now();
    const r = await runAiTask({ model, audit: createMemoryAuditLog() }, "remarkDraft", remarkInput, "admin", { timeoutMs: 30 });
    expect(r).toMatchObject({ ok: false, code: "failed" });
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("형식이 틀린 응답은 받지 않는다", async () => {
    const model = createFakeAiModel(() => "죄송합니다. 만들 수 없습니다.");
    const r = await runAiTask({ model, audit: createMemoryAuditLog() }, "remarkDraft", remarkInput, "admin");
    expect(r).toMatchObject({ ok: false, code: "bad-output" });
  });

  it("응답에 모르는 공정 키가 있으면 받지 않는다", async () => {
    const model = createFakeAiModel(() => JSON.stringify({ drafts: [{ key: "zz", text: "x" }] }));
    const r = await runAiTask({ model, audit: createMemoryAuditLog() }, "remarkDraft", remarkInput, "admin");
    expect(r).toMatchObject({ ok: false, code: "bad-output" });
  });
});
