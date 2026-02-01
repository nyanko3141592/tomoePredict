# 🖌️ Tomoe 手書き漢字認識デモ

[![Deploy to GitHub Pages](https://github.com/hiroyuki-komatsu/tomoe_data/actions/workflows/deploy.yml/badge.svg)](https://github.com/hiroyuki-komatsu/tomoe_data/actions/workflows/deploy.yml)

ブラウザ上で動作する手書き漢字認識デモアプリです。[tomoe_data](https://github.com/hiroyuki-komatsu/tomoe_data)を使用し、DTW（Dynamic Time Warping）アルゴリズムで文字の類似度を計算します。

**🌐 ライブデモ**: `https://<your-username>.github.io/tomoePredict/`

![Demo Screenshot](https://user-images.githubusercontent.com/placeholder/screenshot.png)

## 🌟 特徴

- **ブラウザ完結型**: サーバー通信不要、クライアントサイドで認識処理
- **3,000+文字対応**: ひらがな・カタカナ・常用漢字をカバー
- **リアルタイム認識**: ストローク入力中に自動で認識
- **可視化機能**: マッチング詳細、ヒートマップ、スコア内訳を表示
- **レスポンシブ対応**: スマートフォン・タブレット対応
- **軽量**: データ圧縮済み、高速読み込み

## 🚀 クイックスタート

### ライブデモを見る

GitHub Pagesでホスティング中:

🔗 **`https://<your-username>.github.io/tomoePredict/`**

### ローカルで実行

```bash
# リポジトリをクローン
git clone https://github.com/<username>/tomoePredict.git
cd tomoePredict

# 開発サーバー起動
./dev.sh

# http://localhost:8080 でアクセス
```

## 🛠️ 技術構成

| 項目 | 技術 |
|------|------|
| フロントエンド | 純正JavaScript (ES6+) |
| 認識アルゴリズム | DTW (Dynamic Time Warping) |
| データソース | tomoe_data (3,044文字) |
| ホスティング | GitHub Pages |
| CI/CD | GitHub Actions |

## 📊 アルゴリズム

### Dynamic Time Warping (DTW)

時系列データ間の類似度を計算する動的計画法ベースのアルゴリズム。

```
1. 入力ストロークを正規化 (0-1範囲)
2. 各ストロークを32点にリサンプリング
3. データベース内の全文字とDTW距離を計算
4. 距離が小さい順にソートして上位を表示
```

### 可視化機能

| 機能 | 説明 |
|------|------|
| リアルタイムプレビュー | 入力中に候補をバーチャート表示 |
| 詳細マッチング | ストロークごとの一致度を表示 |
| ヒートマップ | 上位候補の類似度を色で可視化 |
| スコア内訳 | 形状・ストローク・ペナルティの内訳 |

## 🚀 デプロイ

### GitHub Pages へのデプロイ

#### 方法1: gh CLI を使用（推奨）

```bash
# リポジトリを作成（未作成の場合）
gh repo create tomoePredict --public --source=. --push

# GitHub Pages を有効化
gh api repos/:owner/:repo/pages \
  --method PUT \
  --input '{"source":{"branch":"main","path":"/"}}'
```

#### 方法2: 手動設定

1. GitHubリポジトリの **Settings** → **Pages** を開く
2. **Source** で **GitHub Actions** を選択
3. 自動で `.github/workflows/deploy.yml` が実行される

#### 方法3: ローカルファイルから直接デプロイ

```bash
# gh CLI がインストールされている場合
gh auth login

# リポジトリを作成
gh repo create tomoePredict --public --source=. --remote=origin --push

# GitHub Pages 設定（Actions使用）
gh api repos/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/pages \
  --method PUT \
  --input '{"source":{"branch":"main","path":"/"}}' \
  --silent 2>/dev/null || echo "Pages already configured or use Actions"
```

デプロイ後、数分で `https://<username>.github.io/tomoePredict/` でアクセス可能になります。

### データの準備

初回セットアップ時のみ実行:

```bash
# tomoe_data をダウンロードして変換
npm run setup

# または直接
python3 scripts/convert_data.py
```

## 📁 ディレクトリ構造

```
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions 設定
├── scripts/
│   └── convert_data.py     # データ変換スクリプト
├── src/                     # GitHub Pages 公開ディレクトリ
│   ├── index.html
│   ├── css/
│   │   ├── style.css
│   │   └── visualizer.css
│   ├── js/
│   │   ├── dtw.js          # DTWアルゴリズム
│   │   ├── recognizer.js   # 認識エンジン
│   │   ├── visualizer.js   # 可視化
│   │   └── app.js          # アプリロジック
│   └── data/
│       └── characters.json # 文字データ
├── .gitignore
├── dev.sh                  # 開発サーバースクリプト
├── package.json
└── README.md
```

## 📝 開発

```bash
# 開発サーバー起動
./dev.sh

# または
npm run dev

# 別のポートを使用
PORT=3000 ./dev.sh
```

## 📄 ライセンス

- コード: MIT License
- データ: [tomoe_data](https://github.com/hiroyuki-komatsu/tomoe_data) (Apache 2.0 / CC BY 4.0)

## 🙏 謝辞

- [Hiroyuki Komatsu](https://github.com/hiroyuki-komatsu) 氏による[tomoe_data](https://github.com/hiroyuki-komatsu/tomoe_data)の提供に感謝します
