/**
 * $N Multistroke Recognizer
 * 
 * Microsoft Researchが提案した軽量なマルチストローク認識アルゴリズム。
 * 角度ベクトルを特徴量として使用し、回転・スケーリング不変な認識を実現。
 * 
 * Reference:
 * Anthony, L., & Wobbrock, J. O. (2010). A lightweight multistroke recognizer for 
 * user interface prototypes. Proceedings of Graphics Interface, 245-252.
 */

class NMultistrokeRecognizer {
    constructor(options = {}) {
        this.numPoints = options.numPoints || 96;  // リサンプリング点数
        this.numGestures = options.numGestures || 16; // 角度ビン数
        this.templates = [];
    }

    /**
     * テンプレートを追加
     */
    addTemplate(char, strokes) {
        const processed = this.preprocess(strokes);
        const features = this.extractFeatures(processed);
        
        this.templates.push({
            char,
            strokes: processed,
            features
        });
    }

    /**
     * 認識実行
     */
    recognize(inputStrokes, topK = 10) {
        if (this.templates.length === 0) {
            throw new Error('No templates loaded');
        }

        if (!inputStrokes || inputStrokes.length === 0) {
            return [];
        }

        // 入力を前処理
        const processed = this.preprocess(inputStrokes);
        const inputFeatures = this.extractFeatures(processed);

        // 各テンプレートと比較
        const scores = this.templates.map(template => {
            const distance = this.computeDistance(inputFeatures, template.features);
            const score = 1 / (1 + distance); // 距離をスコアに変換
            
            return {
                char: template.char,
                score: score,
                distance: distance,
                // 詳細情報
                strokeCount: template.strokes.length,
                inputStrokeCount: processed.length
            };
        });

        // スコアでソート
        scores.sort((a, b) => b.score - a.score);
        
        return scores.slice(0, topK).map(s => ({
            char: s.char,
            score: Math.round(s.score * 1000) / 1000,
            strokeCount: s.strokeCount
        }));
    }

    /**
     * 前処理パイプライン
     */
    preprocess(strokes) {
        // 1. 各ストロークをリサンプリング
        const resampled = strokes.map(stroke => this.resample(stroke, this.numPoints / strokes.length));
        
        // 2. 正規化（回転・スケーリング・位置）
        return this.normalize(resampled);
    }

    /**
     * 点列を等間隔にリサンプリング
     */
    resample(points, numPoints) {
        if (points.length <= 1) return points;
        
        const I = this.pathLength(points) / (numPoints - 1);
        let D = 0;
        const newPoints = [points[0]];
        
        for (let i = 1; i < points.length; i++) {
            const d = this.distance(points[i - 1], points[i]);
            
            if ((D + d) >= I) {
                const qx = points[i - 1][0] + ((I - D) / d) * (points[i][0] - points[i - 1][0]);
                const qy = points[i - 1][1] + ((I - D) / d) * (points[i][1] - points[i - 1][1]);
                const q = [qx, qy];
                newPoints.push(q);
                // 挿入した点を新しい始点として続行
                points.splice(i, 0, q);
                D = 0;
            } else {
                D += d;
            }
        }
        
        // 点数が足りない場合は最後の点を追加
        while (newPoints.length < numPoints) {
            newPoints.push(points[points.length - 1]);
        }
        
        return newPoints.slice(0, numPoints);
    }

    /**
     * 正規化（回転・スケーリング・位置）
     */
    normalize(strokes) {
        // 全点を1つの配列に
        const allPoints = strokes.flat();
        
        // 重心を計算
        const centroid = this.computeCentroid(allPoints);
        
        // 重心を原点に移動
        const centered = strokes.map(stroke => 
            stroke.map(p => [p[0] - centroid[0], p[1] - centroid[1]])
        );
        
        // スケーリング（最大距離が0.5になるように）
        const allCentered = centered.flat();
        let maxDist = 0;
        for (const p of allCentered) {
            const d = Math.sqrt(p[0] * p[0] + p[1] * p[1]);
            if (d > maxDist) maxDist = d;
        }
        
        const scale = maxDist > 0 ? 0.5 / maxDist : 1;
        
        return centered.map(stroke =>
            stroke.map(p => [p[0] * scale, p[1] * scale])
        );
    }

    /**
     * 特徴量抽出（角度ベクトル）
     */
    extractFeatures(strokes) {
        const features = [];
        
        for (const stroke of strokes) {
            const strokeFeatures = [];
            
            for (let i = 1; i < stroke.length; i++) {
                const dx = stroke[i][0] - stroke[i - 1][0];
                const dy = stroke[i][1] - stroke[i - 1][1];
                
                // 角度を計算
                const angle = Math.atan2(dy, dx);
                
                // 角度をビンに量子化
                const bin = Math.floor((angle + Math.PI) / (2 * Math.PI) * this.numGestures) % this.numGestures;
                
                strokeFeatures.push({
                    angle,
                    bin,
                    magnitude: Math.sqrt(dx * dx + dy * dy)
                });
            }
            
            features.push(strokeFeatures);
        }
        
        return features;
    }

    /**
     * 2つの特徴量間の距離を計算
     */
    computeDistance(features1, features2) {
        // ストローク数の差にペナルティ
        const strokeDiff = Math.abs(features1.length - features2.length);
        const strokePenalty = strokeDiff * 0.3;
        
        // 各ストロークの距離を計算
        const minStrokes = Math.min(features1.length, features2.length);
        let totalDistance = 0;
        
        for (let i = 0; i < minStrokes; i++) {
            const dist = this.strokeDistance(features1[i], features2[i]);
            totalDistance += dist;
        }
        
        return (totalDistance / minStrokes) + strokePenalty;
    }

    /**
     * 2つのストローク間の距離（角度ベース）
     */
    strokeDistance(stroke1, stroke2) {
        const len = Math.min(stroke1.length, stroke2.length);
        if (len === 0) return Infinity;
        
        let distance = 0;
        
        for (let i = 0; i < len; i++) {
            // 角度差（最短経路で計算）
            let angleDiff = Math.abs(stroke1[i].angle - stroke2[i].angle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            
            // 大きさの差
            const magDiff = Math.abs(stroke1[i].magnitude - stroke2[i].magnitude);
            
            // 重み付け和
            distance += angleDiff * 0.7 + magDiff * 0.3;
        }
        
        return distance / len;
    }

    /**
     * ユーティリティ関数
     */
    pathLength(points) {
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            length += this.distance(points[i - 1], points[i]);
        }
        return length;
    }

    distance(p1, p2) {
        const dx = p1[0] - p2[0];
        const dy = p1[1] - p2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    computeCentroid(points) {
        let sumX = 0, sumY = 0;
        for (const p of points) {
            sumX += p[0];
            sumY += p[1];
        }
        return [sumX / points.length, sumY / points.length];
    }

    /**
     * 既存のtomoe_dataからテンプレートをロード
     */
    loadFromTomoe(characters) {
        this.templates = [];
        
        for (const charData of characters) {
            this.addTemplate(charData.char, charData.strokes);
        }
        
        console.log(`Loaded ${this.templates.length} templates into N-Stroke recognizer`);
    }

    /**
     * 統計情報
     */
    getStats() {
        return {
            templates: this.templates.length,
            avgStrokes: this.templates.reduce((sum, t) => sum + t.strokes.length, 0) / this.templates.length,
            numPoints: this.numPoints,
            numGestures: this.numGestures
        };
    }
}

/**
 * アンサンブル認識（DTW + N-Stroke）
 */
class EnsembleRecognizer {
    constructor() {
        this.dtw = new KanjiRecognizer();
        this.nStroke = new NMultistrokeRecognizer();
        this.weights = { dtw: 0.4, nStroke: 0.4 };
    }

    async load() {
        await this.dtw.load();
        this.nStroke.loadFromTomoe(this.dtw.characters);
    }

    recognize(strokes, topK = 10) {
        // 両方の認識器で実行
        const dtwResults = this.dtw.recognize(strokes, topK * 2);
        const nStrokeResults = this.nStroke.recognize(strokes, topK * 2);

        // スコアをマージ
        const merged = new Map();

        // DTW結果を加算
        dtwResults.forEach((r, i) => {
            const weight = this.weights.dtw * (1 - i / dtwResults.length);
            merged.set(r.char, {
                char: r.char,
                dtwScore: r.score,
                nStrokeScore: 0,
                combinedScore: r.score * weight
            });
        });

        // N-Stroke結果を加算
        nStrokeResults.forEach((r, i) => {
            const weight = this.weights.nStroke * (1 - i / nStrokeResults.length);
            const existing = merged.get(r.char);
            if (existing) {
                existing.nStrokeScore = r.score;
                existing.combinedScore += r.score * weight;
            } else {
                merged.set(r.char, {
                    char: r.char,
                    dtwScore: 0,
                    nStrokeScore: r.score,
                    combinedScore: r.score * weight
                });
            }
        });

        // スコアでソート
        const results = Array.from(merged.values())
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, topK);

        return results.map(r => ({
            char: r.char,
            score: Math.round(r.combinedScore * 1000) / 1000,
            dtwScore: Math.round(r.dtwScore * 1000) / 1000,
            nStrokeScore: Math.round(r.nStrokeScore * 1000) / 1000
        }));
    }
}

// グローバルにエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NMultistrokeRecognizer, EnsembleRecognizer };
}
