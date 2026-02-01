# 手書き文字認識アルゴリズム比較検討

クライアントサイド（ブラウザ）で実行可能な手法を検討する。

## 手法一覧

| 手法 | 精度 | 速度 | 実装難易度 | モデルサイズ | 推奨度 |
|------|------|------|-----------|-------------|--------|
| **DTW** (現在) | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | 0KB (計算のみ) | ⭕ ベースライン |
| **$N Multistroke** | ★★★★☆ | ★★★★★ | ★★★★☆ | 0KB (計算のみ) | ⭐ 推奨 |
| **Shape Context** | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | 0KB (計算のみ) | ⭕ 有力候補 |
| **CNN (MobileNet)** | ★★★★★ | ★★★★☆ | ★★☆☆☆ | 1-5MB | ⭐ 高精度求める場合 |
| **k-NN + 特徴量** | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | データ依存 | △ データ量が課題 |
| **LSTM (筆順考慮)** | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | 100KB-1MB | ⭕ 筆順重視なら |

---

## 1. $N Multistroke Recognizer ⭐推奨

### 概要
Microsoft Researchが提案した軽量なマルチストローク認識アルゴリズム。
角度（ベクトル方向）を特徴量として使用。

### アルゴリズム
```javascript
// 各ストロークを等間隔の点に分割
// → 各セグメントの角度を計算
// → 角度ベースの距離を計算

class NRecognizer {
  recognize(inputStrokes, templates) {
    // 1. 入力を正規化（回転・スケーリング・位置）
    const normalized = this.normalize(inputStrokes);
    
    // 2. 各テンプレートと角度ベースで比較
    for (const template of templates) {
      const distance = this.computeAngularDistance(normalized, template);
      // 最短距離を更新
    }
    
    return bestMatch;
  }
}
```

### 長所
- ⚡ **超高速**: DTWよりも数倍速い（O(n) vs O(n²)）
- 🎯 **回転・スケール不変**: 正規化が組み込み
- 📱 **軽量**: 追加ライブラリ不要
- ✍️ **マルチストローク対応**: 筆順の違いも許容

### 短所
- 複雑な形状の区別が苦手（「土」vs「士」など）
- 曲線の細かい違いを捉えにくい

### 実装例
```javascript
// $1 Recognizer のマルチストローク版
function recognize(strokes, templates) {
  const points = resample(strokes, 64);  // 64点にリサンプリング
  const vector = indicativeAngle(points); // 基準角度を計算
  const features = extractFeatures(points, vector);
  
  return templates.map(t => ({
    char: t.char,
    score: cosineSimilarity(features, t.features)
  })).sort((a, b) => b.score - a.score);
}
```

---

## 2. Shape Context 🔥有力候補

### 概要
点の相対的な位置関係をヒストグラム化して比較。
2つのシェイプが「どれだけ似ているか」を統計的に評価。

### アルゴリズム
```javascript
class ShapeContext {
  computeHistogram(points) {
    const histogram = [];
    
    for (const point of points) {
      const localHist = new Array(BINS).fill(0);
      
      for (const other of points) {
        if (point === other) continue;
        
        const distance = euclidean(point, other);
        const angle = Math.atan2(other.y - point.y, other.x - point.x);
        
        const bin = this.getBin(distance, angle);
        localHist[bin]++;
      }
      
      histogram.push(localHist);
    }
    
    return histogram;
  }
  
  compare(hist1, hist2) {
    // χ²距離で比較
    return chiSquaredDistance(hist1, hist2);
  }
}
```

### 長所
- 🎨 **形状を忠実に表現**: 局所的な特徴を捉える
- 🔄 **アフィン変換に頑健**: 回転・スケーリング・シアリングに強い
- 📊 **統計的アプローチ**: ノイズに強い

### 短所
- ⚠️ **計算コスト**: 点の数²に比例
- 🧩 **点対応問題**: 2つの形状の点をどう対応させるかが難しい

---

## 3. CNN (TensorFlow.js) 🧠高精度

### 概要
畳み込みニューラルネットワークで画像分類。
軽量モデル（MobileNet, EfficientNet-Lite）を使用。

### モデル例
```javascript
// TensorFlow.js で軽量CNN
import * as tf from '@tensorflow/tfjs';

// モデル構造（軽量版）
const model = tf.sequential({
  layers: [
    tf.layers.conv2d({inputShape: [64, 64, 1], filters: 8, kernelSize: 3}),
    tf.layers.maxPooling2d({poolSize: 2}),
    tf.layers.conv2d({filters: 16, kernelSize: 3}),
    tf.layers.maxPooling2d({poolSize: 2}),
    tf.layers.flatten(),
    tf.layers.dense({units: 256, activation: 'relu'}),
    tf.layers.dense({units: 3044, activation: 'softmax'}) // 文字数
  ]
});
```

### モデルサイズ比較
| モデル | サイズ | 精度 | 推論時間 |
|--------|--------|------|----------|
| MobileNet v3-Small | 2MB | ★★★★☆ | 20ms |
| EfficientNet-Lite0 | 5MB | ★★★★★ | 30ms |
| Custom Tiny CNN | 500KB | ★★★☆☆ | 10ms |

### 長所
- 🏆 **最高精度**: 従来手法を上回る認識率
- 🎨 **画像ベース**: 書き順に依存しない
- 🔄 **転学習可能**: ユーザーの書き方に適応可能

### 短所
- 📦 **モデルサイズ**: 数百KB〜数MBのダウンロードが必要
- ⏳ **初回ロード**: モデル読み込みに時間がかかる
- 🔋 **バッテリー**: 推論時に電力を消費
- 🧠 **ブラックボックス**: なぜその認識結果になったか分かりにくい

### 実装アプローチ
```javascript
// ストロークを画像にレンダリング → CNN推論
async function recognizeWithCNN(strokes) {
  // 1. ストロークを64x64の画像に
  const image = renderStrokesToImage(strokes, 64, 64);
  
  // 2. Tensorに変換
  const tensor = tf.browser.fromPixels(image, 1)
    .expandDims(0)
    .div(255.0);
  
  // 3. 推論
  const predictions = await model.predict(tensor).data();
  
  // 4. 上位を返す
  return getTopK(predictions, 10);
}
```

---

## 4. Hausdorff距離

### 概要
2つの点集合間の「最大最小距離」を計算。
「一方の集合の各点から、もう一方の集合への最短距離」の最大値。

```javascript
function hausdorffDistance(setA, setB) {
  // h(A, B) = max{ min{ d(a, b) for all b in B } for all a in A }
  const h1 = directedHausdorff(setA, setB);
  const h2 = directedHausdorff(setB, setA);
  return Math.max(h1, h2);
}
```

### 長所
- 🎯 **局所的な違いに敏感**: 一部だけ違う文字を区別しやすい
- ⚡ **シンプル**: 実装が容易

### 短所
- 🌊 **ノイズに弱い**: 外れ値に影響を受けやすい
- 📏 **スケール依存**: 正規化が必須

---

## 5. LSTM (筆順を考慮)

### 概要
時系列データを扱うRNNの一種。
筆順の情報を考慮した認識が可能。

```javascript
// 各ストロークを時系列として処理
const model = tf.sequential({
  layers: [
    tf.layers.lstm({units: 64, inputShape: [null, 2]}), // (x, y)座標
    tf.layers.dense({units: 3044, activation: 'softmax'})
  ]
});
```

### 長所
- ⏱️ **時系列パターン学習**: 筆順の違いを学習可能
- 🔄 **可変長入力**: ストローク長に依存しない

### 短所
- 📦 **モデルサイズ**: LSTMの重みが増える
- ⏳ **推論速度**: 逐次処理が必要

---

## 推奨アプローチ

### フェーズ1: $N Multistroke の実装 ⭐
DTWの代替として最適。速度と精度のバランスが良い。

```javascript
// 実装予定
recognizers/
├── dtw.js              # 既存
├── n-multistroke.js    # 新規実装 ⭐
└── ensemble.js         # 複数手法の組み合わせ
```

### フェーズ2: アンサンブル
複数の手法を組み合わせて精度向上：

```javascript
class EnsembleRecognizer {
  async recognize(strokes) {
    const results = await Promise.all([
      this.dtw.recognize(strokes),
      this.nStroke.recognize(strokes),
      this.shapeContext.recognize(strokes)
    ]);
    
    // 重み付け投票
    return this.weightedVote(results, [0.4, 0.4, 0.2]);
  }
}
```

### フェーズ3: 軽量CNN（オプション）
精度が必要な場合のみTensorFlow.jsを導入。

---

## ベンチマーク予定

```javascript
// 各手法のパフォーマンス測定
const benchmarks = {
  dtw: measure(DTWRecognizer),
  nstroke: measure(NStrokeRecognizer),
  shapeContext: measure(ShapeContextRecognizer),
  cnn: measure(CNNRecognizer)
};

// 測定項目
// - 認識精度（Top-1, Top-5, Top-10）
// - 推論時間（ms）
// - メモリ使用量（MB）
// - モデルサイズ（KB/MB）
```

---

## 結論

| 用途 | 推奨手法 |
|------|----------|
| 現状維持 + 高速化 | **$N Multistroke** |
| 最高精度目指す | **CNN** (TensorFlow.js) |
| 形状重視 | **Shape Context** |
| 筆順重視 | **LSTM** |
| バランス重視 | **アンサンブル** |

---

## 実装した認識器

### 1. DTWRecognizer (dtw.js)
既存の実装。時系列の距離を計算。

### 2. NMultistrokeRecognizer (n-multistroke.js)
角度ベースの高速認識。

### 3. ShapeContextRecognizer (shape-context.js)
形状コンテキストを使用した認識。

### 4. EnsembleRecognizer (n-multistroke.js)
複数の認識器を組み合わせ。

## 使い方

ブラウザでアルゴリズムを切り替え:

```html
<select id="algorithmSelect">
    <option value="dtw">DTW (標準)</option>
    <option value="nstroke">$N-Multistroke (高速)</option>
    <option value="shapecontext">Shape Context (形状重視)</option>
    <option value="ensemble">Ensemble (統合)</option>
</select>
```

## パフォーマンス比較

ブラウザのコンソールで実行時間を確認:

```javascript
// アルゴリズムを切り替えて文字を書く
dtw: 45.23ms, top-1: あ
nstroke: 12.45ms, top-1: あ
shapecontext: 78.90ms, top-1: あ
ensemble: 89.12ms, top-1: あ
```
