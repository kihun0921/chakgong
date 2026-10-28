// 착공계 서류 양식 부품(PDF): 격자 표, 회사 머리글, 간지(표지), 조직도, 이름표-값 줄.
// 실제 제출 서류(연천읍지구 착공계 한 세트)의 모양을 따른다. 서버에서만 쓴다(render.tsx가 글꼴을 등록한다).

import { Svg, Rect, Text, View } from "@react-pdf/renderer";
import type { Block, GridCell, OrgNode } from "@/domain/documents/model";

const LINE = 0.75;
const INK = "#1a1a1a";

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;

/** '성명' → '성   명': 글자 사이에 공백을 넣어 칸을 채워 보이게 한다 */
const spaced = (t: string) => [...t].join("  ");

export function LetterheadBlock({ b }: { b: Of<"letterhead"> }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: 700, textAlign: "center", letterSpacing: 6, marginTop: 6 }}>{b.title}</Text>
      <Text style={{ fontSize: 9.5, fontWeight: 700, textAlign: "center", marginTop: 8 }}>{b.subtitle}</Text>
      <View style={{ height: 5, backgroundColor: "#bfbfbf", marginTop: 8 }} />
    </View>
  );
}

export function RuleBlock({ b }: { b: Of<"rule"> }) {
  return <View style={{ borderBottomWidth: b.thick ? 1.8 : LINE, borderBottomColor: INK, marginVertical: 6 }} />;
}

export function PairsBlock({ b }: { b: Of<"pairs"> }) {
  const lw = b.labelWidth ?? 90;
  return (
    <View style={{ marginLeft: b.indent ?? 0, marginVertical: 4 }}>
      {b.rows.map((r, k) => (
        <View key={k} style={{ flexDirection: "row", marginBottom: b.gap ?? 5 }} wrap={false}>
          <Text style={{ width: lw, fontSize: b.size ?? 10.5 }}>{spaced(r.label.replace(/\s/g, ""))}</Text>
          <Text style={{ width: 10, fontSize: b.size ?? 10.5 }}>{r.label === "" ? "" : ":"}</Text>
          <Text style={{ flex: 1, fontSize: b.size ?? 10.5 }}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** 격자 표: 칸 위치를 절대 좌표로 놓는다. 칸 합치기(rs·cs)와 칸마다 정렬·굵기를 지정할 수 있다. */
export function GridBlock({ b, width }: { b: Of<"grid">; width: number }) {
  const totalW = b.cols.reduce((a, c) => a + c, 0);
  const colX = [0];
  b.cols.forEach((c, i) => colX.push(colX[i] + (c / totalW) * width));
  const rowY = [0];
  b.rowHeights.forEach((h, i) => rowY.push(rowY[i] + h));
  const height = rowY[rowY.length - 1];
  const cellBox = (cell: GridCell) => {
    const r2 = cell.r + (cell.rs ?? 1);
    const c2 = cell.c + (cell.cs ?? 1);
    return { left: colX[cell.c], top: rowY[cell.r], w: colX[c2] - colX[cell.c], h: rowY[r2] - rowY[cell.r] };
  };
  return (
    <View style={{ width, height, position: "relative", marginVertical: 4 }} wrap={false}>
      {b.outer && <View style={{ position: "absolute", left: 0, top: 0, width, height, borderWidth: LINE, borderColor: INK }} />}
      {b.cells.map((cell, k) => {
        const box = cellBox(cell);
        const text = cell.spaced ? spaced(cell.text.replace(/\s/g, "")) : cell.text;
        return (
          <View
            key={k}
            style={{
              position: "absolute",
              left: box.left,
              top: box.top,
              width: box.w,
              height: box.h,
              borderRightWidth: cell.noBorder ? 0 : LINE,
              borderBottomWidth: cell.noBorder ? 0 : LINE,
              borderTopWidth: cell.noBorder || cell.r !== 0 ? 0 : LINE,
              borderLeftWidth: cell.noBorder || cell.c !== 0 ? 0 : LINE,
              borderColor: INK,
              justifyContent: cell.valign === "top" ? "flex-start" : cell.valign === "bottom" ? "flex-end" : "center",
              paddingHorizontal: 5,
              paddingVertical: cell.valign === "top" ? 6 : 1,
              backgroundColor: cell.fill,
            }}
          >
            <Text style={{ fontSize: cell.size ?? b.size ?? 10, fontWeight: cell.bold ? 700 : 400, textAlign: cell.align ?? "left", lineHeight: 1.45 }}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** 간지: 두루마리 모양의 제목 상자, 공사명, 날짜, 참여 회사 이름 */
export function CoverBlock({ b }: { b: Of<"cover"> }) {
  const W = 440;
  const H = 72;
  const blue = "#3b5a8a";
  return (
    <View style={{ alignItems: "center", marginTop: 40 }}>
      <View style={{ width: W, height: H, position: "relative", justifyContent: "center" }}>
        <Svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {/* 두루마리 가운데 판 */}
          <Rect x={14} y={14} width={W - 28} height={H - 28} rx={6} ry={6} stroke={blue} strokeWidth={1.4} fill="#ffffff" />
          {/* 양 끝의 말린 부분 */}
          <Rect x={2} y={2} width={14} height={H - 8} rx={7} ry={7} stroke={blue} strokeWidth={1.4} fill="#ffffff" />
          <Rect x={W - 16} y={2} width={14} height={H - 8} rx={7} ry={7} stroke={blue} strokeWidth={1.4} fill="#ffffff" />
        </Svg>
        <Text style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>{b.title}</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: 700, textAlign: "center", marginTop: 52 }}>{`공사명 : ${b.projectName}`}</Text>
      <Text style={{ fontSize: 14, fontWeight: 700, textAlign: "center", marginTop: 108 }}>{b.dateText}</Text>
      <View style={{ marginTop: 128, alignItems: "center" }}>
        {b.names.map((n, k) => (
          <Text key={k} style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{n}</Text>
        ))}
      </View>
    </View>
  );
}

function NodeBox({ node, width, left, top }: { node: OrgNode; width: number; left: number; top: number }) {
  const rows = [node.label, ...node.lines];
  return (
    <View style={{ position: "absolute", left, top, width, borderWidth: 1, borderColor: INK, backgroundColor: "#ffffff" }}>
      {rows.map((t, k) => (
        <View key={k} style={{ height: 24, justifyContent: "center", borderTopWidth: k === 0 ? 0 : LINE, borderColor: INK }}>
          <Text style={{ fontSize: 9.5, fontWeight: k === 0 ? 700 : 400, textAlign: "center" }}>{k === 0 ? spaced(t.replace(/\s/g, "")) : t}</Text>
        </View>
      ))}
    </View>
  );
}

/** 현장관리조직도 */
export function OrgChartBlock({ b, width }: { b: Of<"orgchart">; width: number }) {
  const n = b.staff.length;
  const boxW = Math.min(110, n === 0 ? 110 : width / n - 14);
  const mgrW = 130;
  const mgrLeft = (width - mgrW) / 2;
  const mgrTop = 70;
  const mgrH = 24 * (1 + b.manager.lines.length);
  const busY = mgrTop + mgrH + 50;
  const staffTop = busY + 40;
  const centers = b.staff.map((_, i) => ((i + 0.5) * width) / Math.max(n, 1));
  const lineStyle = { position: "absolute" as const, backgroundColor: INK };
  return (
    <View style={{ width, height: staffTop + 24 * 3 + 20, position: "relative", marginTop: 8 }} wrap={false}>
      <NodeBox node={b.head} width={125} left={width - 125} top={0} />
      <NodeBox node={b.manager} width={mgrW} left={mgrLeft} top={mgrTop} />
      {n > 0 && (
        <>
          {/* 현장대리인 상자 아래 → 가로선 */}
          <View style={{ ...lineStyle, left: width / 2, top: mgrTop + mgrH, width: 1, height: busY - (mgrTop + mgrH) }} />
          {n > 1 && <View style={{ ...lineStyle, left: centers[0], top: busY, width: centers[n - 1] - centers[0], height: 1 }} />}
          {b.staff.map((s, i) => (
            <View key={i}>
              <View style={{ ...lineStyle, left: centers[i], top: busY, width: 1, height: 24 }} />
              <View style={{ position: "absolute", left: centers[i] - boxW / 2, top: busY + 24, width: boxW, height: 24, borderWidth: 1, borderColor: INK, justifyContent: "center", backgroundColor: "#ffffff" }}>
                <Text style={{ fontSize: 9.5, fontWeight: 700, textAlign: "center" }}>{s.label}</Text>
              </View>
              <View style={{ ...lineStyle, left: centers[i], top: busY + 48, width: 1, height: 16 }} />
              <View style={{ position: "absolute", left: centers[i] - boxW / 2, top: busY + 64, width: boxW, borderWidth: 1, borderColor: INK, backgroundColor: "#ffffff" }}>
                <View style={{ flexDirection: "row", height: 24, borderBottomWidth: LINE, borderColor: INK }}>
                  <View style={{ width: 34, justifyContent: "center", borderRightWidth: LINE, borderColor: INK }}>
                    <Text style={{ fontSize: 9, textAlign: "center" }}>{s.position}</Text>
                  </View>
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text style={{ fontSize: 9.5, textAlign: "center" }}>{s.name}</Text>
                  </View>
                </View>
                <View style={{ height: 24, justifyContent: "center" }}>
                  <Text style={{ fontSize: 9, textAlign: "center" }}>{s.phone}</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ── 공사예정공정표·인원 및 장비투입계획표 (막대 그래프 격자) ────────────

const GRID = "#8c8c8c";
const GRID_SOFT = "#c4c4c4";
const HEAD_FILL = "#d9d9d9";
const SUM_FILL = "#ededed";
const NAME_FILL = "#ffff99";
const BAR = "#7030a0";

type Hdr = Extract<Block, { type: "gantt" }>["periods"];

function decimalsFor(pw: number) {
  return pw >= 28 ? 2 : pw >= 16 ? 1 : 0;
}

function Box({
  x,
  y,
  w,
  h,
  fill,
  children,
  right = true,
  bottom = true,
  top = false,
  left = false,
  color = GRID,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  children?: React.ReactNode;
  right?: boolean;
  bottom?: boolean;
  top?: boolean;
  left?: boolean;
  color?: string;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundColor: fill,
        borderRightWidth: right ? 0.5 : 0,
        borderBottomWidth: bottom ? 0.5 : 0,
        borderTopWidth: top ? 0.5 : 0,
        borderLeftWidth: left ? 0.5 : 0,
        borderColor: color,
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

const T = ({ children, size = 7, bold = false, align = "center" }: { children: React.ReactNode; size?: number; bold?: boolean; align?: "left" | "center" | "right" }) => (
  <Text style={{ fontSize: size, fontWeight: bold ? 700 : 400, textAlign: align, lineHeight: 1.1 }}>{children}</Text>
);

/** 연·월·구간 끝 날짜 머리글 3줄. x0은 첫 구간의 왼쪽 위치 */
function PeriodHead({ hdr, x0, pw, y, rh }: { hdr: Hdr; x0: number; pw: number; y: number; rh: number }) {
  const fs = Math.min(7.5, rh * 0.6);
  return (
    <>
      {hdr.years.map((g, k) => (
        <Box key={`y${k}`} x={x0 + g.from * pw} y={y} w={(g.to - g.from + 1) * pw} h={rh} fill={HEAD_FILL} top>
          <T size={fs} bold>{g.label}</T>
        </Box>
      ))}
      {hdr.months.map((g, k) => (
        <Box key={`m${k}`} x={x0 + g.from * pw} y={y + rh} w={(g.to - g.from + 1) * pw} h={rh} fill={HEAD_FILL}>
          <T size={fs} bold>{g.label}</T>
        </Box>
      ))}
      {hdr.days.map((d, k) => (
        <Box key={`d${k}`} x={x0 + k * pw} y={y + 2 * rh} w={pw} h={rh} fill={HEAD_FILL} color={GRID_SOFT}>
          <T size={Math.max(3.5, Math.min(fs - 1, pw * 0.5))}>{d}</T>
        </Box>
      ))}
    </>
  );
}

/** 구간 경계의 세로선: 달이 바뀌는 곳은 진하게 */
function PeriodLines({ hdr, x0, pw, y, h }: { hdr: Hdr; x0: number; pw: number; y: number; h: number }) {
  const monthStarts = new Set(hdr.months.map((g) => g.from));
  const out: React.ReactNode[] = [];
  for (let k = 0; k <= hdr.days.length; k++) {
    const strong = monthStarts.has(k) || k === hdr.days.length;
    out.push(<View key={k} style={{ position: "absolute", left: x0 + k * pw, top: y, width: strong ? 0.6 : 0.3, height: h, backgroundColor: strong ? GRID : GRID_SOFT }} />);
  }
  return <>{out}</>;
}

function TitleArea({ title, projectName, rightNote, width }: { title: string; projectName: string; rightNote: string; width: number }) {
  return (
    <>
      <View style={{ width, height: 40, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, fontWeight: 700, letterSpacing: 4, textDecoration: "underline" }}>{title}</Text>
      </View>
      <View style={{ width, height: 16, flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 8, fontWeight: 700 }}>{`공사명 : ${projectName}`}</Text>
        <Text style={{ fontSize: 8, fontWeight: 700 }}>{rightNote}</Text>
      </View>
    </>
  );
}

/** 막대 옆에 쓰는 설명: 오른쪽에 자리가 있으면 막대 끝 뒤에, 없으면 시작 앞에 오른쪽 정렬 */
function RemarkText({ text, bar, x0, pw, periodsW, y, rh }: { text: string; bar: [number, number]; x0: number; pw: number; periodsW: number; y: number; rh: number }) {
  const fs = Math.max(4, Math.min(6.5, rh * 0.36));
  const roomRight = periodsW - bar[1] * pw;
  const width = Math.min(420, Math.max(roomRight, bar[0] * pw) - 6);
  const onRight = roomRight >= bar[0] * pw;
  const left = onRight ? x0 + bar[1] * pw + 3 : x0 + bar[0] * pw - width - 3;
  return (
    <View style={{ position: "absolute", left, top: y + rh * 0.12, width, height: rh * 0.7, justifyContent: "center" }}>
      <Text style={{ fontSize: fs, textAlign: onRight ? "left" : "right", lineHeight: 1.1 }}>{text}</Text>
    </View>
  );
}

const PAGE_BODY = 700; // 표가 쓸 수 있는 높이(A3 가로, 제목 영역 제외)

export function GanttBlock({ b, width }: { b: Of<"gantt">; width: number }) {
  const P = b.periods.days.length;
  const colW = [16, 150, 38, 70, 18];
  const noteW = 26;
  const fixedW = colW.reduce((a, c) => a + c, 0);
  const x0 = fixedW;
  const pw = (width - fixedW - noteW) / Math.max(P, 1);
  const n = b.rows.length;
  const hdrRh = 13;
  const bodyRows = n + 3;
  const rh = Math.max(7, Math.min(22, Math.floor(((PAGE_BODY - 3 * hdrRh) / bodyRows) * 10) / 10));
  const fsName = Math.min(8.5, rh * 0.52);
  const fsNum = Math.max(3.5, Math.min(7, rh * 0.4, pw * 0.34 + 2));
  const dec = decimalsFor(pw);
  const bodyY = 3 * hdrRh;
  const totalH = bodyY + bodyRows * rh;
  const colX: number[] = [0];
  colW.forEach((c, i) => colX.push(colX[i] + c));
  // 공정별 구간 값은 좁은 칸에서도 소수 한 자리는 남긴다(0.2 → '0'이 되면 안 된다). 합계·누계는 칸 너비에 맞춘다.
  const rowDec = pw >= 28 ? 2 : 1;
  const fmt = (v: number, d = dec) => (Number(v.toFixed(d)) === 0 ? "" : v.toFixed(d));
  const money = (v: number) => (v === 0 ? "-" : v.toLocaleString("ko-KR"));
  const footerY = (k: number) => bodyY + (n + k) * rh;
  const periodsW = width - x0 - noteW;

  return (
    <View style={{ width }}>
      <TitleArea title={b.title} projectName={b.projectName} rightNote={b.rightNote} width={width} />
      <View style={{ width, height: totalH, position: "relative", marginTop: 6 }} wrap={false}>
        {/* 머리글 */}
        <Box x={0} y={0} w={colX[2]} h={3 * hdrRh} fill={HEAD_FILL} top left><T size={9} bold>공   종</T></Box>
        <Box x={colX[2]} y={0} w={colW[2]} h={3 * hdrRh} fill={HEAD_FILL} top><T size={7} bold>{"보할\n(%)"}</T></Box>
        <Box x={colX[3]} y={0} w={colW[3]} h={3 * hdrRh} fill={HEAD_FILL} top><T size={7} bold>{"순공사비\n금 액(원)"}</T></Box>
        <Box x={colX[4]} y={0} w={colW[4]} h={3 * hdrRh} fill={HEAD_FILL} top><T size={7} bold>{"단\n위"}</T></Box>
        <PeriodHead hdr={b.periods} x0={x0} pw={pw} y={0} rh={hdrRh} />
        <Box x={width - noteW} y={0} w={noteW} h={3 * hdrRh} fill={HEAD_FILL} top right><T size={7} bold>{"비\n고"}</T></Box>

        {/* 공정 행 */}
        {b.rows.map((r, i) => {
          const y = bodyY + i * rh;
          const coop = r.amount === 0;
          return (
            <View key={i}>
              {i === 0 && (
                <Box x={0} y={y} w={colW[0]} h={n * rh} fill={HEAD_FILL} left>
                  <T size={8} bold>{"공\n정"}</T>
                </Box>
              )}
              <Box x={colX[1]} y={y} w={colW[1]} h={rh} fill={coop ? undefined : NAME_FILL}>
                <View style={{ paddingHorizontal: 3 }}><T size={fsName} align="left">{r.name}</T></View>
              </Box>
              <Box x={colX[2]} y={y} w={colW[2]} h={rh}>
                <View style={{ paddingRight: 3 }}><T size={fsName} align="right">{fmt(r.weight, 2)}</T></View>
              </Box>
              <Box x={colX[3]} y={y} w={colW[3]} h={rh}>
                <View style={{ paddingRight: 3 }}><T size={fsName - 0.5} align="right">{money(r.amount)}</T></View>
              </Box>
              <Box x={colX[4]} y={y} w={colW[4]} h={rh}><T size={fsName - 1}>식</T></Box>
              <Box x={width - noteW} y={y} w={noteW} h={rh}><T size={5}>{r.remark}</T></Box>
              <View style={{ position: "absolute", left: x0, top: y + rh - 0.5, width: periodsW, height: 0.5, backgroundColor: GRID_SOFT }} />
            </View>
          );
        })}

        {/* 합계 · 진도율 · 누계 */}
        <Box x={0} y={footerY(0)} w={colX[2]} h={rh} fill={SUM_FILL} left><T size={fsName + 0.5} bold>합   계</T></Box>
        <Box x={colX[2]} y={footerY(0)} w={colW[2]} h={rh} fill={SUM_FILL}><View style={{ paddingRight: 3 }}><T size={fsName} bold align="right">100%</T></View></Box>
        <Box x={colX[3]} y={footerY(0)} w={colW[3]} h={rh} fill={SUM_FILL}>
          <View style={{ paddingRight: 3 }}><T size={fsName - 0.5} bold align="right">{b.totals.amount.toLocaleString("ko-KR")}</T></View>
        </Box>
        <Box x={colX[4]} y={footerY(0)} w={colW[4]} h={rh} fill={SUM_FILL}><T size={fsName - 1} bold>식</T></Box>
        <Box x={x0} y={footerY(0)} w={periodsW} h={rh} fill={SUM_FILL} right={false} />
        <Box x={0} y={footerY(1)} w={colX[4]} h={rh * 2} fill={SUM_FILL} left><T size={fsName + 0.5} bold>진 도 율 (%)</T></Box>
        <Box x={colX[4]} y={footerY(1)} w={colW[4]} h={rh} fill={SUM_FILL}><T size={fsName - 1} bold>계</T></Box>
        <Box x={colX[4]} y={footerY(2)} w={colW[4]} h={rh} fill={SUM_FILL}><T size={fsName - 1} bold>누계</T></Box>
        <Box x={x0} y={footerY(1)} w={periodsW} h={rh * 2} fill={SUM_FILL} right={false} />
        <Box x={width - noteW} y={footerY(0)} w={noteW} h={rh * 3} fill={SUM_FILL} />
        {b.totals.byPeriod.map((v, k) => (
          <View key={`p${k}`} style={{ position: "absolute", left: x0 + k * pw, top: footerY(1), width: pw, height: rh, justifyContent: "center" }}>
            <T size={Math.min(fsNum + 0.5, 7)} bold>{fmt(v, dec)}</T>
          </View>
        ))}
        {b.totals.cumulative.map((v, k) => (
          <View key={`c${k}`} style={{ position: "absolute", left: x0 + k * pw, top: footerY(2), width: pw, height: rh, justifyContent: "center" }}>
            <T size={Math.min(fsNum + 0.5, 7)} bold>{v.toFixed(dec)}</T>
          </View>
        ))}

        {/* 세로 격자선과 막대·구간 값 */}
        <PeriodLines hdr={b.periods} x0={x0} pw={pw} y={bodyY} h={bodyRows * rh} />
        {b.rows.map((r, i) => {
          const y = bodyY + i * rh;
          return (
            <View key={`b${i}`}>
              {r.bar && (
                <View
                  style={{
                    position: "absolute",
                    left: x0 + r.bar[0] * pw,
                    top: y + rh * 0.66,
                    width: Math.max(1, (r.bar[1] - r.bar[0]) * pw),
                    height: Math.max(1.2, rh * 0.1),
                    backgroundColor: BAR,
                  }}
                />
              )}
              {r.remark !== "" && r.bar && <RemarkText text={r.remark} bar={r.bar} x0={x0} pw={pw} periodsW={periodsW} y={y} rh={rh} />}
              {r.values.map((v, k) =>
                Math.abs(v) < 0.005 ? null : (
                  <View key={k} style={{ position: "absolute", left: x0 + k * pw, top: y + rh * 0.08, width: pw, height: rh * 0.55, justifyContent: "center" }}>
                    <T size={fsNum}>{fmt(v, rowDec)}</T>
                  </View>
                ),
              )}
            </View>
          );
        })}
        <View style={{ position: "absolute", left: 0, top: 0, width, height: totalH, borderWidth: 0.9, borderColor: "#1a1a1a" }} />
      </View>
    </View>
  );
}

export function ResourceBlock({ b, width }: { b: Of<"resource">; width: number }) {
  const P = b.periods.days.length;
  const colW = [18, 170, 40, 20];
  const noteW = 26;
  const fixedW = colW.reduce((a, c) => a + c, 0);
  const x0 = fixedW;
  const pw = (width - fixedW - noteW) / Math.max(P, 1);
  const hdrRh = 13;
  const totalRows = b.groups.reduce((a, g) => a + g.rows.length, 0);
  const rh = Math.max(7, Math.min(22, Math.floor(((PAGE_BODY - 3 * hdrRh - 30) / Math.max(totalRows, 1)) * 10) / 10));
  const fsName = Math.min(8.5, rh * 0.52);
  const fsNum = Math.max(3.5, Math.min(7, rh * 0.4, pw * 0.34 + 2));
  const bodyY = 3 * hdrRh;
  const totalH = bodyY + totalRows * rh;
  const colX: number[] = [0];
  colW.forEach((c, i) => colX.push(colX[i] + c));
  const periodsW = width - x0 - noteW;
  const starts: number[] = [];
  b.groups.reduce((acc, g) => {
    starts.push(acc);
    return acc + g.rows.length;
  }, 0);

  return (
    <View style={{ width }}>
      <TitleArea title={b.title} projectName={b.projectName} rightNote={b.rightNote} width={width} />
      <View style={{ width, height: totalH, position: "relative", marginTop: 6 }} wrap={false}>
        <Box x={0} y={0} w={colX[2]} h={3 * hdrRh} fill={HEAD_FILL} top left><T size={9} bold>구      분</T></Box>
        <Box x={colX[2]} y={0} w={colW[2]} h={3 * hdrRh} fill={HEAD_FILL} top><T size={7} bold>투입수</T></Box>
        <Box x={colX[3]} y={0} w={colW[3]} h={3 * hdrRh} fill={HEAD_FILL} top><T size={7} bold>{"단\n위"}</T></Box>
        <PeriodHead hdr={b.periods} x0={x0} pw={pw} y={0} rh={hdrRh} />
        <Box x={width - noteW} y={0} w={noteW} h={3 * hdrRh} fill={HEAD_FILL} top right><T size={7} bold>{"비\n고"}</T></Box>

        {b.groups.map((g, gi) => (
          <View key={gi}>
            <Box x={0} y={bodyY + starts[gi] * rh} w={colW[0]} h={g.rows.length * rh} fill={HEAD_FILL} left>
              <T size={8} bold>{g.label}</T>
            </Box>
            {g.rows.map((r, i) => {
              const y = bodyY + (starts[gi] + i) * rh;
              const fill = r.bold ? SUM_FILL : undefined;
              return (
                <View key={i}>
                  <Box x={colX[1]} y={y} w={colW[1]} h={rh} fill={fill}>
                    <View style={{ paddingHorizontal: 4 }}><T size={fsName} bold={r.bold} align={r.bold ? "center" : "left"}>{r.name}</T></View>
                  </Box>
                  <Box x={colX[2]} y={y} w={colW[2]} h={rh} fill={fill}>
                    <View style={{ paddingRight: 4 }}><T size={fsName} bold={r.bold} align="right">{r.total === 0 ? "" : r.total.toLocaleString("ko-KR")}</T></View>
                  </Box>
                  <Box x={colX[3]} y={y} w={colW[3]} h={rh} fill={fill}><T size={fsName - 1} bold={r.bold}>{r.unit}</T></Box>
                  <Box x={width - noteW} y={y} w={noteW} h={rh} fill={fill} />
                  {r.bold && <View style={{ position: "absolute", left: x0, top: y, width: periodsW, height: rh, backgroundColor: SUM_FILL }} />}
                  <View style={{ position: "absolute", left: x0, top: y + rh - 0.5, width: periodsW, height: 0.5, backgroundColor: GRID_SOFT }} />
                </View>
              );
            })}
          </View>
        ))}

        <PeriodLines hdr={b.periods} x0={x0} pw={pw} y={bodyY} h={totalRows * rh} />
        {b.groups.map((g, gi) =>
          g.rows.map((r, i) => {
            const y = bodyY + (starts[gi] + i) * rh;
            const dec = r.decimals ?? 0;
            return (
              <View key={`${gi}-${i}`}>
                {r.bar && (
                  <View style={{ position: "absolute", left: x0 + r.bar[0] * pw, top: y + rh * 0.66, width: Math.max(1, (r.bar[1] - r.bar[0]) * pw), height: Math.max(1.2, rh * 0.1), backgroundColor: BAR }} />
                )}
                {r.bar && r.remark && <RemarkText text={r.remark} bar={r.bar} x0={x0} pw={pw} periodsW={periodsW} y={y} rh={rh} />}
                {r.values.map((v, k) =>
                  Math.abs(v) < 0.005 ? null : (
                    <View key={k} style={{ position: "absolute", left: x0 + k * pw, top: y, width: pw, height: rh, justifyContent: "center" }}>
                      <T size={fsNum} bold={r.bold}>{v.toLocaleString("ko-KR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}</T>
                    </View>
                  ),
                )}
              </View>
            );
          }),
        )}
        <View style={{ position: "absolute", left: 0, top: 0, width, height: totalH, borderWidth: 0.9, borderColor: "#1a1a1a" }} />
      </View>
      <View style={{ marginTop: 6 }}>
        {b.notes.map((t, k) => (
          <Text key={k} style={{ fontSize: 7.5 }}>{`※ ${t}`}</Text>
        ))}
      </View>
    </View>
  );
}
