let GROQ_KEY = localStorage.getItem('groq_key') || '';
let TW_KEY = localStorage.getItem('tw_key') || '';

const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const errorMsg = document.getElementById('errorMsg');
const resultSection = document.getElementById('resultSection');
const signalBadge = document.getElementById('signalBadge');
const stockName = document.getElementById('stockName');
const stockPrice = document.getElementById('stockPrice');
const confValue = document.getElementById('confValue');
const indicatorsGrid = document.getElementById('indicatorsGrid');
const analysisContent = document.getElementById('analysisContent');
const horizonSelect = document.getElementById('horizon');
const riskSelect = document.getElementById('risk');

const groqInput = document.getElementById('groqKeyInput');
const groqSaveBtn = document.getElementById('groqSaveBtn');
const groqStatus = document.getElementById('groqStatus');
const twInput = document.getElementById('twKeyInput');
const twSaveBtn = document.getElementById('twSaveBtn');
const twStatus = document.getElementById('twStatus');

let fullAnalysis = {};

// Key management
if (GROQ_KEY) { groqInput.value = '••••••••••'; groqStatus.textContent = 'Saved'; groqStatus.style.color = '#27ae60'; }
if (TW_KEY) { twInput.value = '••••••••••'; twStatus.textContent = 'Saved'; twStatus.style.color = '#27ae60'; }

groqSaveBtn.addEventListener('click', () => {
    const k = groqInput.value.trim();
    if (k && !k.includes('•')) { GROQ_KEY = k; localStorage.setItem('groq_key', k); groqInput.value = '••••••••••'; groqStatus.textContent = 'Saved'; groqStatus.style.color = '#27ae60'; }
});
twSaveBtn.addEventListener('click', () => {
    const k = twInput.value.trim();
    if (k && !k.includes('•')) { TW_KEY = k; localStorage.setItem('tw_key', k); twInput.value = '••••••••••'; twStatus.textContent = 'Saved'; twStatus.style.color = '#27ae60'; }
});

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    if (fullAnalysis[tab]) renderAnalysis(fullAnalysis[tab]);
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

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchTW(endpoint, extra) {
    const url = `https://api.twelvedata.com/${endpoint}?symbol=THYAO&country=Turkey&interval=1day&outputsize=1&apikey=${TW_KEY}${extra || ''}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 429) { await wait(8000); const retry = await fetch(url); return await retry.json(); }
    return data;
}

function getVal(data, key) {
    try { return parseFloat(data.values[0][key]).toFixed(2); } catch(e) { return 'N/A'; }
}

async function analyze() {
    if (!GROQ_KEY) { errorMsg.textContent = 'Please enter your Groq API key.'; errorMsg.style.display = 'block'; return; }
    if (!TW_KEY) { errorMsg.textContent = 'Please enter your Twelve Data API key.'; errorMsg.style.display = 'block'; return; }

    analyzeBtn.disabled = true;
    errorMsg.style.display = 'none';
    resultSection.style.display = 'none';
    loading.style.display = 'flex';

    try {
        loadingText.textContent = 'Fetching THYAO price...';
        const quote = await fetchTW('quote');
        if (quote.code || quote.status === 'error') throw new Error('Could not fetch THYAO. Check Twelve Data key or try again.');

        loadingText.textContent = 'Fetching RSI...';
        await wait(1500);
        const rsi = await fetchTW('rsi');

        loadingText.textContent = 'Fetching MACD...';
        await wait(1500);
        const macd = await fetchTW('macd');

        loadingText.textContent = 'Fetching Bollinger Bands...';
        await wait(1500);
        const bb = await fetchTW('bbands');

        loadingText.textContent = 'Fetching SMA...';
        await wait(1500);
        const sma20 = await fetchTW('sma', '&time_period=20');
        await wait(1500);
        const sma50 = await fetchTW('sma', '&time_period=50');

        loadingText.textContent = 'Fetching EMA...';
        await wait(1500);
        const ema12 = await fetchTW('ema', '&time_period=12');
        await wait(1500);
        const ema26 = await fetchTW('ema', '&time_period=26');

        loadingText.textContent = 'Fetching ADX & StochRSI...';
        await wait(1500);
        const adx = await fetchTW('adx');
        await wait(1500);
        const stoch = await fetchTW('stochrsi');

        const price = parseFloat(quote.close).toFixed(2);
        const change = parseFloat(quote.percent_change).toFixed(2);
        const vol = quote.volume;
        const h52 = quote.fifty_two_week ? quote.fifty_two_week.high : 'N/A';
        const l52 = quote.fifty_two_week ? quote.fifty_two_week.low : 'N/A';

        const ind = {
            rsi: getVal(rsi, 'rsi'), macd: getVal(macd, 'macd'), macdSig: getVal(macd, 'macd_signal'),
            bbU: getVal(bb, 'upper_band'), bbM: getVal(bb, 'middle_band'), bbL: getVal(bb, 'lower_band'),
            sma20: getVal(sma20, 'sma'), sma50: getVal(sma50, 'sma'),
            ema12: getVal(ema12, 'ema'), ema26: getVal(ema26, 'ema'),
            adx: getVal(adx, 'adx'), stochK: getVal(stoch, 'fast_k')
        };

        loadingText.textContent = 'AI analyzing...';

        const horizon = horizonSelect.value;
        const risk = riskSelect.value;
        const hT = { short: 'Short (1-7 days)', medium: 'Medium (1-3 months)', long: 'Long (6+ months)' };
        const rT = { low: 'Low', medium: 'Medium', high: 'High' };

        const prompt = `Expert analyst. REAL LIVE DATA for Turkish Airlines (THYAO) BIST:

Price: ${price} TRY (${change}%) | Vol: ${vol} | 52W: ${l52}-${h52}
RSI: ${ind.rsi} | MACD: ${ind.macd} (Sig: ${ind.macdSig})
BB: ${ind.bbL}/${ind.bbM}/${ind.bbU}
SMA20: ${ind.sma20} SMA50: ${ind.sma50} | EMA12: ${ind.ema12} EMA26: ${ind.ema26}
ADX: ${ind.adx} | StochRSI: ${ind.stochK}

Investor: ${hT[horizon]}, ${rT[risk]} risk

EXACT format:

SIGNAL: [BUY/SELL/HOLD]
CONFIDENCE: [0-100]

INDICATORS:
RSI: ${ind.rsi} | [Bullish/Bearish/Neutral]
MACD: ${ind.macd} | [Bullish/Bearish/Neutral]
BOLLINGER: ${price} vs ${ind.bbL}-${ind.bbU} | [Bullish/Bearish/Neutral]
SMA: 20:${ind.sma20} 50:${ind.sma50} | [Bullish/Bearish/Neutral]
EMA: 12:${ind.ema12} 26:${ind.ema26} | [Bullish/Bearish/Neutral]
ADX: ${ind.adx} | [Bullish/Bearish/Neutral]
STOCH_RSI: ${ind.stochK} | [Bullish/Bearish/Neutral]
VOLUME: ${vol} | [Bullish/Bearish/Neutral]

SHORT_TERM:
### Signal: [Buy/Sell/Hold]
### Key Levels
- Support: [level]
- Resistance: [level]
- Stop Loss: [level]
### Analysis
- [point]
- [point]

MEDIUM_TERM:
### Signal: [Buy/Sell/Hold]
### Key Levels
- Target: [level]
### Analysis
- [point]
- [point]

LONG_TERM:
### Signal: [Buy/Sell/Hold]
### Analysis
- [point]
- [point]

Real numbers only. Concise.`;

        const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 2000 })
        });
        const aiData = await aiRes.json();
        if (aiData.error) throw new Error(aiData.error.message);

        const text = aiData.choices[0].message.content;
        const sig = text.match(/SIGNAL:\s*(BUY|SELL|HOLD)/i);
        const conf = text.match(/CONFIDENCE:\s*(\d+)/);

        signalBadge.textContent = sig ? sig[1].toUpperCase() : 'HOLD';
        signalBadge.className = 'signal-badge signal-' + (sig ? sig[1].toLowerCase() : 'hold');
        stockName.textContent = 'Turkish Airlines (THYAO)';
        stockPrice.textContent = price + ' TRY (' + change + '%)';
        confValue.textContent = (conf ? conf[1] : '50') + '%';

        const indSec = text.match(/INDICATORS:\n([\s\S]*?)(?=SHORT_TERM:)/);
        indicatorsGrid.innerHTML = '';
        if (indSec) {
            indSec[1].trim().split('\n').filter(l => l.includes('|')).forEach(line => {
                const p = line.split('|');
                const nv = p[0].split(':');
                const n = nv[0].trim();
                const v = nv.slice(1).join(':').trim();
                const s = p[1] ? p[1].trim() : 'Neutral';
                let cl = 'ind-neutral';
                if (s.toLowerCase().includes('bullish')) cl = 'ind-bullish';
                if (s.toLowerCase().includes('bearish')) cl = 'ind-bearish';
                const d = document.createElement('div');
                d.className = 'indicator';
                d.innerHTML = `<div class="ind-name">${n}</div><div class="ind-value">${v}</div><div class="ind-signal ${cl}">${s}</div>`;
                indicatorsGrid.appendChild(d);
            });
        }

        const sM = text.match(/SHORT_TERM:\n([\s\S]*?)(?=MEDIUM_TERM:)/);
        const mM = text.match(/MEDIUM_TERM:\n([\s\S]*?)(?=LONG_TERM:)/);
        const lM = text.match(/LONG_TERM:\n([\s\S]*?)$/);

        fullAnalysis = {
            short: sM ? sM[1].trim() : 'No analysis.',
            medium: mM ? mM[1].trim() : 'No analysis.',
            long: lM ? lM[1].trim() : 'No analysis.'
        };

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${horizon}"]`).classList.add('active');
        renderAnalysis(fullAnalysis[horizon]);
        resultSection.style.display = 'block';

    } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
    }

    loading.style.display = 'none';
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze THYAO';
}

analyzeBtn.addEventListener('click', analyze);