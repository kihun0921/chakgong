import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// T-22(로그인 없이는 어떤 API도 안 열린다), T-44(다른 서비스와 독립)
const SRC = path.join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");

describe("관리자 확인 누락 방지 (T-22)", () => {
  const routes = walk(path.join(SRC, "app")).filter((f) => f.endsWith("route.ts"));

  it("API 경로가 하나 이상 있다", () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  it.each(routes.map((r) => [rel(r), r]))("%s 는 requireAdmin을 부른다(로그인·로그아웃 제외)", (name, file) => {
    // 로그인·로그아웃과, 상태만 알려 주는 health는 로그인 없이 부른다
    if (name.startsWith("app/api/auth/") || name === "app/api/health/route.ts") return;
    expect(readFileSync(file, "utf8")).toContain("requireAdmin(");
  });

  const pages = walk(path.join(SRC, "app")).filter((f) => f.endsWith("page.tsx"));
  it.each(pages.map((r) => [rel(r), r]))("%s 는 requirePageAdmin 또는 이동만 한다", (name, file) => {
    if (name === "app/login/page.tsx") return;
    const text = readFileSync(file, "utf8");
    expect(text.includes("requirePageAdmin(") || text.includes("redirect(")).toBe(true);
  });
});

describe("health는 상태만 돌려준다", () => {
  it("데이터 저장소를 건드리지 않는다", () => {
    const text = readFileSync(path.join(SRC, "app/api/health/route.ts"), "utf8");
    expect(text).not.toMatch(/@\/lib\/ports|cookies\(/);
  });
});

describe("다른 서비스와 독립 (T-44)", () => {
  const files = walk(SRC).filter((f) => /\.(ts|tsx|mjs)$/.test(f) && !f.endsWith(".test.ts"));

  it("올케어 플랫폼 코드·주소를 가져오거나 부르지 않는다", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      expect(text, rel(f)).not.toMatch(/acplatform|acplatform|올케어안전플랫폼 API|allcaresolution\.net\/api/i);
    }
  });

  it("외부로 나가는 요청은 허용 목록(나라장터 등) 밖으로 가지 않는다", () => {
    const allowed = ["apis.data.go.kr"];
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/fetch\(\s*["'`](https?:\/\/[^"'`/]+)/g)) {
        expect(allowed.some((a) => m[1].includes(a)), `${rel(f)} → ${m[1]}`).toBe(true);
      }
    }
  });
});
