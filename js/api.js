const API = {
    async fetchWithRetry(url, options, retries = CONFIG.RETRIES) {
        try {
            const separator = url.includes('?') ? '&' : '?';
            const finalUrl = `${url}${separator}_t=${Date.now()}`;
            return await fetch(finalUrl, options);
        } catch (error) {
            if (retries > 0) {
                console.warn(`Сетевой сбой, повтор через ${CONFIG.RETRY_DELAY}мс...`);
                UI.updateProgress(null, 'Нестабильная сеть, переподключение...', `Попытка ${CONFIG.RETRIES - retries + 1} из ${CONFIG.RETRIES + 1}`);
                await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY));
                return API.fetchWithRetry(url, options, retries - 1);
            }
            throw new Error('Сеть принудительно сбрасывает соединение. Включите/выключите авиарежим или смените Wi-Fi на мобильный интернет.');
        }
    },

    async proxyFetch(targetUrl, headers) {
        const response = await API.fetchWithRetry(CONFIG.PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl, headers: headers, method: 'GET' })
        });
        if (response.status === 429) throw new Error('Превышен лимит запросов МойСклад (429). Подождите минуту и попробуйте снова.');
        return response;
    },

    getAuthHeaders: (token) => {
        token = token.trim();
        if (token.startsWith("Basic ") || token.startsWith("Bearer ")) return { "Authorization": token };
        if (token.includes("@") && token.includes(":")) return { "Authorization": `Basic ${btoa(token)}` };
        return { "Authorization": `Bearer ${token}` };
    },

    async fetchAllPages(baseEndpoint, headers, filterStr = '') {
        const allRows = [];
        let offset = 0;
        while (true) {
            const params = new URLSearchParams({ limit: 1000, offset });
            if (filterStr) { 
                params.append('filter', filterStr); 
                params.append('order', 'moment,desc'); 
            }
            
            const response = await API.proxyFetch(`https://api.moysklad.ru/api/remap/1.2/entity/${baseEndpoint}?${params.toString()}`, headers);
            if (!response.ok) break;
            
            const data = await response.json();
            const rows = data.rows || [];
            allRows.push(...rows);
            if (rows.length < 1000) break;
            offset += 1000;
        }
        return allRows;
    },

    async getProducts(headers) {
        const cached = Utils.getCache('products');
        if (cached) return cached;

        UI.updateProgress(20, 'Загрузка товаров', 'Скачиваем справочник...');
        const rows = await API.fetchAllPages('product', headers);
        const products = {};
        for (const row of rows) {
            if (row.archived) continue;
            products[row.id] = {
                id: row.id,
                name: row.name || 'Без названия',
                parentFolderId: row.parentFolder?.id || null
            };
        }
        Utils.setCache('products', products);
        return products;
   
