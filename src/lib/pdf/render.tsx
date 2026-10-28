// DocSpec → PDF (SRS SR-CM-01, 8.4). 서버에서만 쓴다(글꼴 파일을 디스크에서 읽는다).
// 글꼴은 Noto Sans KR(OFL)을 쓴다. 맑은 고딕은 서버에 재배포할 수 없다(assets/fonts/README.txt).

import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Block, DocSpec } from "@/domain/documents/model";
import { CoverBlock, GanttBlock, GridBlock, LetterheadBlock, OrgChartBlock, PairsBlock, ResourceBlock, RuleBlock } from "./blocks";

const fontDir = path.join(process.cwd(), "assets", "fonts");
let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({
    family: "NotoSansKR",
    fonts: [
      { src: path.join(fontDir, "NotoSansKR-Regular.otf"), fontWeight: 400 },
      { src: path.join(fontDir, "NotoSansKR-Bold.otf"), fontWeight: 700 },
    ],
  });
  // 한글은 단어 중간에서 줄바꿈하지 않도록 단어 단위로 둔다
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansKR", fontSize: 11, padding: 56, lineHeight: 1.6 },
  title: { fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 24 },
  paragraph: { marginVertical: 6 },
  fieldsWrap: { borderTop: "1pt solid #444", marginVertical: 10 },
  fieldRow: { flexDirection: "row", borderBottom: "1pt solid #888" },
  fieldLabel: { width: "30%", padding: 6, backgroundColor: "#f0f0f0", fontWeight: 700 },
  fieldValue: { width: "70%", padding: 6 },
  tableHead: { flexDirection: "row", backgroundColor: "#f0f0f0", borderTop: "1pt solid #444", borderBottom: "1pt solid #888" },
  tableRow: { flexDirection: "row", borderBottom: "1pt solid #bbb" },
  cell: { padding: 5, flexGrow: 1, flexBasis: 0 },
  org: { alignItems: "center", marginTop: 20 },
  orgBox: { border: "1pt solid #444", padding: 10, minWidth: 260, alignItems: "center" },
  orgArrow: { marginVertical: 6, fontSize: 14 },
  sign: { marginTop: 30, textAlign: "right" },
});

function BlockView({ b, compact = false, width }: { b: Block; compact?: boolean; width: number }) {
  const cp = compact ? { text: { fontSize: 9, lineHeight: 1.3 }, cellPad: 2 } : null;
  switch (b.type) {
    case "title":
      return <Text style={cp ? [s.title, { fontSize: 16, marginBottom: 8 }] : s.title}>{b.text}</Text>;
    case "paragraph":
      return (
        <Text
          style={[
            s.paragraph,
            { textAlign: b.align ?? "left", fontWeight: b.bold ? 700 : 400 },
            ...(b.size ? [{ fontSize: b.size }] : []),
            ...(b.indent ? [{ marginLeft: b.indent }] : []),
            ...(b.leading ? [{ lineHeight: b.leading }] : []),
            ...(cp ? [{ ...cp.text, marginVertical: 2 }] : []),
          ]}
        >
          {b.text}
        </Text>
      );
    case "letterhead":
      return <LetterheadBlock b={b} />;
    case "rule":
      return <RuleBlock b={b} />;
    case "pagebreak":
      return <View break />;
    case "pairs":
      return <PairsBlock b={b} />;
    case "grid":
      return <GridBlock b={b} width={width} />;
    case "cover":
      return <CoverBlock b={b} />;
    case "orgchart":
      return <OrgChartBlock b={b} width={width} />;
    case "gantt":
      return <GanttBlock b={b} width={width} />;
    case "resource":
      return <ResourceBlock b={b} width={width} />;
    case "fields":
      return (
        <View style={[s.fieldsWrap, ...(cp ? [{ marginVertical: 3 }] : [])]}>
          {b.rows.map((r, k) => (
            <View key={k} style={s.fieldRow} wrap={false}>
              <Text style={[s.fieldLabel, ...(cp ? [{ ...cp.text, padding: 2 }] : [])]}>{r.label}</Text>
              <Text style={[s.fieldValue, ...(cp ? [{ ...cp.text, padding: 2 }] : [])]}>{r.value}</Text>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <View style={{ marginVertical: b.fontSize || cp ? 4 : 10 }}>
          <View style={s.tableHead}>
            {b.header.map((h, k) => (
              <Text
                key={k}
                style={[
                  s.cell,
                  { fontWeight: 700, fontSize: b.fontSize ?? cp?.text.fontSize, padding: b.fontSize ? (b.fontSize >= 8 ? 2 : 1) : (cp?.cellPad ?? 5), lineHeight: b.fontSize ? 1.2 : cp?.text.lineHeight, flexGrow: b.colWidths?.[k] ?? (k === 0 && b.firstColWidth ? b.firstColWidth / 4 : 1), textAlign: b.align?.[k] ?? "left" },
                ]}
              >
                {h}
              </Text>
            ))}
          </View>
          {b.rows.map((row, r) => (
            <View key={r} style={s.tableRow} wrap={false}>
              {row.map((c, k) => (
                <Text
                  key={k}
                  style={[
                    s.cell,
                    {
                      fontSize: b.fontSize ?? cp?.text.fontSize,
                      padding: b.fontSize ? (b.fontSize >= 8 ? 2 : 1) : (cp?.cellPad ?? 5), lineHeight: b.fontSize ? 1.2 : cp?.text.lineHeight,
                      fontWeight: b.boldRows?.includes(r) ? 700 : 400,
                      flexGrow: b.colWidths?.[k] ?? (k === 0 && b.firstColWidth ? b.firstColWidth / 4 : 1),
                      textAlign: b.align?.[k] ?? "left",
                    },
                  ]}
                >
                  {c}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "signature":
      return (
        <View style={[s.sign, ...(cp ? [{ marginTop: 6 }] : [])]}>
          {b.lines.map((l, k) => (
            <Text key={k} style={cp ? cp.text : undefined}>{l}</Text>
          ))}
        </View>
      );
    case "org":
      return (
        <View style={s.org}>
          {b.levels.map((lv, k) => (
            <View key={k} style={{ alignItems: "center" }}>
              {k > 0 && <Text style={s.orgArrow}>▼</Text>}
              <View style={s.orgBox}>
                <Text style={{ fontWeight: 700 }}>{lv.title}</Text>
                {lv.lines.map((l, j) => (
                  <Text key={j}>{l}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    case "spacer":
      return <View style={{ height: b.size ?? 16 }} />;
  }
}

/** 쪽 안쪽 너비(pt): 용지 너비 − 좌우 여백 */
function contentWidth(spec: DocSpec): number {
  const paper = spec.page?.size === "A3" ? (spec.page.landscape ? 1190.55 : 841.89) : spec.page?.landscape ? 841.89 : 595.28;
  const pad = spec.compact ? 34 : spec.page ? 28 : 56;
  return paper - pad * 2;
}

export async function renderDocPdf(spec: DocSpec): Promise<Uint8Array> {
  registerFonts();
  const buf = await renderToBuffer(
    <Document title={spec.title} language="ko">
      <Page
        size={spec.page?.size ?? "A4"}
        orientation={spec.page?.landscape ? "landscape" : "portrait"}
        style={spec.compact ? [s.page, { padding: 34, fontSize: 9 }] : spec.page ? [s.page, { padding: 28 }] : s.page}
      >
        {spec.frame && <View fixed style={{ position: "absolute", top: 28, left: 28, right: 28, bottom: 44, borderWidth: 1, borderColor: "#1a1a1a" }} />}
        {spec.blocks.map((b, k) => (
          <BlockView key={k} b={b} compact={spec.compact} width={contentWidth(spec)} />
        ))}
      </Page>
    </Document>,
  );
  return new Uint8Array(buf);
}
