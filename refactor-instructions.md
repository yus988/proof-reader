# proofread-viewer リファクタリング指示書（Claude Code 向け）

## 目的
校正ビューワー（proofread-editor.jsx）からデータ部分を JSON ファイルに分離し、Claude が JSON のみを出力すれば済む構成にする。

## 現状
- `proofread-editor.jsx` に以下の3つのデータが直接埋め込まれている
  - `const ORIGINAL` — 校正前の原文（テンプレートリテラル）
  - `const CORRECTED_MD` — 校正後テキスト（テンプレートリテラル、`**太字**` 対応）
  - `const ANNOTATIONS_DEF` — 修正理由の配列（オブジェクト配列）
- 校正のたびに jsx 全体をコピー→データ部分を差し替え→出力しており非効率

## ゴール
1. データを `data.json` に分離する
2. jsx はデータを import して表示するだけにする（ロジック・UI は変更しない）
3. ローカルで `npm run dev` 等で即座にプレビューできる環境を用意する

## 作業内容

### 1. プロジェクト初期化
```
hapbeat-proofread/
├── package.json
├── vite.config.js        ← Vite（React）
├── index.html
├── src/
│   ├── App.jsx           ← 現在の proofread-editor.jsx をリネーム
│   └── main.jsx          ← エントリポイント
├── data/
│   └── data.json         ← 校正データ（Claude が出力するファイル）
└── README.md
```

- Vite + React の最小構成で良い
- 依存は react, react-dom, vite, @vitejs/plugin-react のみ

### 2. data.json の仕様

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

- `original` と `corrected_md` はプレーンテキスト。段落区切りは `\n\n`。段落内改行は `\n`
- `corrected_md` 内の `**太字**` はそのまま保持（jsx 側の parseMd で処理される）
- JSON のエスケープ規則に従う（`"` → `\"`、`\n` で改行）

### 3. jsx のリファクタリング

現在の `proofread-editor.jsx` から以下を変更する：

#### 削除するもの
- `const ORIGINAL = \`...\`;` のブロック全体
- `const CORRECTED_MD = \`...\`;` のブロック全体
- `const ANNOTATIONS_DEF = [...]` のブロック全体

#### 追加するもの
```jsx
import data from '../data/data.json';

const ORIGINAL = data.original;
const CORRECTED_MD = data.corrected_md;
const ANNOTATIONS_DEF = data.annotations;
```

#### 変更しないもの
- `parseMd`, `buildPosAnns`, `getReason` などの解析関数
- `computeDiff`, `annotateDiff`, `splitIntoParagraphs` などの diff エンジン
- `DiffViewer` コンポーネント全体（UI・スタイル・インタラクション）
- コピー機能（`copyText`, `copyParagraph`, `copyAll`）
- カラー定数 `C`、フォント定数 `F`

### 4. 動作確認
- `npm run dev` でローカルサーバーが起動すること
- 並列表示・インライン表示の切り替えが動作すること
- 修正箇所ホバーでツールチップが表示されること
- 段落クリックでコピーが動作すること
- 全文コピーボタンが動作すること
- **太字** が正しく描画されること

### 5. サンプルデータ
- 現在の jsx に埋め込まれているデータをそのまま `data.json` に変換して配置する（動作確認用）

## 注意事項
- UI・ロジックには手を加えない。データの読み込み方法のみ変更する
- `data.json` は `.gitignore` に含めない（サンプルデータとしてコミットする）
- README に「Claude から受け取った JSON を `data/data.json` に配置して `npm run dev`」という手順を記載する
