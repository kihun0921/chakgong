// 착공계 작성 화면의 구성: 큰 챕터 4개(탭) 안에 제출서류 목차 15종을 문서별 탭으로 나눈다.
// 제출서류 목차 번호(SRS 8.3): ① 현장기술자 지정신고서 ② 하도급지킴이 이용 확약서 ③ 안전관리계획서
// ④ 공사예정공정표 ⑤ 공사 도급계약서 사본 ⑥ 공사 도급내역서 ⑦ 노무비 구분관리 및 지급확인제 합의서
// ⑧ 환경관리계획서 ⑨ 인력 및 장비투입계획서 ⑩ 착공전 현장사진 ⑪ 고용·산재보험 가입증명원
// ⑫ 직접시공계획서 ⑬ 하도급대금 직불조건부 입찰참가 확약서 ⑭ 품질관리계획서 ⑮ 조직도
// 합본 기본 순서도 이 목차 순서를 따른다(SR-CM-10).

export type DocTab = {
  key: string;
  label: string;
  /** 제출서류 목차 번호(1~15). 목차에 없는 서류(공문 등)는 빈 배열 */
  toc: number[];
  /** 관련 SRS 요구사항 */
  sr: string;
  /** 작성 기능이 만들어졌는지. false이면 '준비 중' 안내를 보여 준다 */
  ready: boolean;
  /** 준비 중인 이유(안내 문구) */
  note?: string;
};

export type Chapter = {
  key: "general" | "direct" | "schedule" | "other";
  label: string;
  docs: DocTab[];
};

export const CHAPTERS: Chapter[] = [
  {
    key: "general",
    label: "1. 일반사항",
    docs: [
      { key: "project", label: "공사·계약 정보", toc: [], sr: "SR-SC-05, SR-CM-02·06·07", ready: true },
      { key: "company", label: "시공사·공동수급체", toc: [], sr: "SR-CM-02·05", ready: true },
      { key: "cover", label: "공문·착공신고서·제출서류 목차", toc: [], sr: "SR-CM-01·03·10", ready: true },
      { key: "engineers", label: "현장기술자 지정신고서", toc: [1], sr: "SR-CM-04", ready: true },
      { key: "safety", label: "안전보건관리책임자 선임서", toc: [], sr: "SR-CM-01·03", ready: true },
      { key: "org", label: "조직도", toc: [15], sr: "SR-CM-04", ready: true },
    ],
  },
  {
    key: "direct",
    label: "2. 직접시공계획서",
    docs: [
      {
        key: "direct",
        label: "직접시공계획서",
        toc: [12],
        sr: "SR-CM-09",
        ready: true,
      },
    ],
  },
  {
    key: "schedule",
    label: "3. 공정표·인원장비계획서",
    docs: [
      { key: "gantt", label: "공사예정공정표", toc: [4], sr: "SR-SC, SR-PG", ready: true },
      { key: "labor", label: "인력 및 장비투입계획서", toc: [9], sr: "SR-RS", ready: true },
    ],
  },
  {
    key: "other",
    label: "4. 기타서류",
    docs: [
      { key: "contract", label: "공사 도급계약서 사본", toc: [5], sr: "SR-CM-09", ready: true },
      { key: "budget", label: "공사 도급내역서", toc: [6], sr: "SR-CM-09", ready: true },
      { key: "laborAgreement", label: "노무비 구분관리 및 지급확인제 합의서", toc: [7], sr: "SR-CM-01·06", ready: true },
      { key: "pledges", label: "확약서(직불조건부·하도급지킴이·일자리알리미)", toc: [13, 2], sr: "SR-CM-05", ready: true },
      { key: "insurance", label: "고용·산재보험 가입증명원", toc: [11], sr: "SR-CM-09", ready: true },
      {
        key: "photos",
        label: "착공전 현장사진",
        toc: [10],
        sr: "SR-CM-08",
        ready: false,
        note: "사진 업로드, 위치·공종·내용 입력, 촬영일 자동 읽기, 한 쪽 2장 조판은 Wave 2 후반에 만듭니다.",
      },
      { key: "plans", label: "품질·안전·환경관리계획서", toc: [14, 3, 8], sr: "SR-CM-11", ready: true },
    ],
  },
];

export function isAvailable(doc: DocTab): boolean {
  return doc.ready;
}
