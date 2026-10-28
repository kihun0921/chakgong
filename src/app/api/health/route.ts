// 서버 상태 확인 (SRS SR-NF-06: 가용성 점검용). 로그인 없이 부를 수 있도록 내용은 상태뿐이다 — 공사·계정 정보는 절대 넣지 않는다.
export async function GET() {
  return Response.json({ status: "ok" });
}
