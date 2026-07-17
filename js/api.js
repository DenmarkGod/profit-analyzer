const API = {
    async fetchWithRetry(url, options, retries = CONFIG.RETRIES) {
        try {
            // Добавляем cache-busting, чтобы избежать ошибок QUIC на мобильных
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
            if (filterStr) { params.append('filter', filterStr); params.append('order', 'moment,desc'); }
            
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
    },

    async getFolders(headers) {
        const cached = Utils.getCache('folders');
        if (cached) return cached;

        UI.updateProgress(40, 'Загрузка категорий', 'Строим дерево папок...');
        const rows = await API.fetchAllPages('productfolder', headers);
        const folders = {};
        for (const row of rows) {
            let parentId = null;
            if (row.productFolder?.meta?.href) parentId = row.productFolder.meta.href.split('/').pop();
            else if (row.parent?.id) parentId = row.parent.id;
            
            folders[row.id] = { id: row.id, name: row.name || 'Без названия', parentId };
        }
        Utils.setCache('folders', folders);
        return folders;
    },

    async getStock(headers) {
        const cached = Utils.getCache('stock');
        if (cached) return cached;

        UI.updateProgress(30, 'Загрузка остатков', 'Считаем товары на складе...');
        const rows = await API.fetchAllPages('stock', headers);
        const stockMap = {};
        for (const row of rows) {
            if (row.assortment?.id) stockMap[row.assortment.id] = row.quantity || 0;
        }
        Utils.setCache('stock', stockMap);
        return stockMap;
    },

    // ГЛАВНОЕ: Получаем ТОЧНЫЕ данные о прибыли (выручка, себестоимость по FIFO, прибыль) ОДНИМ запросом
    async getProfitReport(headers, dateFrom, dateTo) {
        UI.updateProgress(60, 'Анализ прибыльности', 'Запрашиваем точный отчет у МойСклад...');
        // Отчет о прибыльности сразу дает точную себестоимость и прибыль без необходимости скачивать позиции чеков
        const filter = `date.from=${dateFrom}&date.to=${dateTo}&groupBy=assortment`;
        const response = await API.proxyFetch(`https://api.moysklad.ru/api/remap/1.2/report/profit?${filter}`, headers);
        if (!response.ok) throw new Error('Ошибка загрузки отчета о прибыльности');
        
        const data = await response.json();
        return data.rows || [];
    },

    async getSalesDocuments(headers, dateFrom, dateTo) {
        // Для журнала продаж нам нужны только документы, без позиций (экономим сотни запросов)
        const filter = `moment>=${dateFrom} 00:00:00;moment<=${dateTo} 23:59:59`;
        let docs = await API.fetchAllPages('retaildemand', headers, filter);
        if (docs.length === 0) docs = await API.fetchAllPages('demand', headers, filter);
        return docs.map(d => ({
            id: d.id,
            name: d.name || 'Б/Н',
            date: d.moment.split('T')[0],
            moment: d.moment,
            revenue: d.sum / 100
        })).sort((a, b) => b.moment.localeCompare(a.moment));
    }
};
