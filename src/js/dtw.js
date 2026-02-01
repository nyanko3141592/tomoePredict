/**
 * DTW (Dynamic Time Warping) 距離を計算するユーティリティ
 * 
 * 2つの時系列データの類似度を計算するアルゴリズム。
 * 手書き文字認識で広く使われている。
 */

class DTW {
    /**
     * 2つの点列間のユークリッド距離を計算
     */
    static euclideanDistance(p1, p2) {
        const dx = p1[0] - p2[0];
        const dy = p1[1] - p2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 2つの点列間のDTW距離を計算
     * @param {number[][]} seq1 - 点列1 [[x1,y1], [x2,y2], ...]
     * @param {number[][]} seq2 - 点列2 [[x1,y1], [x2,y2], ...]
     * @returns {number} DTW距離（小さいほど類似）
     */
    static distance(seq1, seq2) {
        const n = seq1.length;
        const m = seq2.length;
        
        if (n === 0 || m === 0) {
            return Infinity;
        }
        
        // DPテーブルの初期化
        const dp = Array(n + 1).fill(null).map(() => Array(m + 1).fill(Infinity));
        dp[0][0] = 0;
        
        // DTW計算
        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const cost = this.euclideanDistance(seq1[i - 1], seq2[j - 1]);
                dp[i][j] = cost + Math.min(
                    dp[i - 1][j],     // insertion
                    dp[i][j - 1],     // deletion
                    dp[i - 1][j - 1]  // match
                );
            }
        }
        
        // 正規化（長さの影響を減らす）
        return dp[n][m] / Math.max(n, m);
    }

    /**
     * ストロークの配列間の距離を計算
     * ストローク数が異なる場合でも対応できるようにする
     */
    static strokeDistance(strokes1, strokes2) {
        // ストローク数が異なる場合のペナルティ
        const strokeDiff = Math.abs(strokes1.length - strokes2.length);
        const strokePenalty = strokeDiff * 0.5;
        
        // 各ストロークのDTW距離を計算
        let totalDistance = 0;
        const minStrokes = Math.min(strokes1.length, strokes2.length);
        
        for (let i = 0; i < minStrokes; i++) {
            totalDistance += this.distance(strokes1[i], strokes2[i]);
        }
        
        // 平均距離 + ストローク数のペナルティ
        return (totalDistance / minStrokes) + strokePenalty;
    }

    /**
     * 正規化されたストローク距離（0-1の範囲、1が完全一致）
     */
    static normalizedSimilarity(strokes1, strokes2) {
        const distance = this.strokeDistance(strokes1, strokes2);
        // 距離を類似度に変換（距離が小さいほど類似度が高い）
        // スケーリング係数は経験的に決定
        const similarity = Math.exp(-distance * 2);
        return Math.max(0, Math.min(1, similarity));
    }
}

/**
 * ストロークの前処理ユーティリティ
 */
class StrokePreprocessor {
    /**
     * 点列をリサンプリング（等間隔に点を配置し直す）
     */
    static resample(points, numPoints = 32) {
        if (points.length <= 1) return points;
        
        // 総距離を計算
        let totalLength = 0;
        const distances = [0];
        for (let i = 1; i < points.length; i++) {
            const d = Math.sqrt(
                Math.pow(points[i][0] - points[i-1][0], 2) +
                Math.pow(points[i][1] - points[i-1][1], 2)
            );
            totalLength += d;
            distances.push(totalLength);
        }
        
        if (totalLength === 0) return points;
        
        // 等間隔に点を配置
        const result = [points[0]];
        const step = totalLength / (numPoints - 1);
        
        let currentDist = 0;
        let pointIndex = 0;
        
        for (let i = 1; i < numPoints - 1; i++) {
            const targetDist = i * step;
            
            while (pointIndex < distances.length - 1 && distances[pointIndex + 1] < targetDist) {
                pointIndex++;
            }
            
            if (pointIndex >= points.length - 1) {
                result.push(points[points.length - 1]);
                continue;
            }
            
            // 線形補間
            const t = (targetDist - distances[pointIndex]) / 
                     (distances[pointIndex + 1] - distances[pointIndex]);
            const x = points[pointIndex][0] + t * (points[pointIndex + 1][0] - points[pointIndex][0]);
            const y = points[pointIndex][1] + t * (points[pointIndex + 1][1] - points[pointIndex][1]);
            result.push([x, y]);
        }
        
        result.push(points[points.length - 1]);
        return result;
    }

    /**
     * ストロークを正規化（0-1の範囲にスケーリング）
     */
    static normalize(strokes) {
        // 全座標の最小・最大を取得
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const stroke of strokes) {
            for (const [x, y] of stroke) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        
        const width = maxX - minX;
        const height = maxY - minY;
        const scale = Math.max(width, height);
        
        if (scale === 0) return strokes;
        
        // 正規化
        return strokes.map(stroke => 
            stroke.map(([x, y]) => [
                (x - minX) / scale,
                (y - minY) / scale
            ])
        );
    }

    /**
     * ストロークを滑らかにする（移動平均フィルタ）
     */
    static smooth(strokes, windowSize = 3) {
        return strokes.map(stroke => {
            if (stroke.length <= windowSize) return stroke;
            
            const result = [];
            const halfWindow = Math.floor(windowSize / 2);
            
            for (let i = 0; i < stroke.length; i++) {
                let sumX = 0, sumY = 0, count = 0;
                
                for (let j = -halfWindow; j <= halfWindow; j++) {
                    const idx = i + j;
                    if (idx >= 0 && idx < stroke.length) {
                        sumX += stroke[idx][0];
                        sumY += stroke[idx][1];
                        count++;
                    }
                }
                
                result.push([sumX / count, sumY / count]);
            }
            
            return result;
        });
    }

    /**
     * 前処理のパイプライン
     */
    static process(strokes, options = {}) {
        const { resamplePoints = 32, smoothWindow = 3 } = options;
        
        let processed = strokes.map(s => this.resample(s, resamplePoints));
        processed = this.smooth(processed, smoothWindow);
        processed = this.normalize(processed);
        
        return processed;
    }
}

// グローバルにエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DTW, StrokePreprocessor };
}
