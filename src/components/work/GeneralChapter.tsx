"use client";

import { useState } from "react";
import { completionDate } from "@/domain/calendar";
import { orgChartData } from "@/domain/documents/forms";
import { maskRrn } from "@/domain/documents/format";
import {
  ROLE_LABEL,
  TOC_ITEMS,
  type Engineer,
  type EngineerRole,
  type SiteScale,
} from "@/domain/documents/model";
import { CHAPTERS, isAvailable } from "@/lib/chapters";
import { PlaceholderDoc } from "./PlaceholderDoc";
import { UploadDoc } from "./UploadDoc";
import { Tabs } from "./Tabs";
import {
  btnCls,
  btnGhostCls,
  inputCls,
  labelCls,
  type GeneralInfo,
  type PatchWork,
  type WorkState,
} from "./types";
import { NumInput } from "@/components/NumInput";

const chapter = CHAPTERS.find((c) => c.key === "general")!;

type Props = {
  work: WorkState;
  patch: PatchWork;
  docKey: string;
  onDocChange: (key: string) => void;
  projectId: string;
};

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-text-muted">{hint}</p>}
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mt-6 rounded-md border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-[18px]">{title}</h2>
      {desc && <p className="mt-1 text-[13px] text-text-secondary">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function GeneralChapter({ work, patch, docKey, onDocChange, projectId }: Props) {
  const g = work.general;
  const set = <K extends keyof GeneralInfo>(key: K, value: GeneralInfo[K]) =>
    patch({ general: { ...g, [key]: value } });
  const text = (key: keyof GeneralInfo, label: string, opts?: { hint?: string; type?: string; numeric?: boolean }) => (
    <Field label={label} htmlFor={key} hint={opts?.hint}>
      {opts?.numeric ? (
        <NumInput id={key} className={inputCls} value={g[key]} onValue={(raw) => set(key, raw as never)} />
      ) : (
        <input id={key} type={opts?.type ?? "text"} className={inputCls} value={g[key]} onChange={(e) => set(key, e.target.value as never)} />
      )}
    </Field>
  );

  let completion = "";
  const days = Number(g.durationDays);
  if (g.startDate && Number.isInteger(days) && days >= 1) {
    try {
      completion = completionDate(g.startDate, days);
    } catch {
      completion = "";
    }
  }

  const doc = chapter.docs.find((d) => d.key === docKey) ?? chapter.docs[0];

  return (
    <div>
      <Tabs
        variant="doc"
        ariaLabel="일반사항 문서"
        active={doc.key}
        onChange={onDocChange}
        items={chapter.docs.map((d) => ({ key: d.key, label: d.label, hint: isAvailable(d) ? undefined : "준비 중" }))}
      />

      {doc.key === "project" && (
        <Card
          title="공사·계약 정보"
          desc="여기에 한 번 입력한 값은 모든 서류에 같은 값으로 쓰입니다. 착공일과 공사기간은 3장 공정표 계산에도 쓰입니다."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {text("projectName", "공사명")}
            {text("projectNo", "공사관리번호(공고번호)")}
            {text("contractAgency", "계약기관", { hint: "계약을 맺은 기관입니다. 수요기관과 다를 수 있습니다." })}
            {text("demandAgency", "수요기관")}
            <Field label="계약 유형" htmlFor="contractType" hint="수신처와 노무비 합의서 근거 규정 문안이 이 값으로 바뀝니다.">
              <select
                id="contractType"
                className={inputCls}
                value={g.contractType}
                onChange={(e) => set("contractType", e.target.value as GeneralInfo["contractType"])}
              >
                <option value="">선택</option>
                <option value="국가">국가 계약</option>
                <option value="지방">지방 계약</option>
              </select>
            </Field>
            {text("contractNo", "계약번호")}
            {text("contractAmount", "계약금액(원)", { numeric: true })}
            {text("siteAddress", "현장 주소")}
            {text("contractDate", "계약일", { type: "date" })}
            {text("startDate", "착공일", { type: "date" })}
            {text("durationDays", "공사기간(달력일)", { numeric: true })}
            <div>
              <span className={labelCls}>준공예정일 (착공일 + 공사기간 − 1, 자동 계산)</span>
              <div className="rounded-sm border border-border bg-surface-alt px-3 py-2 text-sm" aria-live="polite">
                {completion || "착공일과 공사기간을 입력하면 계산됩니다"}
              </div>
            </div>
          </div>
        </Card>
      )}

      {doc.key === "company" && <CompanyTab work={work} patch={patch} text={text} />}

      {doc.key === "cover" && (
        <Card
          title="공문·착공신고서·제출서류 목차"
          desc="공문과 착공신고서는 공사·계약 정보에서 자동으로 채워집니다. 아래 값은 서류에 추가로 들어가는 내용입니다. 제출일은 비워 두면 서류에 공란으로 나옵니다."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {text("receiver", "수신처", { hint: "비우면 계약기관으로 '○○ 귀하'가 들어갑니다." })}
            {text("reference", "공문 참조(부서)", { hint: "예: 안전총괄과" })}
            {text("submitDate", "제출일", { type: "date" })}
            {text("docNumber", "공문 문서번호", { hint: "예: 회사약칭 제 2026-11-001 호 (자동 부여는 2차)" })}
            {text("copies", "제출 부수", { numeric: true })}
          </div>
          <TocOrder work={work} patch={patch} />
        </Card>
      )}

      {doc.key === "engineers" && <EngineersTab work={work} patch={patch} projectId={projectId} />}
      {doc.key === "safety" && <SafetyTab work={work} patch={patch} />}
      {doc.key === "org" && <OrgTab work={work} />}

      {!isAvailable(doc) && <PlaceholderDoc doc={doc} />}
    </div>
  );
}

// ── 시공사·공동수급체 ─────────────────────────────────────────

function CompanyTab({
  work,
  patch,
  text,
}: {
  work: WorkState;
  patch: PatchWork;
  text: (key: keyof GeneralInfo, label: string, opts?: { hint?: string; type?: string; numeric?: boolean }) => React.ReactNode;
}) {
  const [name, setName] = useState("");
  const [rep, setRep] = useState("");
  const [share, setShare] = useState("");
  const members = work.jointMembers;

  const add = () => {
    if (name.trim() === "") return;
    patch({
      jointMembers: [
        ...members,
        { id: crypto.randomUUID(), name: name.trim(), representative: rep.trim(), shareRate: share.trim(), isLead: members.length === 0 },
      ],
    });
    setName("");
    setRep("");
    setShare("");
  };

  return (
    <>
      <Card title="시공사(업체)" desc="착공 서류를 제출하는 업체입니다. 선임계·재직증명서·착공신고서의 시공사 정보로 쓰입니다.">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("companyName", "상호")}
          {text("representative", "대표자")}
          {text("companyAddress", "주소")}
          {text("companyPhone", "전화")}
          {text("companyBizNo", "사업자등록번호", { hint: "같은 번호의 이전 공사가 있으면 용역비 할인이 적용됩니다(납품·입금 전까지)." })}
          {text("referrerBizNo", "소개한 업체 사업자등록번호", { hint: "소개로 온 업체면 소개한 업체의 번호를 적으세요(선택). 소개한 업체에 보상이 생깁니다." })}
          {text("companyFax", "팩스", { hint: "공문 머리글에 들어갑니다." })}
          {text("companyMobile", "대표 휴대폰", { hint: "노무비 합의서에 들어갑니다." })}
        </div>
      </Card>
      <Card title="공동수급체 구성원사" desc="공동수급체가 아니면 비워 두세요. 간지에 구성원사 상호가 입력 순서대로 들어가고 대표사는 따로 표시됩니다.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="상호" htmlFor="jm-name"><input id="jm-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="대표자" htmlFor="jm-rep"><input id="jm-rep" className={inputCls} value={rep} onChange={(e) => setRep(e.target.value)} /></Field>
          <Field label="지분율(%)" htmlFor="jm-share"><NumInput id="jm-share" allowDecimal className={inputCls} value={share} onValue={setShare} /></Field>
          <div className="flex items-end"><button type="button" className={btnCls} onClick={add}>추가</button></div>
        </div>
        {members.length > 0 && (
          <ul className="mt-4 space-y-1 text-[13px]">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-surface-alt px-3 py-2">
                <span>
                  {m.isLead && <strong className="mr-1 text-primary">(대표사)</strong>}
                  {m.name} · 대표자 {m.representative || "-"} · 지분율 {m.shareRate || "-"}%
                </span>
                <span className="flex gap-3">
                  {!m.isLead && (
                    <button type="button" className="underline" onClick={() => patch({ jointMembers: members.map((x) => ({ ...x, isLead: x.id === m.id })) })}>
                      대표사로 지정
                    </button>
                  )}
                  <button type="button" className="text-danger underline" onClick={() => patch({ jointMembers: members.filter((x) => x.id !== m.id) })}>
                    삭제
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// ── 제출서류 목차 순서 ────────────────────────────────────────

function TocOrder({ work, patch }: { work: WorkState; patch: PatchWork }) {
  const order = work.tocOrder;
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ tocOrder: next });
  };
  return (
    <div className="mt-6">
      <h3 className="text-[15px] font-bold">제출서류 목차 순서 (합본 순서)</h3>
      <p className="mt-1 text-[13px] text-text-secondary">기본은 샘플 착공계의 목차 순서입니다. 위·아래로 옮기면 합본 순서도 바뀝니다.</p>
      <ol className="mt-3 space-y-1 text-[13px]">
        {order.map((n, i) => (
          <li key={n} className="flex items-center justify-between rounded-sm bg-surface-alt px-3 py-1.5">
            <span>{i + 1}. {TOC_ITEMS[n]}</span>
            <span className="flex gap-1">
              <button type="button" aria-label={`${TOC_ITEMS[n]} 위로`} className={`${btnGhostCls} !px-2 !py-0.5`} onClick={() => move(i, -1)} disabled={i === 0}>▲</button>
              <button type="button" aria-label={`${TOC_ITEMS[n]} 아래로`} className={`${btnGhostCls} !px-2 !py-0.5`} onClick={() => move(i, 1)} disabled={i === order.length - 1}>▼</button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── 현장기술자 ───────────────────────────────────────────────

const EMPTY_ENGINEER = {
  role: "siteManager" as EngineerRole,
  name: "",
  position: "",
  birthDate: "",
  rrn: "",
  address: "",
  techField: "",
  licenseNo: "",
  grade: "",
  hireDate: "",
  dedicated: "전담" as Engineer["dedicated"],
  phone: "",
};

function EngineersTab({ work, patch, projectId }: { work: WorkState; patch: PatchWork; projectId: string }) {
  const [d, setD] = useState(EMPTY_ENGINEER);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof EMPTY_ENGINEER>(k: K, v: (typeof EMPTY_ENGINEER)[K]) => setD({ ...d, [k]: v });

  const add = () => {
    if (d.name.trim() === "") return setError("성명을 입력해 주세요.");
    if (d.rrn.replace(/\D/g, "").length !== 13) return setError("주민등록번호는 숫자 13자리여야 합니다.");
    setError("");
    const e: Engineer = { ...d, id: crypto.randomUUID(), name: d.name.trim() };
    patch({
      engineers: [...work.engineers, e],
      safetyChiefId: work.safetyChiefId || (e.role === "siteManager" ? e.id : ""),
    });
    setD({ ...EMPTY_ENGINEER, role: d.role });
  };

  const f = (id: keyof typeof EMPTY_ENGINEER, label: string, type = "text") => (
    <Field label={label} htmlFor={`e-${id}`}>
      <input
        id={`e-${id}`}
        type={type}
        autoComplete="off"
        className={inputCls}
        value={d[id] as string}
        onChange={(e) => set(id, e.target.value as never)}
      />
    </Field>
  );

  return (
    <Card
      title="현장기술자 지정신고서"
      desc="기술인 정보는 한 번만 입력하면 선임계·재직증명서·안전보건관리책임자 선임서·조직도에 모두 쓰입니다. 주민등록번호는 화면에서는 가려지고 출력 PDF에만 전체가 표기됩니다. 아래 칸에 쓴 내용은 '기술인 추가'를 눌러야 목록에 들어가고 저장됩니다."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="역할" htmlFor="e-role">
          <select id="e-role" className={inputCls} value={d.role} onChange={(e) => set("role", e.target.value as EngineerRole)}>
            {(Object.keys(ROLE_LABEL) as EngineerRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </Field>
        {f("name", "성명")}
        {f("position", "직책")}
        {f("birthDate", "생년월일", "date")}
        <Field label="주민등록번호 (숫자 13자리)" htmlFor="e-rrn">
          <input id="e-rrn" type="password" inputMode="numeric" autoComplete="off" className={inputCls} value={d.rrn} onChange={(e) => set("rrn", e.target.value.replace(/[^\d-]/g, ""))} />
        </Field>
        {f("address", "주소")}
        {f("techField", "기술종목")}
        {f("licenseNo", "등록번호")}
        {f("grade", "등급")}
        {f("hireDate", "입사일자", "date")}
        {f("phone", "연락처(조직도에 표기)")}
        <Field label="전담·겸임" htmlFor="e-ded">
          <select id="e-ded" className={inputCls} value={d.dedicated} onChange={(e) => set("dedicated", e.target.value as Engineer["dedicated"])}>
            <option>전담</option>
            <option>겸임</option>
          </select>
        </Field>
      </div>
      {error && <p role="alert" className="mt-3 text-[13px] text-danger">⚠ {error}</p>}
      <div className="mt-4 flex justify-end">
        <button type="button" className={btnCls} onClick={add}>기술인 추가</button>
      </div>

      {work.engineers.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-alt text-left">
                <th className="p-2">역할</th>
                <th className="p-2">성명</th>
                <th className="p-2">주민등록번호</th>
                <th className="p-2">기술종목·등급</th>
                <th className="p-2">전담·겸임</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {work.engineers.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-2">{ROLE_LABEL[e.role]}</td>
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">{maskRrn(e.rrn)}</td>
                  <td className="p-2">{e.techField} {e.grade}</td>
                  <td className="p-2">{e.dedicated}</td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      className="text-danger underline"
                      onClick={() =>
                        patch({
                          engineers: work.engineers.filter((x) => x.id !== e.id),
                          safetyChiefId: work.safetyChiefId === e.id ? "" : work.safetyChiefId,
                        })
                      }
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-6">
        <UploadDoc
          projectId={projectId}
          work={work}
          patch={patch}
          title="현장기술자 첨부서류(자격증 사본·경력증명서 PDF)"
          tocChoices={[1]}
          note="선임계에 붙이는 국가기술자격증 사본, 건설기술자 경력증명서를 PDF로 올리면 현장기술자 서류 묶음 끝에 이어서 합본됩니다."
        />
      </div>
    </Card>
  );
}

// ── 안전보건관리책임자 선임서 ─────────────────────────────────

function SafetyTab({ work, patch }: { work: WorkState; patch: PatchWork }) {
  const s = work.siteScale;
  const setScale = (k: keyof SiteScale, v: string) => patch({ siteScale: { ...s, [k]: v } });
  const scale: [keyof SiteScale, string][] = [
    ["workerCount", "상시근로자수"],
    ["excavationDepth", "굴착깊이"],
    ["maxHeight", "건축물·공작물 최대높이"],
    ["maxBridgeSpan", "교량 최대 지간거리"],
    ["tunnelLength", "터널길이"],
    ["embankmentHeight", "제방높이"],
  ];
  return (
    <Card title="안전보건관리책임자 선임서" desc="선임할 사람은 현장기술자 목록에서 고릅니다(현장대리인이 겸임할 수 있습니다). 공사 규모에서 해당 없는 항목은 비워 두세요.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="선임할 사람" htmlFor="chief">
          <select id="chief" className={inputCls} value={work.safetyChiefId} onChange={(e) => patch({ safetyChiefId: e.target.value })}>
            <option value="">선택(현장기술자를 먼저 입력하세요)</option>
            {work.engineers.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({ROLE_LABEL[e.role]})</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {scale.map(([k, label]) => (
          <Field key={k} label={label} htmlFor={`sc-${k}`}>
            <input id={`sc-${k}`} className={inputCls} value={s[k]} onChange={(e) => setScale(k, e.target.value)} />
          </Field>
        ))}
      </div>
    </Card>
  );
}

// ── 조직도 미리보기 ───────────────────────────────────────────

function OrgTab({ work }: { work: WorkState }) {
  // 서류(PDF)와 같은 내용으로 그린다
  const chart = orgChartData({
    company: { name: work.general.companyName || "(시공사 상호 미입력)", phone: work.general.companyPhone },
    engineers: work.engineers,
  });
  const box = "rounded-sm border border-text bg-surface text-center text-[12px]";
  return (
    <Card title="조직도" desc="현장기술자 지정신고서에 입력한 기술인으로 자동으로 그려집니다. 안전관리자·품질관리자를 선임하면 아래 칸이 생깁니다. 연락처는 기술인 입력에서 넣습니다.">
      <div className="mx-auto max-w-[560px]">
        <div className="flex justify-end">
          <div className={`${box} w-[150px]`}>
            <p className="border-b border-text px-2 py-1 font-bold">본 사</p>
            {chart.head.lines.map((l) => <p key={l} className="border-b border-text px-2 py-1 last:border-b-0">{l || "-"}</p>)}
          </div>
        </div>
        <div className="mx-auto mt-2 w-[170px]">
          <div className={box}>
            <p className="border-b border-text px-2 py-1 font-bold">현장대리인</p>
            {chart.manager.lines.map((l, k) => <p key={k} className="border-b border-text px-2 py-1 last:border-b-0">{l || "(없음)"}</p>)}
          </div>
        </div>
        {chart.staff.length > 0 && (
          <>
            <div aria-hidden className="mx-auto h-6 w-px bg-text" />
            <div className="flex flex-wrap justify-center gap-3 border-t border-text pt-2">
              {chart.staff.map((s, k) => (
                <div key={k} className="w-[120px]">
                  <p className={`${box} px-2 py-1 font-bold`}>{s.label}</p>
                  <div className={`${box} mt-2`}>
                    <p className="border-b border-text px-2 py-1">{s.position} {s.name}</p>
                    <p className="px-2 py-1">{s.phone || "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
