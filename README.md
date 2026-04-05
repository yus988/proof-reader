# 校正ビューワー (Proofread Viewer)

校正前後のテキストを並列・インライン表示で比較し、修正箇所をハイライト、修正理由をツールチップで確認できるビューワーです。

Claude / OpenAI (Codex) / Gemini の各 CLI に対応しており、お使いのサブスクリプションで校正を実行できます。

## セットアップ

```bash
git clone https://github.com/yus988/proof-reader.git
cd proof-reader
npm install
```

### AI CLI のインストール（いずれか1つ以上）

| プロバイダ | CLI | インストール | 認証 |
|---|---|---|---|
| Claude | Claude Code | `npm i -g @anthropic-ai/claude-code` | `claude` → ブラウザログイン |
| OpenAI | Codex CLI | `npm i -g @openai/codex` | `codex` → ブラウザログイン |
| Gemini | Gemini CLI | `npm i -g @google/gemini-cli` | `gemini` → Google アカウントログイン |

## 使い方

### Web UI（推奨）

```bash
npm start
```

ブラウザで `http://localhost:5173` を開くと:

1. プロバイダを選択（Claude / Codex / Gemini）
2. 校正対象テキストを貼り付け
3. 「校正する」をクリック
4. 校正結果がビューワーに表示される
5. 「全文コピー」で校正済みテキストを取得

### Claude Code コマンド

このプロジェクトのディレクトリで Claude Code を起動し:

```
/proofread <テキスト>
```

校正結果が `data/data.json` に出力されるので `npm run dev` でビューワーを起動。

### 手動で JSON を配置

1. `data/data.sample.json` を `data/data.json` にコピーする
2. JSON の中身を校正データに差し替える
3. `npm run dev` でビューワーを起動する

## note.com 連携（Bookmarklet）

note.com の下書きから直接テキストを取得し、校正後に貼り戻すワークフローを Bookmarklet でサポートしています。

`bookmarklets.html` をブラウザで開き、Bookmarklet をブックマークに登録してください。

1. note.com のエディタで下書きを開く
2. **「note テキスト取得」** Bookmarklet を実行 → テキストがクリップボードにコピーされる
3. Web UI にテキストを貼り付けて校正
4. 「全文コピー」で校正済みテキストをコピー → note.com に貼り戻す

## data.json のフォーマット

```json
{
  "original": "校正前の原文テキスト",
  "corrected_md": "校正後テキスト（**太字** の md 記法を含む）",
  "annotations": [
    {
      "origFrom": "原文の該当箇所",
      "corrFrom": "校正後の該当箇所",
      "reason": "修正理由"
    }
  ]
}
```

## ビューワーの機能

- **並列表示 / インライン表示** の切り替え
- 修正箇所のハイライト（削除=赤、追加=緑）
- 点線部分のホバーで **修正理由** をツールチップ表示
- 段落クリックで **段落コピー**（Markdown 形式）
- **全文コピー** ボタン
