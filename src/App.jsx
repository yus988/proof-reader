import { useState, useRef, useEffect, useCallback } from "react";
import DiffViewer from "./DiffViewer.jsx";

const API = "/api";
const C = {
  bg: "#faf7f2", surface: "#fff", surfaceAlt: "#f3efe9",
  text: "#2c2825", muted: "#8a8078", border: "#e2dbd2",
  accent: "#b44d2d", accentSoft: "#f0ddd5",
  addBg: "#d6f0d6", addText: "#1a6b2c",
  delBg: "#fcdcda", delText: "#a4271a",
  header: "#2c2825", headerText: "#faf7f2",
};
const F = "'Meiryo', 'Hiragino Sans', sans-serif";

/* ══════════════════════════════════════
   CHAT PANEL — streaming output display
   ══════════════════════════════════════ */

function ChatPanel({ logs }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", background: "#1e1e1e", fontFamily: "Consolas, monospace", fontSize: 13, lineHeight: 1.7, color: "#d4d4d4" }}>
      {logs.map((log, i) => (
        <div key={i} style={{ marginBottom: 2, whiteSpace: "pre-wrap", wordBreak: "break-all",
          color: log.startsWith("[stderr]") ? "#f48771" : log.startsWith("(完了)") ? "#89d185" : "#d4d4d4" }}>
          {log}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

/* ══════════════════════════════════════
   INPUT SCREEN
   ══════════════════════════════════════ */

function InputScreen({ onStartProofread, onViewResults, hasResults, serverOk }) {
  const [text, setText] = useState("");
  const [provider, setProvider] = useState("claude");
  const [model, setModel] = useState("");
  const [preset, setPreset] = useState("standard");
  const [customInstructions, setCustomInstructions] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [available, setAvailable] = useState(null);
  const [presets, setPresets] = useState(null);
  const [models, setModels] = useState(null);

  // Load presets, providers, workflow on mount
  useEffect(() => {
    fetch(`${API}/presets`).then(r => r.json()).then(d => { setPresets(d.presets); setModels(d.models); }).catch(() => {});
    fetch(`${API}/providers`).then(r => r.json()).then(setAvailable).catch(() => setAvailable(null));
    fetch(`${API}/workflow`).then(r => r.json()).then(d => { if (d.content) setCustomInstructions(d.content); }).catch(() => {});
  }, []);

  // Auto-select model when preset or provider changes
  useEffect(() => {
    if (presets && presets[preset]) {
      const rec = presets[preset].recommendedModels?.[provider];
      if (rec) setModel(rec);
    }
  }, [preset, provider, presets]);

  // Auto-select first available provider
  useEffect(() => {
    if (available) {
      if (!available[provider]) {
        const first = Object.entries(available).find(([, v]) => v);
        if (first) setProvider(first[0]);
      }
    }
  }, [available]);

  const saveWorkflow = async () => {
    await fetch(`${API}/workflow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: customInstructions }) });
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    onStartProofread({ provider, model, preset, customInstructions, text });
  };

  const providerList = [
    { id: "claude", label: "Claude", desc: "Claude Code CLI" },
    { id: "codex", label: "Codex", desc: "OpenAI" },
    { id: "gemini", label: "Gemini", desc: "Google" },
  ];

  const presetList = presets ? Object.values(presets) : [
    { id: "light", label: "ライト", description: "誤字脱字・表記ゆれのみ" },
    { id: "standard", label: "スタンダード", description: "表記統一・文体改善" },
    { id: "thorough", label: "しっかり", description: "構成整理・論理チェック" },
    { id: "full", label: "フル", description: "ファクトチェック含む" },
  ];

  const modelList = models?.[provider] || [];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, fontFamily: F }}>
      <header style={{ background: C.header, color: C.headerText, padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>校正ビューワー</h1>
          <span style={{ fontSize: 11, opacity: 0.45, letterSpacing: "0.08em" }}>PROOFREAD</span>
        </div>
        {hasResults && (
          <button onClick={onViewResults} style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 6, cursor: "pointer",
            border: `1.5px solid ${C.headerText}44`, background: "transparent", color: C.headerText }}>前回の結果を表示</button>
        )}
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 24px", gap: 14, overflow: "auto" }}>
        {/* Provider */}
        <Section label="プロバイダ">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {providerList.map(p => {
              const ok = available === null || available[p.id];
              return (
                <button key={p.id} onClick={() => ok && setProvider(p.id)} disabled={available !== null && !ok}
                  style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 6, cursor: ok ? "pointer" : "not-allowed", textAlign: "left",
                    border: `1.5px solid ${provider === p.id ? C.accent : C.border}`, background: provider === p.id ? C.accentSoft : "transparent",
                    color: !ok ? C.border : provider === p.id ? C.accent : C.muted, opacity: ok ? 1 : 0.5, transition: "all 0.15s" }}>
                  <div>{p.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 1 }}>{p.desc}</div>
                  {available !== null && !ok && <div style={{ fontSize: 9, color: C.delText }}>未インストール</div>}
                </button>
              );
            })}
          </div>
          {!serverOk && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            サーバー未接続。<code style={{ background: C.surfaceAlt, padding: "1px 4px", borderRadius: 2 }}>npm start</code> を実行してください。</div>}
        </Section>

        {/* Preset */}
        <Section label="校正方針">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {presetList.map(p => (
              <button key={p.id} onClick={() => setPreset(p.id)}
                style={{ fontFamily: F, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 6, cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${preset === p.id ? C.accent : C.border}`, background: preset === p.id ? C.accentSoft : "transparent",
                  color: preset === p.id ? C.accent : C.muted, transition: "all 0.15s" }}>
                <div>{p.label}</div>
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 1 }}>{p.description}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Model */}
        <Section label="モデル">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {modelList.map(m => (
              <button key={m.id} onClick={() => setModel(m.id)}
                style={{ fontFamily: F, fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                  border: `1.5px solid ${model === m.id ? C.accent : C.border}`, background: model === m.id ? C.accentSoft : "transparent",
                  color: model === m.id ? C.accent : C.muted, transition: "all 0.15s" }}>
                {m.label} <span style={{ fontSize: 10, fontWeight: 400 }}>({m.desc})</span>
              </button>
            ))}
            {presets?.[preset]?.recommendedModels?.[provider] && (
              <span style={{ fontSize: 10, color: C.muted }}>
                * {presets[preset].label} のおすすめ: {presets[preset].recommendedModels[provider]}
              </span>
            )}
          </div>
        </Section>

        {/* Custom Instructions */}
        <Section label={
          <span style={{ cursor: "pointer" }} onClick={() => setShowCustom(!showCustom)}>
            カスタム指示 {showCustom ? "\u25B4" : "\u25BE"}
            {customInstructions && !showCustom && <span style={{ fontSize: 10, color: C.addText, marginLeft: 8 }}>設定済み</span>}
          </span>
        }>
          {showCustom && (
            <CustomInstructionsPanel
              value={customInstructions}
              onChange={setCustomInstructions}
              onSave={saveWorkflow}
              provider={provider}
              model={model}
              serverOk={serverOk}
            />
          )}
        </Section>

        {/* Text Input */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6, letterSpacing: "0.06em" }}>校正対象テキスト</div>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="ここに校正したいテキストを貼り付けてください..."
            style={{ flex: 1, fontFamily: F, fontSize: 14, lineHeight: 1.8, padding: 16,
              border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, resize: "none", outline: "none" }} />
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: "right" }}>{text.length} 文字</div>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={!text.trim() || !serverOk}
          style={{ fontFamily: F, fontSize: 15, fontWeight: 700, padding: "12px 24px", borderRadius: 8,
            border: "none", cursor: text.trim() && serverOk ? "pointer" : "not-allowed",
            background: text.trim() && serverOk ? C.accent : C.muted, color: "#fff",
            boxShadow: `0 2px 8px ${C.accent}44`, transition: "background 0.15s", alignSelf: "flex-end" }}>
          校正する
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   CUSTOM INSTRUCTIONS PANEL + WORKFLOW BUILDER
   ══════════════════════════════════════ */

function CustomInstructionsPanel({ value, onChange, onSave, provider, model, serverOk }) {
  const [showWizard, setShowWizard] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [wizardAnswers, setWizardAnswers] = useState({
    contentType: "", audience: "", style: "", depth: "", focus: "", terms: "", other: "",
  });

  const loadTemplate = async () => {
    try {
      const res = await fetch(`${API}/workflow-template`);
      const { content } = await res.json();
      if (content) onChange(content);
    } catch {}
  };

  const generateWorkflow = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/generate-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, answers: wizardAnswers }),
      });
      const { content, error } = await res.json();
      if (error) throw new Error(error);
      if (content) { onChange(content); setShowWizard(false); }
    } catch (e) {
      alert("生成失敗: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const questions = [
    { key: "contentType", label: "コンテンツの種類", placeholder: "例：技術ブログ、活動報告、プレスリリース、SNS投稿" },
    { key: "audience", label: "ターゲット読者", placeholder: "例：一般読者、エンジニア、投資家、社内メンバー" },
    { key: "style", label: "文体", placeholder: "例：です・ます調、丁寧で率直、フォーマル" },
    { key: "depth", label: "校正の深さ", placeholder: "例：表記統一のみ、構成の組み替えまで含む" },
    { key: "focus", label: "特に気をつけたい点", placeholder: "例：固有名詞の正確性、冗長な表現の削減、結論の前出し" },
    { key: "terms", label: "固有名詞・専門用語", placeholder: "例：Hapbeat, JLCPCB, ESP-NOW, BT=Bluetooth" },
    { key: "other", label: "その他の要望", placeholder: "例：図のキャプションは校正対象外、カジュアルすぎる表現を避ける" },
  ];

  const inputStyle = { fontFamily: F, fontSize: 12, padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 4, background: C.surface, color: C.text, outline: "none", width: "100%" };
  const smallBtn = (onClick, label, disabled) => (
    <button onClick={onClick} disabled={disabled} style={{ fontFamily: F, fontSize: 11, padding: "4px 12px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: disabled ? C.border : C.muted, cursor: disabled ? "not-allowed" : "pointer" }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder="校正の追加ルールや注意点を記述..."
        style={{ fontFamily: F, fontSize: 13, lineHeight: 1.6, padding: 12, minHeight: 120,
          border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.text, resize: "vertical", outline: "none" }} />
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {smallBtn(() => setShowWizard(!showWizard), showWizard ? "ウィザードを閉じる" : "AI でワークフロー作成")}
          {smallBtn(loadTemplate, "テンプレートを読み込み")}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {smallBtn(() => onChange(""), "クリア")}
          {smallBtn(onSave, "保存")}
        </div>
      </div>

      {showWizard && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
            ワークフロー作成ウィザード
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
            以下の質問に答えると、AI が校正ワークフローを自動生成します。すべて任意です。
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {questions.map(q => (
              <div key={q.key}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 3 }}>{q.label}</div>
                <input type="text" value={wizardAnswers[q.key]} placeholder={q.placeholder}
                  onChange={e => setWizardAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                  style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={generateWorkflow} disabled={generating || !serverOk}
              style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 6, cursor: generating ? "wait" : "pointer",
                border: "none", background: generating ? C.muted : C.accent, color: "#fff" }}>
              {generating ? "生成中..." : "AI で生成"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6, letterSpacing: "0.06em" }}>{label}</div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════
   PROOFREADING SCREEN — chat + progress
   ══════════════════════════════════════ */

function ProofreadingScreen({ logs, error, onCancel }) {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, fontFamily: F }}>
      <header style={{ background: C.header, color: C.headerText, padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>校正中...</h1>
        </div>
        <button onClick={onCancel} style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 6, cursor: "pointer",
          border: `1.5px solid ${C.headerText}44`, background: "transparent", color: C.headerText }}>キャンセル</button>
      </header>
      <ChatPanel logs={logs} />
      {error && (
        <div style={{ padding: "12px 24px", background: C.delBg, color: C.delText, fontSize: 13, flexShrink: 0 }}>{error}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   APP — router
   ══════════════════════════════════════ */

export default function App() {
  // screen: "input" | "proofreading" | "viewer"
  const [screen, setScreen] = useState("input");
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [serverOk, setServerOk] = useState(false);
  const abortRef = useRef(null);

  // Check server + load existing data
  useEffect(() => {
    fetch(`${API}/providers`).then(r => { if (r.ok) setServerOk(true); }).catch(() => {});
    fetch(`${API}/data`).then(r => { if (r.ok) return r.json(); throw 0; }).then(d => { if (d.original && d.corrected_md) setData(d); }).catch(() => {});
  }, []);

  const startProofread = useCallback(async (params) => {
    setScreen("proofreading");
    setLogs([]);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API}/proofread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "サーバーエラー");
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const eventMatch = part.match(/^event:\s*(.+)/m);
          const dataMatch = part.match(/^data:\s*(.+)/m);
          if (!eventMatch || !dataMatch) continue;
          const eventType = eventMatch[1];
          const eventData = JSON.parse(dataMatch[1]);
          if (eventType === "log") {
            setLogs(prev => [...prev, eventData.text]);
          } else if (eventType === "done") {
            // Load updated data.json
            const dataRes = await fetch(`${API}/data?` + Date.now());
            const newData = await dataRes.json();
            setData(newData);
            setScreen("viewer");
          } else if (eventType === "error") {
            setError(eventData.message);
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setError(e.message);
      }
    }
  }, []);

  const cancelProofread = useCallback(() => {
    abortRef.current?.abort();
    setScreen("input");
  }, []);

  if (screen === "viewer" && data) {
    return <DiffViewer data={data} onBack={() => setScreen("input")} />;
  }
  if (screen === "proofreading") {
    return <ProofreadingScreen logs={logs} error={error} onCancel={cancelProofread} />;
  }
  return (
    <InputScreen
      onStartProofread={startProofread}
      onViewResults={() => setScreen("viewer")}
      hasResults={!!data}
      serverOk={serverOk}
    />
  );
}
