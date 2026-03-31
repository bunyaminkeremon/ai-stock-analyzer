const API_KEY = 'AIzaSyD4Rj6ykae16mVqklxSl37GArtSV_D-i1s';

const symbolInput = document.getElementById('symbol');
const marketSelect = document.getElementById('market');
const horizonSelect = document.getElementById('horizon');
const riskSelect = document.getElementById('risk');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');
const resultSection = document.getElementById('resultSection');
const signalBadge = document.getElementById('signalBadge');
const stockName = document.getElementById('stockName');
const stockPrice = document.getElementById('stockPrice');
const confValue = document.getElementById('confValue');
const indicatorsGrid = document.getElementById('indicatorsGrid');
const analysisContent = document.getElementById('analysisContent');

let fullAnalysis = {};

function setSymbol(sym) {
    symbolInput.value = sym;
    if (sym.includes('.IS')) {
        marketSelect.value = 'BIST';
    } else if (sym.includes('-USD')) {
        marketSelect.value = 'CRYPTO';
    } else {
        marketSelect.value = 'US';
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    
    if (fullAnalysis[tab]) {
        renderAnalysis(fullAnalysis[tab]);
    }
}

function renderAnalysis(text) {
    let html = text
        .replace(/### (.+)/g, '<h3>$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .trim();
    analysisContent.innerHTML = html;
}

async function analyze() {
    let symbol = symbolInput.value.trim().toUpperCase();
    if (!symbol) return;

    const market = marketSelect.value;
    const horizon = horizonSelect.value;
    const risk = riskSelect.value;

    if (market === 'BIST' && !symbol.includes('.IS')) {
        symbol += '.IS';
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    errorMsg.style.display = 'none';
    resultSection.style.display = 'none';
    loading.style.display = 'flex';

    const horizonText = { short: 'Short term (1-7 days)', medium: 'Medium term (1-3 months)', long: 'Long term (6+ months)' };
    const riskText = { low: 'Low risk tolerance', medium: 'Medium risk tolerance', high: 'High risk tolerance' };

    const prompt = `You are an expert financial analyst and technical trader. Analyze the stock "${symbol}" for trading.

The investor profile:
- Investment horizon: ${horizonText[horizon]}
- Risk tolerance: ${riskText[risk]}

Provide a comprehensive analysis using these technical indicators. Give realistic estimated values:

1. RSI (14-period) - value and interpretation
2. MACD - signal line crossover status
3. Bollinger Bands - current position (upper/middle/lower)
4. SMA 20 & SMA 50 - crossover status
5. EMA 12 & EMA 26 - trend direction
6. ADX - trend strength value
7. Stochastic RSI - overbought/oversold
8. Volume - relative to average

Respond in this EXACT format:

SIGNAL: [BUY/SELL/HOLD]
CONFIDENCE: [number 0-100]
STOCK_NAME: [full company name]
CURRENT_PRICE: [estimated current price with currency]

INDICATORS:
RSI: [value] | [Bullish/Bearish/Neutral]
MACD: [status] | [Bullish/Bearish/Neutral]
BOLLINGER: [position] | [Bullish/Bearish/Neutral]
SMA: [crossover status] | [Bullish/Bearish/Neutral]
EMA: [trend] | [Bullish/Bearish/Neutral]
ADX: [value] | [Bullish/Bearish/Neutral]
STOCH_RSI: [value] | [Bullish/Bearish/Neutral]
VOLUME: [status] | [Bullish/Bearish/Neutral]

SHORT_TERM:
### Signal: [Buy/Sell/Hold]
### Key Levels
- Support: [price level]
- Resistance: [price level]
- Stop Loss: [price level]
### Analysis
- [detailed point about short term outlook]
- [point about momentum]
- [point about entry/exit]

MEDIUM_TERM:
### Signal: [Buy/Sell/Hold]
### Key Levels
- Support: [price level]
- Resistance: [price level]
- Target Price: [price level]
### Analysis
- [detailed point about medium term trend]
- [point about fundamentals]
- [point about sector outlook]

LONG_TERM:
### Signal: [Buy/Sell/Hold]
### Key Levels
- Fair Value: [estimated price]
- Target (12 months): [price level]
### Analysis
- [detailed point about long term potential]
- [point about growth drivers]
- [point about risks]

Be specific with numbers and realistic with your analysis. Use actual market knowledge.`;

   const models = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash'
];

    let responseText = null;
    let lastError = '';

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const data = await res.json();
            if (!data.error && data.candidates && data.candidates[0]) {
                responseText = data.candidates[0].content.parts[0].text;
                break;
            } else {
                lastError = data.error ? data.error.message : 'No response';
            }
        } catch (err) {
            lastError = err.message;
        }
    }

    loading.style.display = 'none';
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze Stock';

    if (!responseText) {
        errorMsg.textContent = 'Analysis failed: ' + lastError;
        errorMsg.style.display = 'block';
        return;
    }

    try {
        // Parse signal
        const signalMatch = responseText.match(/SIGNAL:\s*(BUY|SELL|HOLD)/i);
        const confMatch = responseText.match(/CONFIDENCE:\s*(\d+)/);
        const nameMatch = responseText.match(/STOCK_NAME:\s*(.+)/);
        const priceMatch = responseText.match(/CURRENT_PRICE:\s*(.+)/);

        const signal = signalMatch ? signalMatch[1].toUpperCase() : 'HOLD';
        const conf = confMatch ? confMatch[1] : '50';
        const name = nameMatch ? nameMatch[1].trim() : symbol;
        const price = priceMatch ? priceMatch[1].trim() : '';

        signalBadge.textContent = signal;
        signalBadge.className = 'signal-badge signal-' + signal.toLowerCase();
        stockName.textContent = name;
        stockPrice.textContent = price;
        confValue.textContent = conf + '%';

        // Parse indicators
        const indSection = responseText.match(/INDICATORS:\n([\s\S]*?)(?=SHORT_TERM:)/);
        indicatorsGrid.innerHTML = '';

        if (indSection) {
            const lines = indSection[1].trim().split('\n').filter(l => l.includes('|'));
            lines.forEach(line => {
                const parts = line.split('|');
                const nameVal = parts[0].split(':');
                const indName = nameVal[0].trim();
                const indVal = nameVal[1] ? nameVal[1].trim() : '';
                const indSignal = parts[1] ? parts[1].trim() : 'Neutral';

                let signalClass = 'ind-neutral';
                if (indSignal.toLowerCase().includes('bullish')) signalClass = 'ind-bullish';
                if (indSignal.toLowerCase().includes('bearish')) signalClass = 'ind-bearish';

                const div = document.createElement('div');
                div.className = 'indicator';
                div.innerHTML = `
                    <div class="ind-name">${indName}</div>
                    <div class="ind-value">${indVal}</div>
                    <div class="ind-signal ${signalClass}">${indSignal}</div>
                `;
                indicatorsGrid.appendChild(div);
            });
        }

        // Parse term analyses
        const shortMatch = responseText.match(/SHORT_TERM:\n([\s\S]*?)(?=MEDIUM_TERM:)/);
        const medMatch = responseText.match(/MEDIUM_TERM:\n([\s\S]*?)(?=LONG_TERM:)/);
        const longMatch = responseText.match(/LONG_TERM:\n([\s\S]*?)$/);

        fullAnalysis = {
            short: shortMatch ? shortMatch[1].trim() : 'No short term analysis available.',
            medium: medMatch ? medMatch[1].trim() : 'No medium term analysis available.',
            long: longMatch ? longMatch[1].trim() : 'No long term analysis available.'
        };

        // Show selected horizon tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${horizon}"]`).classList.add('active');
        renderAnalysis(fullAnalysis[horizon]);

        resultSection.style.display = 'block';
    } catch (err) {
        errorMsg.textContent = 'Error parsing analysis: ' + err.message;
        errorMsg.style.display = 'block';
    }
}

analyzeBtn.addEventListener('click', analyze);

symbolInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyze();
});
