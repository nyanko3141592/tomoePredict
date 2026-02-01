/**
 * 手書き文字認識エンジン
 * tomoe_dataを使用して文字を認識する
 */

class KanjiRecognizer {
    constructor() {
        this.characters = [];
        this.loaded = false;
        this.loadingPromise = null;
    }

    /**
     * 文字データを読み込む
     */
    async load() {
        if (this.loaded) return;
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = this._loadData();
        return this.loadingPromise;
    }

    async _loadData() {
        try {
            const response = await fetch('data/characters.json');
            if (!response.ok) {
                throw new Error(`Failed to load: ${response.status}`);
            }
            
            this.characters = await response.json();
            this.loaded = true;
            console.log(`Loaded ${this.characters.length} characters`);
        } catch (error) {
            console.error('Failed to load character data:', error);
            throw error;
        }
    }

    /**
     * 入力されたストロークと最も似た文字を探す
     * @param {number[][][]} inputStrokes - 入力ストロークの配列
     * @param {number} topK - 返す結果数
     * @returns {Array<{char: string, score: number}>} 認識結果
     */
    recognize(inputStrokes, topK = 10) {
        if (!this.loaded || this.characters.length === 0) {
            throw new Error('Character data not loaded');
        }

        if (!inputStrokes || inputStrokes.length === 0) {
            return [];
        }

        // 入力ストロークを前処理
        const processedInput = StrokePreprocessor.process(inputStrokes, {
            resamplePoints: 32,
            smoothWindow: 3
        });

        // 各文字との距離を計算
        const scores = [];
        
        for (const charData of this.characters) {
            const matchResult = this._computeDetailedDistance(processedInput, charData);
            
            scores.push({
                char: charData.char,
                score: matchResult.score,
                distance: matchResult.distance,
                strokeDetails: matchResult.strokeDetails,
                strokeScore: matchResult.strokeScore,
                shapeScore: matchResult.shapeScore,
                penalty: matchResult.penalty,
                templateStrokes: charData.strokes
            });
        }

        // スコアでソートして上位を返す
        scores.sort((a, b) => b.score - a.score);
        
        return scores.slice(0, topK).map(s => ({
            char: s.char,
            score: Math.round(s.score * 1000) / 1000,
            strokeDetails: s.strokeDetails,
            strokeScore: s.strokeScore,
            shapeScore: s.shapeScore,
            penalty: s.penalty,
            templateStrokes: s.templateStrokes
        }));
    }

    /**
     * 詳細な距離計算（マッチング情報付き）
     */
    _computeDetailedDistance(inputStrokes, charData) {
        const charStrokes = charData.strokes;
        
        // ストローク数の差にペナルティ
        const strokeDiff = Math.abs(inputStrokes.length - charStrokes.length);
        const strokePenalty = Math.min(strokeDiff * 0.15, 0.5);

        // 各ストロークのマッチング詳細
        const strokeDetails = [];
        const minStrokes = Math.min(inputStrokes.length, charStrokes.length);
        let totalDistance = 0;

        for (let i = 0; i < minStrokes; i++) {
            const dtwDist = DTW.distance(inputStrokes[i], charStrokes[i]);
            const similarity = Math.exp(-dtwDist * 2); // 距離を類似度に変換
            
            let quality = 'poor';
            if (similarity > 0.8) quality = 'good';
            else if (similarity > 0.5) quality = 'medium';
            
            strokeDetails.push({
                strokeIndex: i,
                distance: dtwDist,
                similarity: similarity,
                quality: quality
            });
            
            totalDistance += dtwDist;
        }

        // 平均距離とスコア計算
        const avgDistance = totalDistance / Math.max(minStrokes, 1);
        const shapeScore = Math.exp(-avgDistance * 2);
        const strokeScore = minStrokes / Math.max(inputStrokes.length, charStrokes.length);
        
        // 最終スコア
        const finalScore = (shapeScore * 0.7 + strokeScore * 0.3) * (1 - strokePenalty);

        return {
            score: finalScore,
            distance: avgDistance + strokePenalty,
            strokeDetails: strokeDetails,
            strokeScore: strokeScore,
            shapeScore: shapeScore,
            penalty: strokePenalty
        };
    }

    /**
     * 簡易的な距離計算（高速版）
     */
    _computeDistance(inputStrokes, charStrokes) {
        const strokeDiff = Math.abs(inputStrokes.length - charStrokes.length);
        const strokePenalty = strokeDiff * 0.15;

        const minStrokes = Math.min(inputStrokes.length, charStrokes.length);
        let totalDistance = 0;

        for (let i = 0; i < minStrokes; i++) {
            totalDistance += DTW.distance(inputStrokes[i], charStrokes[i]);
        }

        const avgDistance = totalDistance / Math.max(minStrokes, 1);
        return avgDistance + strokePenalty;
    }

    /**
     * 文字でフィルタリングして認識（特定の文字セット内のみ検索）
     */
    recognizeInSet(inputStrokes, charSet, topK = 10) {
        if (!this.loaded || this.characters.length === 0) {
            throw new Error('Character data not loaded');
        }

        const setChars = new Set(charSet);
        const filteredChars = this.characters.filter(c => setChars.has(c.char));

        if (filteredChars.length === 0) {
            return [];
        }

        const processedInput = StrokePreprocessor.process(inputStrokes, {
            resamplePoints: 32,
            smoothWindow: 3
        });

        const scores = [];
        for (const charData of filteredChars) {
            const matchResult = this._computeDetailedDistance(processedInput, charData);
            scores.push({
                char: charData.char,
                score: matchResult.score,
                strokeDetails: matchResult.strokeDetails,
                strokeScore: matchResult.strokeScore,
                shapeScore: matchResult.shapeScore,
                penalty: matchResult.penalty,
                templateStrokes: charData.strokes
            });
        }

        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, topK).map(s => ({
            char: s.char,
            score: Math.round(s.score * 1000) / 1000,
            strokeDetails: s.strokeDetails,
            strokeScore: s.strokeScore,
            shapeScore: s.shapeScore,
            penalty: s.penalty,
            templateStrokes: s.templateStrokes
        }));
    }

    /**
     * 統計情報を取得
     */
    getStats() {
        const hiragana = this.characters.filter(c => /[\u3040-\u309F]/.test(c.char));
        const katakana = this.characters.filter(c => /[\u30A0-\u30FF]/.test(c.char));
        const kanji = this.characters.filter(c => /[\u4E00-\u9FAF]/.test(c.char));

        return {
            total: this.characters.length,
            hiragana: hiragana.length,
            katakana: katakana.length,
            kanji: kanji.length,
            others: this.characters.length - hiragana.length - katakana.length - kanji.length
        };
    }
}

// グローバルにエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KanjiRecognizer };
}
