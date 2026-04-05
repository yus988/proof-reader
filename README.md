# 校正ビューワー (Proofread Viewer)

校正前後のテキストを並列・インライン表示で比較し、修正理由をツールチップで確認できるビューワーです。

## セットアップ

```bash
npm install
```

## 使い方

1. Claude から受け取った JSON を `data/data.json` に配置する
2. `npm run dev` でローカルサーバーを起動する
3. ブラウザで表示される URL にアクセスする

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

- `original` と `corrected_md` はプレーンテキスト。段落区切りは `\n\n`、段落内改行は `\n`
- `corrected_md` 内の `**太字**` はビューワー側で太字として描画される
