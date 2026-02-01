/**
 * 手書き漢字認識デモアプリ
 */

class DrawingApp {
    constructor() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.recognizers = {};
        this.currentAlgorithm = 'dtw';
        this.visualizer = new RecognitionVisualizer();
        
        // 描画状態
        this.isDrawing = false;
        this.strokes = [];      // 全ストローク
        this.currentStroke = []; // 現在のストローク
        this.lastResult = null;
        
        // UI要素
        this.undoBtn = document.getElementById('undoBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.recognizeBtn = document.getElementById('recognizeBtn');
        this.resultsContainer = document.getElementById('results');
        this.loadingEl = document.getElementById('loading');
        this.realtimeCheck = document.getElementById('realtimeCheck');
        this.algorithmSelect = document.getElementById('algorithmSelect');
        this.resultCountSelect = document.getElementById('resultCount');
        
        this.init();
    }

    async init() {
        this.setupCanvas();
        this.setupEventListeners();
        
        // データ読み込み
        try {
            this.showLoading(true);
            
            // DTW（ベース）
            const dtw = new KanjiRecognizer();
            await dtw.load();
            this.recognizers['dtw'] = dtw;
            
            // $N Multistroke
            const nStroke = new NMultistrokeRecognizer();
            nStroke.loadFromTomoe(dtw.characters);
            this.recognizers['nstroke'] = nStroke;
            
            // Shape Context
            const shapeContext = new ShapeContextRecognizer();
            shapeContext.loadFromTomoe(dtw.characters);
            this.recognizers['shapecontext'] = shapeContext;
            
            // Ensemble
            const ensemble = new EnsembleRecognizer();
            await ensemble.load();
            this.recognizers['ensemble'] = ensemble;
            
            this.showLoading(false);
            
            console.log('Loaded recognizers:', Object.keys(this.recognizers));
            console.log('DTW stats:', dtw.getStats());
            console.log('$N-Multistroke stats:', nStroke.getStats());
            console.log('ShapeContext stats:', shapeContext.getStats());
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('データの読み込みに失敗しました。ページを更新してください。');
        }
    }

    getCurrentRecognizer() {
        return this.recognizers[this.currentAlgorithm] || this.recognizers['dtw'];
    }

    setupCanvas() {
        // Canvasのサイズを調整（Retinaディスプレイ対応）
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = 300 * dpr;
        this.canvas.height = 300 * dpr;
        this.ctx.scale(dpr, dpr);
        
        // 描画スタイル
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // CSSサイズ
        this.canvas.style.width = '100%';
        this.canvas.style.height = 'auto';
    }

    setupEventListeners() {
        // マウスイベント
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.endDrawing());
        this.canvas.addEventListener('mouseleave', () => this.endDrawing());
        
        // タッチイベント
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.endDrawing();
        });
        
        // ボタン
        this.undoBtn.addEventListener('click', () => this.undo());
        this.clearBtn.addEventListener('click', () => this.clear());
        this.recognizeBtn.addEventListener('click', () => this.recognize());
        
        // オプション
        this.realtimeCheck.addEventListener('change', () => {
            if (this.realtimeCheck.checked && this.strokes.length > 0) {
                this.recognize();
            }
        });
        
        this.algorithmSelect.addEventListener('change', (e) => {
            this.currentAlgorithm = e.target.value;
            console.log('Algorithm changed to:', this.currentAlgorithm);
            if (this.strokes.length > 0) {
                this.recognize(this.realtimeCheck.checked);
            }
        });
    }

    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 300 / rect.width;
        const scaleY = 300 / rect.height;
        
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }

    startDrawing(event) {
        this.isDrawing = true;
        const coords = this.getCanvasCoordinates(event);
        
        this.currentStroke = [[coords.x, coords.y]];
        
        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);
        
        this.canvas.classList.add('drawing');
    }

    draw(event) {
        if (!this.isDrawing) return;
        
        const coords = this.getCanvasCoordinates(event);
        this.currentStroke.push([coords.x, coords.y]);
        
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();
    }

    endDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        if (this.currentStroke.length > 1) {
            this.strokes.push([...this.currentStroke]);
            this.undoBtn.disabled = false;
            
            // リアルタイム認識（プレビュー表示）
            if (this.realtimeCheck.checked) {
                clearTimeout(this.recognizeTimeout);
                this.recognizeTimeout = setTimeout(() => this.recognize(true), 100);
            }
        }
        
        this.currentStroke = [];
    }

    undo() {
        if (this.strokes.length === 0) return;
        
        this.strokes.pop();
        this.redrawCanvas();
        
        this.undoBtn.disabled = this.strokes.length === 0;
        
        if (this.realtimeCheck.checked) {
            if (this.strokes.length > 0) {
                this.recognize(true);
            } else {
                this.visualizer.clear();
                this.showPlaceholder();
            }
        }
    }

    clear() {
        this.strokes = [];
        this.currentStroke = [];
        this.lastResult = null;
        this.redrawCanvas();
        this.undoBtn.disabled = true;
        this.canvas.classList.remove('drawing');
        this.visualizer.clear();
        this.showPlaceholder();
    }

    redrawCanvas() {
        this.ctx.clearRect(0, 0, 300, 300);
        
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 3;
        
        for (const stroke of this.strokes) {
            if (stroke.length < 2) continue;
            
            this.ctx.beginPath();
            this.ctx.moveTo(stroke[0][0], stroke[0][1]);
            
            for (let i = 1; i < stroke.length; i++) {
                this.ctx.lineTo(stroke[i][0], stroke[i][1]);
            }
            
            this.ctx.stroke();
        }
    }

    async recognize(isRealtime = false) {
        if (this.strokes.length === 0) {
            this.showPlaceholder();
            return;
        }
        
        const topK = parseInt(this.resultCountSelect.value);
        
        if (!isRealtime) {
            this.showLoading(true);
        }
        
        // プロセスアニメーションを表示
        if (!isRealtime) {
            this.visualizer.showRecognitionProcess(this.strokes);
        }
        
        // 非同期で認識処理
        await new Promise(resolve => setTimeout(resolve, isRealtime ? 10 : 50));
        
        try {
            const recognizer = this.getCurrentRecognizer();
            const startTime = performance.now();
            const results = recognizer.recognize(this.strokes, topK);
            const endTime = performance.now();
            
            console.log(`${this.currentAlgorithm}: ${(endTime - startTime).toFixed(2)}ms, top-1: ${results[0]?.char}`);
            
            this.lastResult = results;
            
            if (isRealtime && results.length > 0) {
                // リアルタイムプレビュー
                this.visualizer.showRealtimePreview(this.strokes, results);
            } else {
                // 詳細結果表示
                this.visualizer.clear();
            }
            
            this.displayResults(results, isRealtime);
        } catch (error) {
            console.error('Recognition error:', error);
            this.showError('認識中にエラーが発生しました。');
        } finally {
            if (!isRealtime) {
                this.showLoading(false);
            }
        }
    }

    displayResults(results, isRealtime = false) {
        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="result-placeholder">
                    結果が見つかりませんでした
                </div>
            `;
            return;
        }
        
        // ヒートマップを表示（リアルタイムでない場合）
        if (!isRealtime) {
            this.visualizer.showSimilarityHeatmap(results);
        }
        
        this.resultsContainer.innerHTML = results.map((result, index) => `
            <div class="result-item" data-index="${index}" title="クリックで詳細を表示">
                <span class="rank">${index + 1}</span>
                <div class="char">${result.char}</div>
                <div class="score">${(result.score * 100).toFixed(1)}%</div>
                ${result.strokeDetails ? `
                    <div class="stroke-info">
                        ${result.strokeDetails.length}画
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        // クリックイベント
        this.resultsContainer.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                const result = results[index];
                this.showDetailView(result);
            });
            
            // ホバーでプレビュー
            item.addEventListener('mouseenter', () => {
                if (isRealtime) return;
                const index = parseInt(item.dataset.index);
                const result = results[index];
                this.highlightResult(result);
            });
        });
    }

    showDetailView(result) {
        this.visualizer.showDetailedMatch(this.strokes, result);
        
        // スクロールして可視化セクションを見せる
        const vizSection = document.querySelector('.visualization-section');
        if (vizSection) {
            vizSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    highlightResult(result) {
        // 結果に基づいて何かハイライト表示（必要に応じて）
        console.log('Highlighting:', result.char);
    }

    showPlaceholder() {
        this.resultsContainer.innerHTML = `
            <div class="result-placeholder">
                文字を書いて「認識」ボタンを押してください
            </div>
        `;
    }

    showLoading(show) {
        if (show) {
            this.loadingEl.classList.remove('hidden');
            this.resultsContainer.classList.add('hidden');
        } else {
            this.loadingEl.classList.add('hidden');
            this.resultsContainer.classList.remove('hidden');
        }
    }

    showError(message) {
        this.resultsContainer.innerHTML = `
            <div class="result-placeholder" style="color: var(--danger-color);">
                ${message}
            </div>
        `;
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--text-color);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 0.9rem;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// アプリ起動
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DrawingApp();
});
