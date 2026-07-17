const Utils = {
    formatMoney: (amount) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount),
    formatNumber: (num) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num),
    formatDateRu: (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-',
    getTodayStr: () => new Date().toISOString().split('T')[0],
    getDaysAgoStr: (days) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
    },
    
    getCache: (key) => {
        try {
            const data = localStorage.getItem(`${key}_${CONFIG.CACHE_VERSION}`);
            return data ? JSON.parse(data) : null;
        } catch { return null; }
    },
    setCache: (key, data) => {
        localStorage.setItem(`${key}_${CONFIG.CACHE_VERSION}`, JSON.stringify(data));
    },
    clearCache: () => {
        Object.keys(localStorage).forEach(key => {
            if (key.includes(CONFIG.CACHE_VERSION)) localStorage.removeItem(key);
        });
    }
};
