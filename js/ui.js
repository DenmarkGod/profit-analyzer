const UI = {
    updateProgress: (percent, stage, details = '') => {
        const bar = document.getElementById('progress-bar');
        const pct = document.getElementById('progress-percent');
        const stg = document.getElementById('progress-stage');
        const txt = document.getElementById('loading-text');
        const det = document.getElementById('loading-details');
        
        if (percent !== null && bar) bar.style.width = `${percent}%`;
        if (pct) pct.textContent = percent !== null ? `${Math.round(percent)}%` : '';
        if (stg) stg.textContent = stage || '';
        if (txt) txt.textContent = stage || '';
        if (det) det.textContent = details;
    },

    showLoading: () => document.getElementById('loading-overlay').classList.remove('hidden'),
    hideLoading: () => {
        UI.updateProgress(100, 'Готово!');
        setTimeout(() => document.getElementById('loading-overlay').classList.add('hidden'), 500);
    },

    animateCountUp: (elementId, target, duration = 1000, suffix = '') => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const startTime = performance.now();
        const update = (currentTime) => {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            el.textContent = Utils.formatNumber(target * easeOut) + suffix;
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    },

    renderChart: (canvasId, labels, revenueData, profitData) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        if (window.myChartInstance) window.myChartInstance.destroy();
        
        window.myChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(d => d.slice(5)),
                datasets: [
                    { label: 'Выручка', data: revenueData, borderColor: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.1)', fill: true, tension: 0.4 },
                    { label: 'Прибыль', data: profitData, borderColor: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.1)', fill: true, tension: 0.4 }
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    y: { ticks: { callback: v => Utils.formatMoney(v), color: '#64748b' }, grid: { color: '#1e293b' } },
                    x: { ticks: { color: '#64748b' }, grid: { display: false } }
                }
            }
        });
    }
};
