# 校正ビューワー (Proofread Viewer)

校正前後のテキストを並列・インライン表示で比較し、修正箇所をハイライト、修正理由をツールチップで確認できるビューワーです。

Claude Code の `/proofread` コマンドでテキストを校正し、結果をそのままブラウザでプレビューできます。

## セットアップ

```bash
git clone https://github.com/yus988/proof-reader.git
cd proof-reader
npm install
```

## 使い方

### 方法 1: Claude Code コマンド（推奨）

このプロジェクトのディレクトリで Claude Code を起動し、以下のように実行します。

```
/proofread
```

プロンプトに従って校正対象のテキストを貼り付けると、校正結果が `data/data.json` に出力されます。

その後、ビューワーを起動します。

```bash
npm run dev
```

### 方法 2: 手動で JSON を配置

1. `data/data.sample.json` を `data/data.json` にコピーする
2. JSON の中身を校正データに差し替える
3. `npm run dev` でローカルサーバーを起動する

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

| フィールド | 説明 |
|---|---|
| `original` | 校正前の原文。段落区切りは `\n\n`、段落内改行は `\n` |
| `corrected_md` | 校正後テキスト。`**太字**` の Markdown 記法に対応 |
| `annotations` | 修正箇所と理由の配列。ビューワー上で点線+ツールチップとして表示される |

## note.com 連携（Bookmarklet）

note.com の下書きから直接テキストを取得し、校正後に貼り戻すワークフローを Bookmarklet でサポートしています。

### セットアップ

`bookmarklets.html` をブラウザで開き、ボタンをブックマークバーにドラッグしてください。

```bash
# ローカルで開く場合
start bookmarklets.html   # Windows
open bookmarklets.html    # macOS
```

### ワークフロー

1. note.com のエディタで下書きを開く
2. **「note テキスト取得」** Bookmarklet をクリック → テキストがクリップボードにコピーされる
3. Claude Code で `/proofread <貼り付け>` を実行 → `data/data.json` が生成される
4. `npm run dev` でビューワーを開き、校正結果を確認
5. ビューワーの「全文コピー」ボタンで校正済みテキストをコピー
6. note.com のエディタに戻り、テキストを差し替える

詳細は `bookmarklets.html` を参照してください。

## ビューワーの機能

- **並列表示 / インライン表示** の切り替え
- 修正箇所のハイライト（削除=赤、追加=緑）
- 点線部分のホバーで **修正理由** をツールチップ表示
- 段落クリックで **段落コピー**（Markdown 形式）
- **全文コピー** ボタン
