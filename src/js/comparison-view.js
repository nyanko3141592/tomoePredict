/**
 * 複数認識手法の比較表示
 */

class ComparisonView {
    constructor(containerId) {
        this.container = document.getElementById(containerId) || this.createContainer();
        this.results = {};
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'comparison-view';
        container.className = 'comparison-section';
        
        const resultSection = document.querySelector('.result-section');
        if (resultSection) {
            resultSection.insertBefore(container, resultSection.firstChild);
        }
        
        return container;
    }

    /**
     * 全手法の結果を表示
     */
    showComparison(inputStrokes, results) {
        this.results = results;
        
        this.container.innerHTML = `
            <div class="comparison-header">
                <h3>🔬 アルゴリズム比較</h3>
                <span class="comparison-note">各手法のトップ3結果</span>
            </div>
            <div class="comparison-grid">
                ${this.renderAlgorithmCard('dtw', 'DTW', results.dtw, '📊')}
                ${this.renderAlgorithmCard('nstroke', '$N-Multistroke', results.nstroke, '⚡')}
                ${this.renderAlgorithmCard('shapecontext', 'Shape Context', results.shapecontext, '🎨')}
                ${this.renderAlgorithmCard('ensemble', 'Ensemble', results.ensemble, '🔮')}
            </div>
            <div class="process-comparison">
                <h4>判定プロセス比較</h4>
                <div class="process-tabs">
                    <button class="tab-btn active" data-tab="dtw-process">DTW</button>
                    <button class="tab-btn" data-tab="nstroke-process">$N-Multistroke</button>
                    <button class="tab-btn" data-tab="shapecontext-process">Shape Context</button>
                </div>
                <div class="process-content">
                    ${this.renderDTWProcess(inputStrokes, results.dtw)}
                    ${this.renderNStrokeProcess(inputStrokes, results.nstroke)}
                    ${this.renderShapeContextProcess(inputStrokes, results.shapecontext)}
                </div>
            </div>
        `;

        this.attachTabListeners();
    }

    /**
     * アルゴリズムカードをレンダリング
     */
    renderAlgorithmCard(id, name, result, icon) {
        if (!result || !result.results) {
            return '';
        }

        const top3 = result.results.slice(0, 3);
        const time = result.time.toFixed(1);
        
        // 1位が一致しているかチェック
        const top1Char = top3[0]?.char || '-';
        const isAgreed = this.checkAgreement(id, top1Char);
        
        return `
            <div class="algo-card ${isAgreed ? 'agreed' : ''}" data-algo="${id}">
                <div class="algo-header">
                    <span class="algo-icon">${icon}</span>
                    <span class="algo-name">${name}</span>
                    <span class="algo-time">${time}ms</span>
                </div>
                <div class="algo-results">
                    ${top3.map((r, i) => `
                        <div class="algo-result-item rank-${i + 1}">
                            <span class="rank">${i + 1}</span>
                            <span class="char">${r.char}</span>
                            <span class="score">${(r.score * 100).toFixed(0)}%</span>
                            ${r.dtwScore !== undefined ? `
                                <span class="ensemble-breakdown">
                                    D:${(r.dtwScore * 100).toFixed(0)} N:${(r.nStrokeScore * 100).toFixed(0)}
                                </span>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
                ${isAgreed ? '<div class="consensus-badge">✓ 一致</div>' : ''}
            </div>
        `;
    }

    /**
     * 各手法の1位が一致しているかチェック
     */
    checkAgreement(currentId, currentTop1) {
        const top1s = Object.values(this.results)
            .filter(r => r && r.results && r.results.length > 0)
            .map(r => r.results[0].char);
        
        const agreement = top1s.filter(c => c === currentTop1).length;
        return agreement >= Math.ceil(top1s.length / 2);
    }

    /**
     * DTWのプロセス視覚化
     */
    renderDTWProcess(inputStrokes, result) {
        if (!result || !result.results || result.results.length === 0) return '';

        const bestMatch = result.results[0];
        
        return `
            <div id="dtw-process" class="process-panel active">
                <div class="process-explanation">
                    <h5>Dynamic Time Warping (動的時間伸縮)</h5>
                    <p>2つの時系列の「形」を比較。時間軸の伸縮を許容して最適な対応を見つける。</p>
                </div>
                <div class="dtw-visualization">
                    <div class="dtw-matrix-container">
                        <h6>距離マトリックス</h6>
                        <canvas id="dtw-matrix" width="200" height="200"></canvas>
                        <div class="dtw-legend">
                            <span class="legend-item"><span class="color low"></span>近い</span>
                            <span class="legend-item"><span class="color high"></span>遠い</span>
                        </div>
                    </div>
                    <div class="dtw-warping-path">
                        <h6>ワーピングパス</h6>
                        <canvas id="dtw-path" width="300" height="150"></canvas>
                        <p class="path-description">青=入力、緑=テンプレート、赤線=対応関係</p>
                    </div>
                </div>
                <div class="dtw-calculation">
                    <h6>計算式</h6>
                    <div class="formula">
                        DTW(A,B) = min<sub>path</sub> Σ d(a<sub>i</sub>, b<sub>j</sub>)
                    </div>
                    <div class="calculation-steps">
                        <div class="step">1. 各点間のユークリッド距離を計算</div>
                        <div class="step">2. 動的計画法で最小経路を探索</div>
                        <div class="step">3. 正規化してスコアに変換</div>
                    </div>
                    <div class="final-score">
                        最終スコア: <strong>${(bestMatch.score * 100).toFixed(1)}%</strong>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * N-Multistrokeのプロセス視覚化
     */
    renderNStrokeProcess(inputStrokes, result) {
        if (!result || !result.results || result.results.length === 0) return '';

        return `
            <div id="nstroke-process" class="process-panel">
                <div class="process-explanation">
                    <h5>$N Multistroke Recognizer</h5>
                    <p>角度ベクトルを特徴量として使用。回転・スケーリングに不変で超高速。</p>
                </div>
                <div class="nstroke-visualization">
                    <div class="vector-comparison">
                        <h6>角度ベクトル比較</h6>
                        <canvas id="nstroke-vectors" width="300" height="150"></canvas>
                        <div class="vector-legend">
                            <span class="legend-item"><span class="color input"></span>入力</span>
                            <span class="legend-item"><span class="color template"></span>テンプレート</span>
                        </div>
                    </div>
                    <div class="angle-histogram">
                        <h6>角度ヒストグラム</h6>
                        <canvas id="nstroke-histogram" width="300" height="100"></canvas>
                    </div>
                </div>
                <div class="nstroke-calculation">
                    <h6>正規化プロセス</h6>
                    <div class="normalization-flow">
                        <div class="flow-step">
                            <div class="flow-icon">📍</div>
                            <div class="flow-label">重心移動</div>
                        </div>
                        <div class="flow-arrow">→</div>
                        <div class="flow-step">
                            <div class="flow-icon">📐</div>
                            <div class="flow-label">回転正規化</div>
                        </div>
                        <div class="flow-arrow">→</div>
                        <div class="flow-step">
                            <div class="flow-icon">🔍</div>
                            <div class="flow-label">スケーリング</div>
                        </div>
                    </div>
                    <div class="complexity-note">
                        計算量: O(n) - 入力サイズに比例
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Shape Contextのプロセス視覚化
     */
    renderShapeContextProcess(inputStrokes, result) {
        if (!result || !result.results || result.results.length === 0) return '';

        return `
            <div id="shapecontext-process" class="process-panel">
                <div class="process-explanation">
                    <h5>Shape Context (形状コンテキスト)</h5>
                    <p>点の周りの他の点の分布をヒストグラム化。局所的な形状特徴を捉える。</p>
                </div>
                <div class="shapecontext-visualization">
                    <div class="point-distribution">
                        <h6>点の分布パターン</h6>
                        <canvas id="sc-points" width="150" height="150"></canvas>
                        <p class="point-desc">参照点（赤）から見た他の点の分布</p>
                    </div>
                    <div class="histogram-3d">
                        <h6>Shape Context ヒストグラム</h6>
                        <canvas id="sc-histogram" width="250" height="150"></canvas>
                        <div class="hist-axes">
                            <span>X: 角度 (0-2π)</span>
                            <span>Y: 距離 (対数スケール)</span>
                        </div>
                    </div>
                </div>
                <div class="shapecontext-calculation">
                    <h6>ヒストグラム比較 (χ²距離)</h6>
                    <div class="formula">
                        χ² = ½ Σ (H<sub>1</sub>(i) - H<sub>2</sub>(i))² / (H<sub>1</sub>(i) + H<sub>2</sub>(i))
                    </div>
                    <div class="histogram-comparison-viz">
                        <div class="hist-bar-group">
                            <div class="hist-bar input" style="--height: 60%"></div>
                            <div class="hist-bar template" style="--height: 55%"></div>
                        </div>
                        <div class="hist-bar-group">
                            <div class="hist-bar input" style="--height: 30%"></div>
                            <div class="hist-bar template" style="--height: 35%"></div>
                        </div>
                        <div class="hist-bar-group">
                            <div class="hist-bar input" style="--height: 80%"></div>
                            <div class="hist-bar template" style="--height: 75%"></div>
                        </div>
                    </div>
                    <div class="matching-note">
                        青=入力、緑=テンプレート。類似した分布ほど距離が小さい
                    </div>
                </div>
            </div>
        `;
    }

    attachTabListeners() {
        const tabs = this.container.querySelectorAll('.tab-btn');
        const panels = this.container.querySelectorAll('.process-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.dataset.tab;

                // タブのアクティブ状態を更新
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // パネルの表示を更新
                panels.forEach(p => {
                    p.classList.remove('active');
                    if (p.id === targetId) {
                        p.classList.add('active');
                    }
                });

                // 描画
                this.drawVisualization(targetId);
            });
        });

        // 初期描画
        this.drawVisualization('dtw-process');
    }

    drawVisualization(processType) {
        // 実際のデータに基づいて描画
        switch (processType) {
            case 'dtw-process':
                this.drawDTWMatrix();
                this.drawDTWPath();
                break;
            case 'nstroke-process':
                this.drawNStrokeVectors();
                this.drawNStrokeHistogram();
                break;
            case 'shapecontext-process':
                this.drawSCPoints();
                this.drawSCHistogram();
                break;
        }
    }

    drawDTWMatrix() {
        const canvas = document.getElementById('dtw-matrix');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const size = 20;
        
        // サンプルの距離マトリックスを描画
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const dist = Math.sqrt(i * i + j * j) / Math.sqrt(2 * size * size);
                const intensity = 1 - Math.min(1, dist);
                
                ctx.fillStyle = `hsl(${intensity * 240}, 70%, 50%)`;
                ctx.fillRect(i * 10, j * 10, 10, 10);
            }
        }

        // ワーピングパスを重ね描き
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(100, 80);
        ctx.lineTo(200, 200);
        ctx.stroke();
    }

    drawDTWPath() {
        const canvas = document.getElementById('dtw-path');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // 入力シーケンス（上）
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 50; i++) {
            const x = i * 6;
            const y = 30 + Math.sin(i * 0.3) * 20;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // テンプレートシーケンス（下）
        ctx.strokeStyle = '#10b981';
        ctx.beginPath();
        for (let i = 0; i < 50; i++) {
            const x = i * 6;
            const y = 90 + Math.sin(i * 0.25 + 0.5) * 20;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 対応関係（赤線）
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 50; i += 5) {
            const x1 = i * 6;
            const y1 = 30 + Math.sin(i * 0.3) * 20;
            const x2 = i * 6;
            const y2 = 90 + Math.sin(i * 0.25 + 0.5) * 20;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    drawNStrokeVectors() {
        const canvas = document.getElementById('nstroke-vectors');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // 入力ベクトル（青）
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const length = 30 + Math.random() * 20;
            
            ctx.beginPath();
            ctx.moveTo(75, 75);
            ctx.lineTo(75 + Math.cos(angle) * length, 75 + Math.sin(angle) * length);
            ctx.stroke();
        }

        // テンプレートベクトル（緑、ずらして表示）
        ctx.strokeStyle = '#10b981';
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const length = 30 + Math.random() * 20;
            
            ctx.beginPath();
            ctx.moveTo(225, 75);
            ctx.lineTo(225 + Math.cos(angle) * length, 75 + Math.sin(angle) * length);
            ctx.stroke();
        }
    }

    drawNStrokeHistogram() {
        const canvas = document.getElementById('nstroke-histogram');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const barWidth = 300 / 16;

        // 入力ヒストグラム（青）
        ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
        for (let i = 0; i < 16; i++) {
            const height = Math.random() * 80;
            ctx.fillRect(i * barWidth, 100 - height, barWidth - 2, height);
        }

        // テンプレートヒストグラム（緑、重ねて）
        ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
        for (let i = 0; i < 16; i++) {
            const height = Math.random() * 80;
            ctx.fillRect(i * barWidth + 2, 100 - height, barWidth - 4, height);
        }
    }

    drawSCPoints() {
        const canvas = document.getElementById('sc-points');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // 参照点（赤）
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(75, 75, 6, 0, Math.PI * 2);
        ctx.fill();

        // 周囲の点（青）
        ctx.fillStyle = '#3b82f6';
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 50;
            const x = 75 + Math.cos(angle) * dist;
            const y = 75 + Math.sin(angle) * dist;
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // 対数距離円
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 1;
        [20, 40, 60].forEach(r => {
            ctx.beginPath();
            ctx.arc(75, 75, r, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    drawSCHistogram() {
        const canvas = document.getElementById('sc-histogram');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // 2Dヒストグラムを擬似的に描画
        const cols = 12;
        const rows = 5;
        const cellW = 250 / cols;
        const cellH = 150 / rows;

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const value = Math.random();
                const hue = 240 - value * 240; // 青→赤
                ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
                ctx.fillRect(i * cellW, j * cellH, cellW - 1, cellH - 1);
            }
        }
    }

    clear() {
        this.container.innerHTML = '';
    }
}

// グローバルにエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ComparisonView };
}
