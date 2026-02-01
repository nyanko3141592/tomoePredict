/**
 * Shape Context Recognizer
 * 
 * Belongie et al. (2002) の Shape Matchingアルゴリズムをベースにした
 * 軽量な実装。点の分布をヒストグラム化して比較する。
 */

class ShapeContextRecognizer {
    constructor(options = {}) {
        this.numPoints = options.numPoints || 100;      // サンプリング点数
        this.numBinsR = options.numBinsR || 5;          // 距離ビン数
        this.numBinsTheta = options.numBinsTheta || 12; // 角度ビン数
        this.templates = [];
    }

    /**
     * テンプレートを追加
     */
    addTemplate(char, strokes) {
        const points = this.samplePoints(strokes);
        const histograms = this.computeShapeContexts(points);
        
        this.templates.push({
            char,
            points,
            histograms
        });
    }

    /**
     * 認識実行
     */
    recognize(inputStrokes, topK = 10) {
        if (this.templates.length === 0) {
            throw new Error('No templates loaded');
        }

        // 入力をサンプリング
        const inputPoints = this.samplePoints(inputStrokes);
        const inputHistograms = this.computeShapeContexts(inputPoints);

        // 各テンプレートと比較
        const scores = this.templates.map(template => {
            // 点対応を見つける（簡易版: 順番に対応）
            const distance = this.computeHistogramDistance(
                inputHistograms, 
                template.histograms
            );
            
            const score = 1 / (1 + distance);
            
            return {
                char: template.char,
                score: score,
                distance: distance,
                pointCount: template.points.length
            };
        });

        scores.sort((a, b) => b.score - a.score);
        
        return scores.slice(0, topK).map(s => ({
            char: s.char,
            score: Math.round(s.score * 1000) / 1000
        }));
    }

    /**
     * ストロークから等間隔に点をサンプリング
     */
    samplePoints(strokes) {
        const allPoints = [];
        
        // 全ストロークの長さを計算
        let totalLength = 0;
        const strokeLengths = [];
        
        for (const stroke of strokes) {
            let length = 0;
            for (let i = 1; i < stroke.length; i++) {
                length += this.distance(stroke[i-1], stroke[i]);
            }
            strokeLengths.push(length);
            totalLength += length;
        }
        
        // 各ストロークから点をサンプリング
        for (let s = 0; s < strokes.length; s++) {
            const stroke = strokes[s];
            const strokeLen = strokeLengths[s];
            const numSample = Math.max(1, Math.round(this.numPoints * strokeLen / totalLength));
            
            if (stroke.length < 2) continue;
            
            const sampled = this.resampleStroke(stroke, numSample);
            allPoints.push(...sampled);
        }
        
        // 正規化
        return this.normalizePoints(allPoints);
    }

    /**
     * 単一ストロークをリサンプリング
     */
    resampleStroke(stroke, numPoints) {
        if (stroke.length <= numPoints) return stroke;
        
        const I = this.pathLength(stroke) / (numPoints - 1);
        let D = 0;
        const newPoints = [stroke[0]];
        
        for (let i = 1; i < stroke.length && newPoints.length < numPoints; i++) {
            const d = this.distance(stroke[i-1], stroke[i]);
            
            if ((D + d) >= I) {
                const qx = stroke[i-1][0] + ((I - D) / d) * (stroke[i][0] - stroke[i-1][0]);
                const qy = stroke[i-1][1] + ((I - D) / d) * (stroke[i][1] - stroke[i-1][1]);
                newPoints.push([qx, qy]);
                D = 0;
            } else {
                D += d;
            }
        }
        
        return newPoints;
    }

    /**
     * Shape Contextヒストグラムを計算
     */
    computeShapeContexts(points) {
        const histograms = [];
        
        // 全点対間の距離を計算（対数スケール）
        const distances = [];
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                distances.push(this.distance(points[i], points[j]));
            }
        }
        
        // 距離の統計値
        distances.sort((a, b) => a - b);
        const medianDist = distances[Math.floor(distances.length / 2)] || 1;
        
        // 各点についてShape Contextを計算
        for (let i = 0; i < points.length; i++) {
            const histogram = new Array(this.numBinsR * this.numBinsTheta).fill(0);
            
            for (let j = 0; j < points.length; j++) {
                if (i === j) continue;
                
                const dx = points[j][0] - points[i][0];
                const dy = points[j][1] - points[i][1];
                
                // 極座標に変換
                const r = Math.sqrt(dx * dx + dy * dy);
                const theta = Math.atan2(dy, dx);
                
                // 対数スケールで距離ビンを計算
                const logR = Math.log(r / medianDist + 0.001);
                const rBin = Math.min(
                    this.numBinsR - 1, 
                    Math.max(0, Math.floor((logR + 2) / 4 * this.numBinsR))
                );
                
                // 角度ビンを計算
                const thetaBin = Math.floor((theta + Math.PI) / (2 * Math.PI) * this.numBinsTheta) % this.numBinsTheta;
                
                // ヒストグラムに追加
                const bin = rBin * this.numBinsTheta + thetaBin;
                histogram[bin]++;
            }
            
            // 正規化
            const sum = histogram.reduce((a, b) => a + b, 0);
            if (sum > 0) {
                for (let k = 0; k < histogram.length; k++) {
                    histogram[k] /= sum;
                }
            }
            
            histograms.push(histogram);
        }
        
        return histograms;
    }

    /**
     * 2つのヒストグラム集合間の距離を計算
     */
    computeHistogramDistance(hists1, hists2) {
        const n = Math.min(hists1.length, hists2.length);
        if (n === 0) return Infinity;
        
        let totalDistance = 0;
        
        // 簡易版: 順番に対応させて比較
        for (let i = 0; i < n; i++) {
            const dist = this.chiSquaredDistance(hists1[i], hists2[i]);
            totalDistance += dist;
        }
        
        return totalDistance / n;
    }

    /**
     * χ²距離
     */
    chiSquaredDistance(hist1, hist2) {
        let distance = 0;
        
        for (let i = 0; i < hist1.length; i++) {
            const diff = hist1[i] - hist2[i];
            const sum = hist1[i] + hist2[i];
            if (sum > 0) {
                distance += (diff * diff) / sum;
            }
        }
        
        return distance * 0.5;
    }

    /**
     * 点列を正規化
     */
    normalizePoints(points) {
        if (points.length === 0) return points;
        
        // 重心
        let cx = 0, cy = 0;
        for (const p of points) {
            cx += p[0];
            cy += p[1];
        }
        cx /= points.length;
        cy /= points.length;
        
        // 平均距離
        let meanDist = 0;
        for (const p of points) {
            meanDist += Math.sqrt((p[0] - cx) ** 2 + (p[1] - cy) ** 2);
        }
        meanDist /= points.length;
        
        const scale = meanDist > 0 ? 1 / meanDist : 1;
        
        return points.map(p => [
            (p[0] - cx) * scale,
            (p[1] - cy) * scale
        ]);
    }

    /**
     * ユーティリティ
     */
    pathLength(points) {
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            length += this.distance(points[i-1], points[i]);
        }
        return length;
    }

    distance(p1, p2) {
        const dx = p1[0] - p2[0];
        const dy = p1[1] - p2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * tomoe_dataからロード
     */
    loadFromTomoe(characters) {
        this.templates = [];
        
        for (const charData of characters) {
            this.addTemplate(charData.char, charData.strokes);
        }
        
        console.log(`Loaded ${this.templates.length} templates into ShapeContext recognizer`);
    }

    getStats() {
        return {
            templates: this.templates.length,
            numPoints: this.numPoints,
            numBinsR: this.numBinsR,
            numBinsTheta: this.numBinsTheta,
            totalBins: this.numBinsR * this.numBinsTheta
        };
    }
}

// グローバルにエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShapeContextRecognizer };
}
