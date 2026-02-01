/**
 * 認識プロセスの可視化
 */

class RecognitionVisualizer {
    constructor() {
        this.container = document.getElementById('visualization');
        if (!this.container) {
            this.createContainer();
        }
    }

    createContainer() {
        const resultSection = document.querySelector('.result-section');
        this.container = document.createElement('div');
        this.container.id = 'visualization';
        this.container.className = 'visualization-section';
        resultSection.insertBefore(this.container, resultSection.firstChild);
    }

    /**
     * リアルタイムプレビューを表示
     */
    showRealtimePreview(strokes, candidates) {
        if (candidates.length === 0) {
            this.container.innerHTML = '';
            this.container.style.display = 'none';
            return;
        }
        
        this.container.style.display = 'block';
        
        const top3 = candidates.slice(0, 3);
        const maxScore = top3[0].score;
        
        this.container.innerHTML = `
            <div class="realtime-preview">
                <h3>🤔 認識中...</h3>
                <div class="candidate-bars">
                    ${top3.map((c, i) => `
                        <div class="candidate-bar" style="--delay: ${i * 0.1}s">
                            <span class="candidate-char">${c.char}</span>
                            <div class="score-bar-container">
                                <div class="score-bar" style="width: ${(c.score / maxScore * 100).toFixed(1)}%; --score: ${c.score}"></div>
                                <span class="score-label">${(c.score * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="stroke-indicator">
                    <span class="stroke-count">🖊️ ${strokes.length}ストローク</span>
                    ${this.getStrokeHint(strokes.length, top3[0].char)}
                </div>
            </div>
        `;
    }

    /**
     * ストローク数のヒントを表示
     */
    getStrokeHint(currentStrokes, predictedChar) {
        const charData = window.app?.recognizer?.characters?.find(c => c.char === predictedChar);
        if (!charData) return '';
        
        const expectedStrokes = charData.strokes.length;
        const diff = expectedStrokes - currentStrokes;
        
        if (diff > 0) {
            return `<span class="hint more">あと${diff}画で「${predictedChar}」になりそう</span>`;
        } else if (diff < 0) {
            return `<span class="hint less">${Math.abs(diff)}画多いです</span>`;
        } else {
            return `<span class="hint perfect">「${predictedChar}」の完成！</span>`;
        }
    }

    /**
     * 詳細なマッチング結果を表示
     */
    showDetailedMatch(inputStrokes, matchResult) {
        const { char, score, strokeDetails } = matchResult;
        
        this.container.style.display = 'block';
        this.container.innerHTML = `
            <div class="detailed-match">
                <h3>🔍 「${char}」のマッチング詳細</h3>
                <div class="match-grid">
                    <div class="input-preview">
                        <h4>あなたの入力</h4>
                        <canvas id="inputPreview" width="150" height="150"></canvas>
                    </div>
                    <div class="template-preview">
                        <h4>テンプレート</h4>
                        <canvas id="templatePreview" width="150" height="150"></canvas>
                    </div>
                </div>
                <div class="stroke-comparison">
                    ${strokeDetails.map((detail, i) => `
                        <div class="stroke-match-item ${detail.quality}">
                            <span class="stroke-num">${i + 1}画目</span>
                            <div class="match-bar" style="--match: ${detail.similarity}">
                                <div class="match-fill"></div>
                            </div>
                            <span class="match-score">${(detail.similarity * 100).toFixed(0)}%</span>
                        </div>
                    `).join('')}
                </div>
                <div class="score-breakdown">
                    <h4>スコア内訳</h4>
                    <div class="breakdown-grid">
                        <div class="breakdown-item">
                            <span class="label">ストローク一致度</span>
                            <span class="value">${(matchResult.strokeScore * 100).toFixed(1)}%</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="label">形状一致度</span>
                            <span class="value">${(matchResult.shapeScore * 100).toFixed(1)}%</span>
                        </div>
                        <div class="breakdown-item ${matchResult.penalty > 0 ? 'has-penalty' : ''}">
                            <span class="label">ストローク数ペナルティ</span>
                            <span class="value">-${(matchResult.penalty * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // プレビューを描画
        this.drawPreview('inputPreview', inputStrokes, '#3b82f6');
        this.drawPreview('templatePreview', matchResult.templateStrokes, '#10b981');
    }

    /**
     * プレビューキャンバスに描画
     */
    drawPreview(canvasId, strokes, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 150, 150);
        
        if (!strokes || strokes.length === 0) return;
        
        // 境界ボックスを計算
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const stroke of strokes) {
            for (const [x, y] of stroke) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        
        const scale = Math.min(130 / (maxX - minX || 1), 130 / (maxY - minY || 1));
        const offsetX = (150 - (maxX - minX) * scale) / 2 - minX * scale;
        const offsetY = (150 - (maxY - minY) * scale) / 2 - minY * scale;
        
        // 描画
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        for (const stroke of strokes) {
            if (stroke.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(stroke[0][0] * scale + offsetX, stroke[0][1] * scale + offsetY);
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(stroke[i][0] * scale + offsetX, stroke[i][1] * scale + offsetY);
            }
            ctx.stroke();
        }
    }

    /**
     * 類似度ヒートマップを表示
     */
    showSimilarityHeatmap(results) {
        const heatmapContainer = document.createElement('div');
        heatmapContainer.className = 'similarity-heatmap';
        
        // 上位10文字をグリッドで表示
        const top10 = results.slice(0, 10);
        const maxScore = top10[0].score;
        
        heatmapContainer.innerHTML = `
            <h3>🌡️ 類似度ヒートマップ</h3>
            <div class="heatmap-grid">
                ${top10.map((r, i) => {
                    const intensity = r.score / maxScore;
                    const hue = 120 * intensity; // 赤(0) → 緑(120)
                    return `
                        <div class="heatmap-cell" style="--intensity: ${intensity}; --hue: ${hue}">
                            <span class="heatmap-char">${r.char}</span>
                            <span class="heatmap-score">${(r.score * 100).toFixed(0)}%</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        this.container.appendChild(heatmapContainer);
    }

    /**
     * 認識プロセスのアニメーションを表示
     */
    showRecognitionProcess(strokes) {
        this.container.style.display = 'block';
        this.container.innerHTML = `
            <div class="process-animation">
                <h3>⚙️ 認識プロセス</h3>
                <div class="process-steps">
                    <div class="step active" data-step="1">
                        <div class="step-icon">🖊️</div>
                        <div class="step-label">入力取得</div>
                        <div class="step-detail">${strokes.length}ストローク</div>
                    </div>
                    <div class="step-arrow">→</div>
                    <div class="step" data-step="2">
                        <div class="step-icon">📐</div>
                        <div class="step-label">前処理</div>
                        <div class="step-detail">正規化・リサンプリング</div>
                    </div>
                    <div class="step-arrow">→</div>
                    <div class="step" data-step="3">
                        <div class="step-icon">🔍</div>
                        <div class="step-label">DTW計算</div>
                        <div class="step-detail">3,044文字と比較</div>
                    </div>
                    <div class="step-arrow">→</div>
                    <div class="step" data-step="4">
                        <div class="step-icon">📊</div>
                        <div class="step-label">ソート</div>
                        <div class="step-detail">類似度順に並べ替え</div>
                    </div>
                </div>
            </div>
        `;
        
        // アニメーション
        let currentStep = 1;
        const interval = setInterval(() => {
            currentStep++;
            if (currentStep > 4) {
                clearInterval(interval);
                return;
            }
            const step = this.container.querySelector(`[data-step="${currentStep}"]`);
            if (step) step.classList.add('active');
        }, 200);
    }

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
            this.container.style.display = 'none';
        }
    }
}

// グローバルにエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RecognitionVisualizer };
}
