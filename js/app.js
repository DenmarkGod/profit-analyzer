let authToken = localStorage.getItem('moysklad_token') || '';
let productsData = {};
let foldersData = {};
let folderTree = [];

// Инициализация при загрузке
window.addEventListener('load', () => {
    if (authToken) document.getElementById('token-input').value = authToken;
});

async function connectToMoySklad() {
    const token = document.getElementById('token-input').value.trim();
    if (!token) return alert('Введите токен');

    authToken = token;
    localStorage.setItem('moysklad_token', token);
    
    document.getElementById('connect-btn').disabled = true;
    UI.showLoading();

    try {
        const headers = API.getAuthHeaders(token);
        UI.updateProgress(5, 'Подключение', 'Проверка токена...');
        const res = await API.proxyFetch('https://api.moysklad.ru/api/remap/1.2/entity/organization?limit=1', headers);
        if (!res.ok) throw new Error(`Ошибка авторизации: ${res.status}`);

        productsData = await API.getProducts(headers);
        await API.getStock(headers); // Загружаем остатки один раз при старте
        foldersData = await API.getFolders(headers);
        
        // Строим дерево
        const childrenMap = {};
        Object.values(foldersData).forEach(f => {
            if (f.parentId) {
                if (!childrenMap[f.parentId]) childrenMap[f.parentId] = [];
                childrenMap[f.parentId].push(f);
            }
        });
        const buildNode = (folder) => ({
            ...folder,
            children: (childrenMap[folder.id] || []).map(buildNode).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        });
        folderTree = Object.values(foldersData).filter(f => !f.parentId).map(buildNode).sort((a, b) => a.name.localeCompare(b.name, 'ru'));

        UI.updateProgress(90, 'Инициализация', 'Подготовка интерфейса...');
        // Здесь можно вызвать функции отрисовки фильтров, если они есть в UI
        
        UI.hideLoading();
        alert(`Успешно! Товаров: ${Object.keys(productsData).length}, Папок: ${Object.keys(foldersData).length}`);
        // Переключаем на главный экран (реализуй переключение view по своей логике)
    } catch (error) {
        UI.hideLoading();
        alert(error.message);
        document.getElementById('connect-btn').disabled = false;
    }
}

// ГЛАВНАЯ ФУНКЦИЯ РАСЧЕТА (Теперь быстрая и точная)
async function calculateOverview() {
        const dateFrom = document.getElementById('date-from')?.value || Utils.getDaysAgoStr(30);
        const dateTo = document.getElementById('date-to')?.value || Utils.getTodayStr();
        
        UI.showLoading();
        try {
            const headers = API.getAuthHeaders(authToken);
            
            // Получаем отчет о продажах с точной себестоимостью
            const reportRows = await API.getProfitReport(headers, dateFrom, dateTo);
            
            let totalRevenue = 0;
            let totalProfit = 0;
            let totalCost = 0;
            const byDate = {};
    
            // Отчет /report/sales возвращает:
            // - sum: выручка (в копейках)
            // - cost: себестоимость (в копейках, точная по FIFO)
            // - profit: прибыль (в копейках)
            for (const row of reportRows) {
                const revenue = (row.sum || 0) / 100;
                const cost = (row.cost || 0) / 100;
                const profit = (row.profit || 0) / 100;
                
                // Дата из отчета может быть в поле moment или date
                const date = row.moment ? row.moment.split('T')[0] : (row.date || dateTo);
    
                totalRevenue += revenue;
                totalCost += cost;
                totalProfit += profit;
    
                if (!byDate[date]) byDate[date] = { revenue: 0, profit: 0, cost: 0 };
                byDate[date].revenue += revenue;
                byDate[date].profit += profit;
                byDate[date].cost += cost;
            }
    
            const margin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;
    
            console.log('=== ИТОГИ ОТЧЕТА ===');
            console.log('Выручка:', totalRevenue);
            console.log('Себестоимость:', totalCost);
            console.log('Прибыль:', totalProfit);
            console.log('Маржа:', margin + '%');
            console.log('Строк в отчете:', reportRows.length);
    
            UI.updateProgress(90, 'Отрисовка', 'Обновляем графики...');
            UI.animateCountUp('metric-revenue', totalRevenue);
            UI.animateCountUp('metric-profit', totalProfit);
            UI.animateCountUp('metric-margin', margin, 1000, '%');
    
            const dates = Object.keys(byDate).sort();
            UI.renderChart('overview-chart', dates, dates.map(d => byDate[d].revenue), dates.map(d => byDate[d].profit));
    
            UI.hideLoading();
            document.getElementById('overview-results').classList.remove('hidden');
    
        } catch (error) {
            UI.hideLoading();
            console.error('Ошибка расчета:', error);
            alert('Ошибка расчета: ' + error.message);
        }
    }
}
