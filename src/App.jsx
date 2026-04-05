import { useState, useRef, useCallback, useMemo, useEffect } from "react";

const API_BASE = "/api";

/* ══════════════════════════════════════
   STYLES
   ══════════════════════════════════════ */

const C = {
  bg: "#faf7f2", surface: "#fff", surfaceAlt: "#f3efe9",
  text: "#2c2825", muted: "#8a8078", border: "#e2dbd2",
  accent: "#b44d2d", accentSoft: "#f0ddd5",
  addBg: "#d6f0d6", addText: "#1a6b2c",
  delBg: "#fcdcda", delText: "#a4271a",
  header: "#2c2825", headerText: "#faf7f2",
  tipBg: "#2c2825", tipText: "#faf7f2",
  copyFlash: "#e8ddd0",
};
const F = "'Meiryo', 'Hiragino Sans', sans-serif";

/* ══════════════════════════════════════
   MD PARSER / DIFF ENGINE (unchanged)
   ══════════════════════════════════════ */

function parseMd(md) {
  let plain = "";
  const bolds = [];
  let i = 0;
  while (i < md.length) {
    if (md[i] === "*" && md[i + 1] === "*") {
      const end = md.indexOf("**", i + 2);
      if (end >= 0) {
        const start = plain.length;
        const content = md.slice(i + 2, end);
        plain += content;
        bolds.push({ start, end: plain.length });
        i = end + 2;
        continue;
      }
    }
    plain += md[i];
    i++;
  }
  return { plain, bolds };
}

function buildPosAnns(original, corrected, annotations) {
  const anns = [];
  for (const a of annotations) {
    const oi = original.indexOf(a.origFrom);
    const ci = corrected.indexOf(a.corrFrom);
    if (oi >= 0) anns.push({ start: oi, end: oi + a.origFrom.length, side: "orig", reason: a.reason });
    if (ci >= 0) anns.push({ start: ci, end: ci + a.corrFrom.length, side: "corr", reason: a.reason });
  }
  return anns;
}

function computeDiff(oldText, newText) {
  const oldC = [...oldText], newC = [...newText];
  const m = oldC.length, n = newC.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldC[i - 1] === newC[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const raw = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldC[i - 1] === newC[j - 1]) { raw.unshift({ type: "same", char: oldC[i - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { raw.unshift({ type: "add", char: newC[j - 1] }); j--; }
    else { raw.unshift({ type: "del", char: oldC[i - 1] }); i--; }
  }
  const merged = [];
  for (const r of raw) {
    if (merged.length && merged[merged.length - 1].type === r.type) merged[merged.length - 1].text += r.char;
    else merged.push({ type: r.type, text: r.char });
  }
  return merged;
}

function annotateDiff(diff, posAnns, boldRanges) {
  let origPos = 0, corrPos = 0;
  const result = [];
  const getReason = (side, s, e) => {
    for (const a of posAnns) { if (a.side === side && s < a.end && e > a.start) return a.reason; }
    return null;
  };
  for (const d of diff) {
    const len = d.text.length;
    if (d.type === "del") {
      result.push({ ...d, reason: getReason("orig", origPos, origPos + len), bold: false });
      origPos += len;
    } else {
      const startCorr = corrPos;
      const cuts = new Set([0, len]);
      for (const b of boldRanges) {
        const rs = b.start - startCorr, re = b.end - startCorr;
        if (rs > 0 && rs < len) cuts.add(rs);
        if (re > 0 && re < len) cuts.add(re);
      }
      const sorted = [...cuts].sort((a, b) => a - b);
      for (let k = 0; k < sorted.length - 1; k++) {
        const from = sorted[k], to = sorted[k + 1];
        const subText = d.text.slice(from, to);
        if (!subText) continue;
        const absFrom = startCorr + from, absTo = startCorr + to;
        let bold = false;
        for (const b of boldRanges) { if (absFrom >= b.start && absTo <= b.end) { bold = true; break; } }
        const reason = d.type === "add" ? getReason("corr", absFrom, absTo) : null;
        result.push({ type: d.type, text: subText, reason, bold });
      }
      corrPos += len;
      if (d.type === "same") origPos += len;
    }
  }
  return result;
}

function splitIntoParagraphs(adiff) {
  const groups = [[]];
  for (const d of adiff) {
    if (d.type === "del") { groups[groups.length - 1].push(d); continue; }
    const parts = d.text.split("\n\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) groups.push([]);
      if (parts[i]) groups[groups.length - 1].push({ ...d, text: parts[i] });
    }
  }
  return groups;
}

function copyText(text) {
  if (!text) return;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch (e) {}
}

/* ══════════════════════════════════════
   INPUT SCREEN
   ══════════════════════════════════════ */

function InputScreen({ onResult }) {
  const [text, setText] = useState("");
  const [provider, setProvider] = useState("claude");
  const [available, setAvailable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/providers`)
      .then(r => r.json())
      .then(setAvailable)
      .catch(() => setAvailable(null));
  }, []);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/proofread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      // data.json が更新されたので読み込む
      const dataRes = await fetch(`${API_BASE}/data?` + Date.now());
      const data = await dataRes.json();
      onResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const providers = [
    { id: "claude", label: "Claude", desc: "Claude Code CLI" },
    { id: "codex", label: "Codex", desc: "Codex CLI (OpenAI)" },
    { id: "gemini", label: "Gemini", desc: "Gemini CLI (Google)" },
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, fontFamily: F }}>
      <header style={{ background: C.header, color: C.headerText, padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>校正ビューワー</h1>
          <span style={{ fontSize: 11, opacity: 0.45, letterSpacing: "0.08em" }}>PROOFREAD</span>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 16, overflow: "auto" }}>
        {/* プロバイダ選択 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, letterSpacing: "0.06em" }}>
            プロバイダ
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {providers.map(p => {
              const isAvailable = available === null || available[p.id];
              return (
                <button key={p.id} onClick={() => setProvider(p.id)}
                  disabled={available !== null && !available[p.id]}
                  style={{
                    fontFamily: F, fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 6, cursor: isAvailable ? "pointer" : "not-allowed",
                    border: `1.5px solid ${provider === p.id ? C.accent : C.border}`,
                    background: provider === p.id ? C.accentSoft : "transparent",
                    color: !isAvailable ? C.border : provider === p.id ? C.accent : C.muted,
                    transition: "all 0.15s", opacity: isAvailable ? 1 : 0.5,
                  }}>
                  {p.label}
                  <span style={{ fontSize: 10, display: "block", fontWeight: 400, marginTop: 2 }}>{p.desc}</span>
                  {available !== null && !available[p.id] && (
                    <span style={{ fontSize: 9, display: "block", color: C.delText }}>未インストール</span>
                  )}
                </button>
              );
            })}
          </div>
          {available === null && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
              校正サーバーに接続できません。<code style={{ background: C.surfaceAlt, padding: "1px 4px", borderRadius: 2 }}>npm run server</code> を実行してください。
            </div>
          )}
        </div>

        {/* テキスト入力 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, letterSpacing: "0.06em" }}>
            校正対象テキスト
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="ここに校正したいテキストを貼り付けてください..."
            style={{
              flex: 1, fontFamily: F, fontSize: 14, lineHeight: 1.8, padding: 16,
              border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface,
              color: C.text, resize: "none", outline: "none",
            }}
          />
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: "right" }}>
            {text.length} 文字
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div style={{ background: C.delBg, color: C.delText, padding: "10px 16px", borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* 実行ボタン */}
        <button onClick={handleSubmit} disabled={loading || !text.trim() || available === null}
          style={{
            fontFamily: F, fontSize: 15, fontWeight: 700, padding: "12px 24px", borderRadius: 8,
            border: "none", cursor: loading ? "wait" : "pointer",
            background: loading ? C.muted : C.accent, color: "#fff",
            boxShadow: `0 2px 8px ${C.accent}44`, transition: "background 0.15s",
            alignSelf: "flex-end",
          }}>
          {loading ? "校正中..." : "校正する"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DIFF VIEWER (existing, now accepts data as prop)
   ══════════════════════════════════════ */

function DiffViewer({ data, onBack }) {
  const ORIGINAL = data.original;
  const CORRECTED_MD = data.corrected_md;
  const ANNOTATIONS_DEF = data.annotations;
  const { plain: CORRECTED, bolds: BOLD_RANGES } = useMemo(() => parseMd(CORRECTED_MD), [CORRECTED_MD]);
  const CORRECTED_MD_PARAS = useMemo(() => CORRECTED_MD.split("\n\n"), [CORRECTED_MD]);
  const POS_ANNS = useMemo(() => buildPosAnns(ORIGINAL, CORRECTED, ANNOTATIONS_DEF), [ORIGINAL, CORRECTED, ANNOTATIONS_DEF]);

  const [viewMode, setViewMode] = useState("side");
  const [tooltip, setTooltip] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const copyTimerRef = useRef(null);

  const diff = useMemo(() => computeDiff(ORIGINAL, CORRECTED), [ORIGINAL, CORRECTED]);
  const adiff = useMemo(() => annotateDiff(diff, POS_ANNS, BOLD_RANGES), [diff, POS_ANNS, BOLD_RANGES]);
  const paraGroups = useMemo(() => splitIntoParagraphs(adiff), [adiff]);
  const changes = adiff.filter(d => d.type !== "same").length;

  const showTip = useCallback((reason, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ reason, x: rect.left + rect.width / 2, y: rect.top - 6 });
  }, []);
  const hideTip = useCallback(() => setTooltip(null), []);

  const flashCopy = useCallback((id) => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopiedIdx(id);
    copyTimerRef.current = setTimeout(() => setCopiedIdx(null), 800);
  }, []);

  const copyParagraph = useCallback((paraIdx, e) => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    const md = CORRECTED_MD_PARAS[paraIdx] || "";
    if (md) { copyText(md); flashCopy(paraIdx); }
  }, [CORRECTED_MD_PARAS, flashCopy]);

  const copyAll = useCallback(() => {
    copyText(CORRECTED_MD);
    flashCopy("all");
  }, [CORRECTED_MD, flashCopy]);

  const textStyle = { fontFamily: F, fontSize: 15, lineHeight: 2, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-all" };

  const renderSpan = (d, i, filter) => {
    if (filter && d.type !== "same" && d.type !== filter) return null;
    if (d.type === "same") return <span key={i} style={d.bold ? { fontWeight: 700 } : undefined}>{d.text}</span>;
    const isDel = d.type === "del";
    const baseStyle = isDel
      ? { background: C.delBg, color: C.delText, textDecoration: "line-through", textDecorationColor: `${C.delText}66` }
      : { background: C.addBg, color: C.addText };
    return (
      <span key={i}
        onMouseEnter={d.reason ? (e) => showTip(d.reason, e) : undefined}
        onMouseLeave={d.reason ? hideTip : undefined}
        style={{ ...baseStyle, fontWeight: d.bold ? 700 : "normal", borderRadius: 2, padding: "0 1px",
          cursor: d.reason ? "help" : "default",
          borderBottom: d.reason ? `2px dotted ${isDel ? C.delText : C.addText}88` : "none",
        }}>{d.text}</span>
    );
  };

  const renderParagraph = (group, paraIdx, filter) => (
    <div key={paraIdx} onClick={(e) => copyParagraph(paraIdx, e)}
      style={{ padding: "2px 4px", marginBottom: 4, borderRadius: 4, cursor: "text",
        transition: "background 0.15s", background: copiedIdx === paraIdx ? C.copyFlash : "transparent",
        userSelect: "text",
      }} title="クリックで段落コピー（md）／ドラッグで部分選択">
      {group.map((d, i) => renderSpan(d, i, filter))}
    </div>
  );

  const Btn = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
      fontFamily: F, fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 6, cursor: "pointer",
      border: `1.5px solid ${active ? C.accent : C.border}`,
      background: active ? C.accentSoft : "transparent",
      color: active ? C.accent : C.muted, transition: "all 0.15s",
    }}>{children}</button>
  );

  const PanelHeader = ({ color, label }) => (
    <div style={{ padding: "10px 20px", background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`,
      fontFamily: F, fontSize: 12, fontWeight: 700, color: C.muted,
      letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, opacity: 0.6 }} />
      {label}
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, fontFamily: F }}>
      <header style={{ background: C.header, color: C.headerText, padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && (
            <button onClick={onBack} style={{
              background: "transparent", border: "none", color: C.headerText, cursor: "pointer",
              fontSize: 16, padding: "4px 8px", borderRadius: 4, opacity: 0.7,
            }}>&#x2190; 戻る</button>
          )}
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>校正ビューワー</h1>
          <span style={{ fontSize: 11, opacity: 0.45, letterSpacing: "0.08em" }}>DIFF VIEWER</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, background: C.accent, color: "#fff", borderRadius: 20, padding: "4px 14px" }}>
          {changes} 箇所修正
        </span>
      </header>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 24px", background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn active={viewMode === "side"} onClick={() => setViewMode("side")}>&#x25EB; 並列</Btn>
          <Btn active={viewMode === "inline"} onClick={() => setViewMode("inline")}>&#x2261; インライン</Btn>
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>クリックで段落コピー（md） ／ ドラッグで部分選択 ／ 点線ホバーで修正理由</div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {viewMode === "side" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", flexShrink: 0 }}>
              <div style={{ flex: 1, borderRight: `1px solid ${C.border}` }}>
                <PanelHeader color={C.delText} label="原文" />
              </div>
              <div style={{ flex: 1 }}>
                <PanelHeader color={C.addText} label="校正後" />
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 0" }}>
              {paraGroups.map((g, pi) => (
                <div key={pi} style={{ display: "flex", borderBottom: `1px solid ${C.border}22`, minHeight: 20 }}>
                  <div style={{ flex: 1, padding: "4px 22px", borderRight: `1px solid ${C.border}` }}>
                    <div style={textStyle}>{renderParagraph(g, pi, "del")}</div>
                  </div>
                  <div style={{ flex: 1, padding: "4px 22px" }}>
                    <div style={textStyle}>{renderParagraph(g, pi, "add")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "10px 20px", background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`,
              fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.06em",
              display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
              <span>インライン比較</span>
              <span style={{ display: "flex", gap: 10, fontSize: 11, fontWeight: 500, letterSpacing: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: C.delBg, border: `1px solid ${C.delText}33` }} /> 削除
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: C.addBg, border: `1px solid ${C.addText}33` }} /> 追加
                </span>
              </span>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 26 }}>
              <div style={{ ...textStyle, lineHeight: 2.2 }}>{paraGroups.map((g, pi) => renderParagraph(g, pi, null))}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "10px 24px", background: copiedIdx === "all" ? C.copyFlash : C.surface,
        borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", flexShrink: 0,
        transition: "background 0.15s" }}>
        <button onClick={copyAll} style={{
          fontFamily: F, fontSize: 13, fontWeight: 600, padding: "6px 18px", borderRadius: 6,
          border: "none", cursor: "pointer",
          background: copiedIdx === "all" ? C.addText : C.accent,
          color: "#fff", boxShadow: `0 2px 8px ${C.accent}44`, transition: "background 0.15s",
        }}>{copiedIdx === "all" ? "\u2713 コピーしました" : "\uD83D\uDCCB 全文コピー（md）"}</button>
      </div>

      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)",
          background: C.tipBg, color: C.tipText, fontSize: 12, fontWeight: 500, lineHeight: 1.6,
          padding: "8px 14px", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          maxWidth: 280, whiteSpace: "normal", wordBreak: "keep-all", overflowWrap: "break-word",
          zIndex: 9999, pointerEvents: "none",
        }}>
          {tooltip.reason}
          <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: `6px solid ${C.tipBg}` }} />
        </div>
      )}

      {copiedIdx !== null && copiedIdx !== "all" && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: C.header, color: C.headerText, fontSize: 13, fontWeight: 600,
          padding: "8px 20px", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 9999,
        }}>{"\u2713"} 段落をコピーしました</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   APP (router)
   ══════════════════════════════════════ */

export default function App() {
  const [data, setData] = useState(null);

  // 起動時に既存の data.json があれば読み込む
  useEffect(() => {
    fetch(`${API_BASE}/data`)
      .then(r => { if (r.ok) return r.json(); throw new Error(); })
      .then(d => { if (d.original && d.corrected_md) setData(d); })
      .catch(() => {});
  }, []);

  if (data) {
    return <DiffViewer data={data} onBack={() => setData(null)} />;
  }
  return <InputScreen onResult={setData} />;
}
