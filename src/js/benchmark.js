/**
 * 認識アルゴリズムのベンチマーク
 */

class RecognizerBenchmark {
    constructor() {
        this.results = [];
    }

    /**
     * ベンチマーク実行
     */
    async runAll(testCases) {
        console.log('🏃 Starting benchmark...\n');
        
        // 認識器を初期化
        const recognizers = await this.initializeRecognizers();
        
        for (const [name, recognizer] of Object.entries(recognizers)) {
            console.log(`📊 Testing ${name}...`);
            const result = await this.benchmarkRecognizer(name, recognizer, testCases);
            this.results.push(result);
        }
        
        this.displayResults();
        return this.results;
    }

    /**
     * 認識器を初期化
     */
    async initializeRecognizers() {
        const recognizers = {};

        // DTW
        const dtw = new KanjiRecognizer();
        await dtw.load();
        recognizers['DTW'] = dtw;

        // $N Multistroke
        const nStroke = new NMultistrokeRecognizer();
        nStroke.loadFromTomoe(dtw.characters);
        recognizers['$N-Multistroke'] = nStroke;

        // Shape Context
        const shapeContext = new ShapeContextRecognizer();
        shapeContext.loadFromTomoe(dtw.characters);
        recognizers['ShapeContext'] = shapeContext;

        // Ensemble
        const ensemble = new EnsembleRecognizer();
        await ensemble.load();
        recognizers['Ensemble'] = ensemble;

        return recognizers;
    }

    /**
     * 単一認識器のベンチマーク
     */
    async benchmarkRecognizer(name, recognizer, testCases) {
        const times = [];
        let correctTop1 = 0;
        let correctTop5 = 0;
        let correctTop10 = 0;

        for (const testCase of testCases) {
            const start = performance.now();
            const results = recognizer.recognize(testCase.strokes, 10);
            const end = performance.now();

            times.push(end - start);

            // 精度チェック
            const top1 = results[0]?.char === testCase.expected;
            const top5 = results.slice(0, 5).some(r => r.char === testCase.expected);
            const top10 = results.some(r => r.char === testCase.expected);

            if (top1) correctTop1++;
            if (top5) correctTop5++;
            if (top10) correctTop10++;
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);

        return {
            name,
            avgTime: Math.round(avgTime * 100) / 100,
            minTime: Math.round(minTime * 100) / 100,
            maxTime: Math.round(maxTime * 100) / 100,
            top1Accuracy: Math.round(correctTop1 / testCases.length * 1000) / 10,
            top5Accuracy: Math.round(correctTop5 / testCases.length * 1000) / 10,
            top10Accuracy: Math.round(correctTop10 / testCases.length * 1000) / 10,
            totalTests: testCases.length
        };
    }

    /**
     * 結果を表示
     */
    displayResults() {
        console.log('\n📈 Benchmark Results');
        console.log('═'.repeat(80));
        
        // ヘッダー
        console.log(
            `${'Algorithm'.padEnd(18)} | ` +
            `${'Avg(ms)'.padStart(8)} | ` +
            `${'Top-1%'.padStart(7)} | ` +
            `${'Top-5%'.padStart(7)} | ` +
            `${'Top-10%'.padStart(8)}`
        );
        console.log('-'.repeat(80));

        // 結果
        for (const r of this.results) {
            console.log(
                `${r.name.padEnd(18)} | ` +
                `${r.avgTime.toFixed(2).padStart(8)} | ` +
                `${r.top1Accuracy.toFixed(1).padStart(7)} | ` +
                `${r.top5Accuracy.toFixed(1).padStart(7)} | ` +
                `${r.top10Accuracy.toFixed(1).padStart(8)}`
            );
        }

        console.log('═'.repeat(80));

        // 最速
        const fastest = this.results.reduce((a, b) => a.avgTime < b.avgTime ? a : b);
        console.log(`\n⚡ Fastest: ${fastest.name} (${fastest.avgTime.toFixed(2)}ms)`);

        // 最も正確
        const mostAccurate = this.results.reduce((a, b) => a.top1Accuracy > b.top1Accuracy ? a : b);
        console.log(`🎯 Most Accurate: ${mostAccurate.name} (${mostAccurate.top1Accuracy.toFixed(1)}% top-1)`);
    }

    /**
     * 結果をHTMLテーブルで表示（デバッグ用）
     */
    renderTable() {
        const html = `
        <table class="benchmark-table">
            <thead>
                <tr>
                    <th>Algorithm</th>
                    <th>Avg Time (ms)</th>
                    <th>Top-1 %</th>
                    <th>Top-5 %</th>
                    <th>Top-10 %</th>
                </tr>
            </thead>
            <tbody>
                ${this.results.map(r => `
                    <tr>
                        <td>${r.name}</td>
                        <td>${r.avgTime.toFixed(2)}</td>
                        <td>${r.top1Accuracy.toFixed(1)}%</td>
                        <td>${r.top5Accuracy.toFixed(1)}%</td>
                        <td>${r.top10Accuracy.toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        `;
        
        return html;
    }
}

// テストケース生成（サンプル）
function generateTestCases(characters, count = 50) {
    const testCases = [];
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
        // わずかにノイズを加えたストローク
        const noisyStrokes = shuffled[i].strokes.map(stroke =>
            stroke.map(p => [
                p[0] + (Math.random() - 0.5) * 0.05,
                p[1] + (Math.random() - 0.5) * 0.05
            ])
        );
        
        testCases.push({
            strokes: noisyStrokes,
            expected: shuffled[i].char
        });
    }
    
    return testCases;
}

// グローバルにエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RecognizerBenchmark, generateTestCases };
}
