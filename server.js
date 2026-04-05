import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3456;
const PROMPT_PATH = join(__dirname, "src", "prompt.txt");
const DATA_PATH = join(__dirname, "data", "data.json");

// CLI 定義: 各プロバイダの非対話コマンド
const PROVIDERS = {
  claude: {
    cmd: "claude",
    args: (prompt) => ["-p", prompt, "--output-format", "json"],
    extractJSON: (stdout) => {
      const parsed = JSON.parse(stdout);
      // claude -p --output-format json は { result: "..." } 形式
      return parsed.result ?? parsed;
    },
  },
  codex: {
    cmd: "codex",
    args: (prompt) => ["exec", prompt, "--json"],
    extractJSON: (stdout) => {
      // codex exec --json は JSONL 形式。最後の result 行を取得
      const lines = stdout.trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const obj = JSON.parse(lines[i]);
          if (obj.type === "result" || obj.message || obj.text) return obj;
          if (typeof obj === "object" && obj.original) return obj;
        } catch {}
      }
      // フォールバック: stdout 全体から JSON を探す
      return extractJSONFromText(stdout);
    },
  },
  gemini: {
    cmd: "gemini",
    args: (prompt) => ["-p", prompt, "--output-format", "json"],
    extractJSON: (stdout) => {
      const parsed = JSON.parse(stdout);
      return parsed.response ?? parsed;
    },
  },
};

// テキストから JSON オブジェクトを抽出するヘルパー
function extractJSONFromText(text) {
  // ```json ... ``` ブロックを探す
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  if (fenced) return JSON.parse(fenced[1].trim());
  // { で始まる部分を探す
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("JSON が見つかりませんでした");
}

// data.json のスキーマを検証
function validateData(data) {
  if (typeof data.original !== "string") throw new Error("original が文字列ではありません");
  if (typeof data.corrected_md !== "string") throw new Error("corrected_md が文字列ではありません");
  if (!Array.isArray(data.annotations)) throw new Error("annotations が配列ではありません");
  return data;
}

async function runProvider(provider, text) {
  const promptTemplate = await readFile(PROMPT_PATH, "utf-8");
  const fullPrompt = promptTemplate + text;
  const config = PROVIDERS[provider];
  if (!config) throw new Error(`未対応のプロバイダ: ${provider}`);

  return new Promise((resolve, reject) => {
    const child = execFile(config.cmd, config.args(fullPrompt), {
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 5 * 60 * 1000,      // 5分
      windowsHide: true,
    }, (err, stdout, stderr) => {
      if (err) {
        const msg = err.code === "ENOENT"
          ? `${config.cmd} が見つかりません。インストールしてログインしてください。`
          : `${config.cmd} エラー: ${stderr || err.message}`;
        return reject(new Error(msg));
      }
      try {
        let result = config.extractJSON(stdout);
        // result が文字列の場合（Claude が result フィール���に文字列���返す場合）
        if (typeof result === "string") result = extractJSONFromText(result);
        const data = validateData(result);
        resolve(data);
      } catch (e) {
        reject(new Error(`JSON パース失敗: ${e.message}\n--- stdout ---\n${stdout.slice(0, 500)}`));
      }
    });
  });
}

// CLI の存在チェック
function checkCLI(cmd) {
  return new Promise((resolve) => {
    execFile(cmd, ["--version"], { timeout: 5000, windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

// HTTP サーバー
const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /api/data — 現在の data.json を返す
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

  // GET /api/providers — 利用可能なプロバイダ一覧
  if (url.pathname === "/api/providers" && req.method === "GET") {
    const results = {};
    await Promise.all(
      Object.entries(PROVIDERS).map(async ([name, config]) => {
        results[name] = await checkCLI(config.cmd);
      })
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(results));
    return;
  }

  // POST /api/proofread — 校正実行
  if (url.pathname === "/api/proofread" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { provider, text } = JSON.parse(body);
      if (!text || !text.trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "テキストが空です" }));
        return;
      }
      console.log(`[proofread] provider=${provider}, text=${text.length}文字`);
      const data = await runProvider(provider || "claude", text);
      await writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
      console.log(`[proofread] 完了 → data/data.json (annotations: ${data.annotations.length}件)`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, annotations: data.annotations.length }));
    } catch (e) {
      console.error(`[proofread] エラー:`, e.message);
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
  console.log(`API: POST /api/proofread  GET /api/providers`);
});
