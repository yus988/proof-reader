# 校正ビューワー (Proofread Viewer)

AI を使ってテキストを校正し、修正箇所をハイライト表示するデスクトップアプリです。

Claude / OpenAI (Codex) / Gemini に対応。お使いのサブスクリプションで校正を実行できます。

## 特徴

- **マルチプロバイダ対応**: Claude Code, Codex CLI, Gemini CLI
- **校正プリセット**: ライト（誤字のみ）〜 フル（ファクトチェック含む）
- **モデル選択**: 各プロバイダの推奨モデルを自動提案
- **カスタム指示**: 独自の校正ルールを保存・適用
- **チャットログ**: AI の思考過程をリアルタイム表示
- **diff ビューワー**: 並列表示 / インライン表示、修正理由のツールチップ

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
| OpenAI | Codex CLI | 同梱済み (Electron版) / `npm i -g @openai/codex` | `codex` → ブラウザログイン |
| Gemini | Gemini CLI | 同梱済み (Electron版) / `npm i -g @google/gemini-cli` | `gemini` → Google ログイン |

> **Note**: Claude Code はライセンスの関係でアプリに同梱できないため、利用する場合はユーザー自身でインストールしてください。Codex CLI と Gemini CLI は Apache 2.0 ライセンスのためアプリに同梱しています。

## 使い方

### Web UI

```bash
npm start
```

ブラウザで `http://localhost:5173` を開きます。

1. **プロバイダ選択** → **校正方針** → **モデル** を選択
2. 校正対象テキストを貼り付け
3. 「校正する」をクリック → チャットログで AI の処理を確認
4. 校正結果がビューワーに表示 → 「全文コピー」で取得

### Electron アプリ

```bash
npm run electron:dev     # 開発モード
npm run electron:build   # .exe/.dmg をビルド
```

### Claude Code コマンド

```
/proofread <テキスト>
```

## 校正プリセット

| プリセット | 内容 | おすすめモデル |
|---|---|---|
| **ライト** | 誤字脱字・表記ゆれのみ | Haiku / GPT-4.1 Mini / Flash |
| **スタンダード** | 文体改善・冗長表現の簡潔化 | Sonnet / GPT-4.1 / Flash |
| **しっかり** | 構成整理・論理チェック含む | Sonnet / o3 / Pro |
| **フル** | ファクトチェック・Web検索含む | Opus / o3 / Pro |

## note.com 連携

`bookmarklets.html` の Bookmarklet で note.com の下書きからテキストを取得できます。

## ビューワーの機能

- **並列表示 / インライン表示** の切り替え
- 修正箇所のハイライト（削除=赤、追加=緑）
- 点線ホバーで **修正理由** をツールチップ表示
- 段落クリックで **段落コピー**（Markdown 形式）
- 並列表示では校正後テキストのみドラッグ選択可能
- **全文コピー** ボタン
