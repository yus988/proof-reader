import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3456;
const DATA_PATH = join(__dirname, "data", "data.json");
const WORKFLOW_PATH = join(__dirname, "data", "workflow.md");

/* ══════════════════════════════════════
   PRESETS
   ══════════════════════════════════════ */

const PRESETS = {
  light: {
    id: "light", label: "ライト",
    description: "誤字脱字・表記ゆれの修正のみ",
    recommendedModels: { claude: "claude-haiku-4-5", codex: "gpt-4.1-mini", gemini: "gemini-2.5-flash" },
    prompt: `以下のテキストの誤字脱字と表記ゆれのみを修正してください。
文の構成・表現・トーンは一切変更しないでください。

修正対象:
- 誤字・脱字・誤変換
- 表記ゆれの統一（全角数字→半角、Wifi→Wi-Fi 等）
- 日本語とアルファベット/数字の間のスペース
- ひらがなにすべき語の統一（事→こと、為→ため 等）`,
  },
  standard: {
    id: "standard", label: "スタンダード",
    description: "表記統一・文体改善・冗長表現の簡潔化",
    recommendedModels: { claude: "claude-sonnet-4-6", codex: "gpt-4.1", gemini: "gemini-2.5-flash" },
    prompt: `以下のテキストを校正してください。

修正対象:
- 誤字・脱字・誤変換
- 表記ゆれの統一（全角数字→半角、固有名詞の正式表記）
- 文体の統一（です・ます調）
- 冗長な表現の簡潔化（意味を変えない範囲で）
- 段落内改行の最適化（話題の転換点で改行）
- 句読点の適正化
- 日本語とアルファベット/数字の間のスペース`,
  },
  thorough: {
    id: "thorough", label: "しっかり",
    description: "構成整理・論理チェック・段落再構成を含む",
    recommendedModels: { claude: "claude-sonnet-4-6", codex: "o3", gemini: "gemini-2.5-pro" },
    prompt: `以下のテキストを校正し、構成も改善してください。初回から厳しめに校正してください。

修正対象:
- 誤字・脱字・表記ゆれの統一
- 文体統一・冗長表現の改善
- 構成の整理（読者が理解しやすい順序に組み替え）
- 段落の分割・統合・並べ替え
- 結論・要点の前出し
- 指示語（「この点」「それ」等）の指示先の明確化
- 重複表現・重複段落の削除
- 一文が長すぎる場合は分割
- 読者視点で「何ができるようになるか」が明確か確認`,
  },
  full: {
    id: "full", label: "フル",
    description: "ファクトチェック・Web検索を含む総合校正",
    recommendedModels: { claude: "claude-opus-4-6", codex: "o3", gemini: "gemini-2.5-pro" },
    prompt: `以下のテキストを総合的に校正してください。初回から厳しめに校正してください。
固有名詞・技術用語・数値の正確性はWeb検索で確認してください。

修正対象:
- 誤字・脱字・表記ゆれの統一
- 文体統一・冗長表現の改善
- 構成の整理（背景・課題→解決方針→実装→結果・今後）
- 段落の分割・統合・並べ替え
- ファクトチェック（施設名、組織名、技術用語の正式表記をWeb検索で確認）
- 読者視点での改善（「何ができるようになるか」が明確か）
- 結論・要点の前出し
- 重複の削除
- カジュアルすぎる表現の調整
- 読者にとって不要な弁明・言い訳の削除`,
  },
};

const MODELS = {
  claude: [
    { id: "claude-opus-4-6", label: "Opus 4.6", desc: "最高品質" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6", desc: "バランス" },
    { id: "claude-haiku-4-5", label: "Haiku 4.5", desc: "高速" },
  ],
  codex: [
    { id: "o3", label: "o3", desc: "最高推論" },
    { id: "o4-mini", label: "o4-mini", desc: "高速推論" },
    { id: "gpt-4.1", label: "GPT-4.1", desc: "バランス" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", desc: "高速" },
  ],
  gemini: [
    { id: "gemini-2.5-pro", label: "2.5 Pro", desc: "高品質" },
    { id: "gemini-2.5-flash", label: "2.5 Flash", desc: "高速" },
  ],
};

/* ══════════════════════════════════════
   CLI CONFIG
   ══════════════════════════════════════ */

const PROVIDERS = {
  claude: {
    cmd: "claude",
    args: (prompt, model) => {
      const a = ["-p", prompt, "--output-format", "stream-json"];
      if (model) a.push("--model", model);
      return a;
    },
  },
  codex: {
    cmd: "codex",
    args: (prompt, model) => {
      const a = ["exec", prompt, "--json"];
      if (model) a.push("--model", model);
      return a;
    },
  },
  gemini: {
    cmd: "gemini",
    args: (prompt, model) => {
      const a = ["-p", prompt, "--output-format", "stream-json"];
      if (model) a.push("--model", model);
      return a;
    },
  },
};

/* ══════════════════════════════════════
   PROMPT BUILDER
   ══════════════════════════════════════ */

const OUTPUT_FORMAT = `
## 出力形式

校正結果を以下の JSON 形式で出力してください。JSON のみを出力し、それ以外のテキストは含めないでください。

\`\`\`json
{
  "original": "校正前の原文テキスト（そのまま）",
  "corrected_md": "校正後テキスト（**太字** で変更の要点を強調可）",
  "annotations": [
    {
      "origFrom": "原文の該当箇所（部分文字列）",
      "corrFrom": "校正後の該当箇所（部分文字列）",
      "reason": "修正理由"
    }
  ]
}
\`\`\`

### JSON の注意点
- original には入力テキストをそのまま入れる
- corrected_md では修正を適用し、特に重要な変更点を **太字** で強調してよい
- annotations は修正箇所ごとに 1 エントリ。origFrom / corrFrom は原文・校正後テキスト内で一意に特定できる部分文字列にする
- 段落区切りは \\n\\n、段落内改行は \\n
- JSON のエスケープ規則に従う（" → \\"）
`;

function buildPrompt(presetId, customInstructions, text) {
  const preset = PRESETS[presetId] || PRESETS.standard;
  let prompt = preset.prompt + "\n";
  if (customInstructions && customInstructions.trim()) {
    prompt += `\n## カスタム指示\n\n${customInstructions.trim()}\n`;
  }
  prompt += OUTPUT_FORMAT;
  prompt += `\n## 校正対象テキスト\n\n${text}`;
  return prompt;
}

/* ══════════════════════════════════════
   HELPERS
   ══════════════════════════════════════ */

function extractJSONFromText(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  if (fenced) return JSON.parse(fenced[1].trim());
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("JSON が見つかりませんでした");
}

function validateData(data) {
  if (typeof data.original !== "string") throw new Error("original が文字列ではありません");
  if (typeof data.corrected_md !== "string") throw new Error("corrected_md が文字列ではありません");
  if (!Array.isArray(data.annotations)) throw new Error("annotations が配列ではありません");
  return data;
}

function checkCLI(cmd) {
  return new Promise((resolve) => {
    execFile(cmd, ["--version"], { timeout: 5000, windowsHide: true }, (err) => resolve(!err));
  });
}

async function ensureDataDir() {
  await mkdir(join(__dirname, "data"), { recursive: true });
}

/* ══════════════════════════════════════
   STREAMING PROOFREAD
   ══════════════════════════════════════ */

function streamProofread(res, provider, model, prompt) {
  const config = PROVIDERS[provider];
  if (!config) { sendSSE(res, "error", { message: `未対応: ${provider}` }); res.end(); return; }

  const args = config.args(prompt, model);
  const child = spawn(config.cmd, args, { windowsHide: true, env: { ...process.env } });
  let stdout = "";

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdout += text;
    // Stream each line as a log event
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      // Try to extract readable text from stream-json events
      try {
        const evt = JSON.parse(line);
        if (evt.type === "assistant" && evt.message?.content) {
          for (const block of evt.message.content) {
            if (block.type === "text" && block.text) sendSSE(res, "log", { text: block.text });
          }
        } else if (evt.type === "result" && evt.result) {
          sendSSE(res, "log", { text: "(完了)" });
        } else if (evt.message || evt.text || evt.content || evt.response) {
          sendSSE(res, "log", { text: evt.message || evt.text || evt.content || evt.response });
        }
      } catch {
        // Not JSON, send raw text
        if (line.trim()) sendSSE(res, "log", { text: line.trim() });
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString().trim();
    if (text) sendSSE(res, "log", { text: `[stderr] ${text}` });
  });

  child.on("error", (err) => {
    const msg = err.code === "ENOENT"
      ? `${config.cmd} が見つかりません。インストールしてログインしてください。`
      : `${config.cmd} エラー: ${err.message}`;
    sendSSE(res, "error", { message: msg });
    res.end();
  });

  child.on("close", async (code) => {
    if (code !== 0 && !stdout.trim()) {
      sendSSE(res, "error", { message: `${config.cmd} が終了コード ${code} で終了しました` });
      res.end();
      return;
    }
    try {
      // Extract JSON result from accumulated output
      let result;
      // Try to find the result in stream-json events
      const lines = stdout.split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const evt = JSON.parse(lines[i]);
          // Claude stream-json: result event
          if (evt.type === "result" && evt.result) {
            result = extractJSONFromText(typeof evt.result === "string" ? evt.result : JSON.stringify(evt.result));
            break;
          }
          // Direct JSON data
          if (evt.original && evt.corrected_md) { result = evt; break; }
          // Gemini response field
          if (evt.response) { result = extractJSONFromText(evt.response); break; }
          // Text field
          if (evt.text) { result = extractJSONFromText(evt.text); break; }
        } catch {}
      }
      // Fallback: try entire stdout
      if (!result) result = extractJSONFromText(stdout);
      if (typeof result === "string") result = extractJSONFromText(result);
      const data = validateData(result);
      await ensureDataDir();
      await writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
      sendSSE(res, "done", { annotations: data.annotations.length });
    } catch (e) {
      sendSSE(res, "error", { message: `JSON パース失敗: ${e.message}` });
    }
    res.end();
  });
}

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/* ══════════════════════════════════════
   HTTP SERVER
   ══════════════════════════════════════ */

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /api/presets
  if (url.pathname === "/api/presets" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ presets: PRESETS, models: MODELS }));
    return;
  }

  // GET /api/providers
  if (url.pathname === "/api/providers" && req.method === "GET") {
    const results = {};
    await Promise.all(
      Object.entries(PROVIDERS).map(async ([name, config]) => { results[name] = await checkCLI(config.cmd); })
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(results));
    return;
  }

  // GET /api/data
  if (url.pathname === "/api/data" && req.method === "GET") {
    try {
      const content = await readFile(DATA_PATH, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "data.json が存在しません" }));
    }
    return;
  }

  // GET /api/workflow
  if (url.pathname === "/api/workflow" && req.method === "GET") {
    try {
      const content = await readFile(WORKFLOW_PATH, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content: "" }));
    }
    return;
  }

  // POST /api/workflow
  if (url.pathname === "/api/workflow" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { content } = JSON.parse(body);
      await ensureDataDir();
      await writeFile(WORKFLOW_PATH, content || "", "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/proofread (SSE stream)
  if (url.pathname === "/api/proofread" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { provider, model, preset, customInstructions, text } = JSON.parse(body);
      if (!text || !text.trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "テキストが空です" }));
        return;
      }
      const prompt = buildPrompt(preset || "standard", customInstructions, text);
      console.log(`[proofread] provider=${provider} model=${model} preset=${preset} text=${text.length}文字`);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });
      sendSSE(res, "log", { text: `${provider} (${model || "default"}) で校正を開始...` });
      streamProofread(res, provider || "claude", model, prompt);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`校正サーバー起動: http://localhost:${PORT}`);
});
