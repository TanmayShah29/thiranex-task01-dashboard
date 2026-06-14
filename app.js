// ===== SALES DASHBOARD - app.js =====
// Thiranex Internship | Task 01 | Tanmay

let allData = [];
let charts = {};

// ===== CSV PARSER =====
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i]);

    // --- DATA CLEANING ---
    // Standardize Casing for Categories & Products
    if (obj['Category']) obj['Category'] = obj['Category'].charAt(0).toUpperCase() + obj['Category'].slice(1).toLowerCase();
    if (obj['Product']) {
      obj['Product'] = obj['Product'].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    } else {
      obj['Product'] = 'Unknown Product';
    }

    obj['Revenue'] = parseFloat(obj['Revenue']) || 0;
    obj['Units Sold'] = parseInt(obj['Units Sold']) || 0;
    obj['Unit Price'] = parseFloat(obj['Unit Price']) || 0;
    obj['Date'] = new Date(obj['Date']);
    return obj;
  }).filter(r => r['Order ID']);
}

// ===== LOAD DEFAULT DATA =====
async function loadDefaultData() {
  try {
    const res = await fetch('./data/sales_data.csv?v=' + Date.now());
    const text = await res.text();
    allData = parseCSV(text);
    updateDashboard(allData);
  } catch (e) {
    console.warn('Could not load CSV file. Using inline sample data.');
    allData = getSampleData();
    updateDashboard(allData);
  }
}

// ===== FILE UPLOAD =====
function setupUpload() {
  const input = document.getElementById('csvInput');
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      allData = parseCSV(ev.target.result);
      applyFilters();
    };
    reader.readAsText(file);
  });

  document.getElementById('uploadZone').addEventListener('click', () => input.click());
}

// ===== FILTERS =====
function applyFilters() {
  const cat = document.getElementById('catFilter').value;
  const region = document.getElementById('regionFilter').value;
  const from = document.getElementById('dateFrom').value;
  const to = document.getElementById('dateTo').value;

  let filtered = [...allData];
  if (cat) filtered = filtered.filter(r => r['Category'] === cat);
  if (region) filtered = filtered.filter(r => r['Region'] === region);
  if (from) filtered = filtered.filter(r => r['Date'] >= new Date(from));
  if (to) filtered = filtered.filter(r => r['Date'] <= new Date(to));

  updateDashboard(filtered);
}

function resetFilters() {
  document.getElementById('catFilter').value = '';
  document.getElementById('regionFilter').value = '';
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value = '';
  updateDashboard(allData);
}

// ===== KPI UPDATER =====
function updateKPIs(data) {
  const totalRevenue = data.reduce((s, r) => s + r['Revenue'], 0);
  const totalUnits = data.reduce((s, r) => s + r['Units Sold'], 0);
  const totalOrders = data.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Top product
  const productRev = {};
  data.forEach(r => { productRev[r['Product']] = (productRev[r['Product']] || 0) + r['Revenue']; });
  const topProduct = Object.entries(productRev).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('kpiRevenue').textContent = '₹' + formatNum(totalRevenue);
  document.getElementById('kpiOrders').textContent = totalOrders;
  document.getElementById('kpiUnits').textContent = formatNum(totalUnits);
  document.getElementById('kpiTop').textContent = topProduct ? topProduct[0].split(' ')[0] + '...' : '-';
}

function formatNum(n) {
  if (n >= 10000000) return (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// ===== CHART HELPERS =====
const COLORS = {
  purple: '#6c63ff',
  teal: '#00d4aa',
  red: '#ff6b6b',
  yellow: '#ffd93d',
  blue: '#64b4ff',
  orange: '#ff9f43',
};
const PALETTE = Object.values(COLORS);

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ===== REVENUE TREND CHART =====
function renderRevenueTrend(data) {
  destroyChart('trend');
  const monthly = {};
  data.forEach(r => {
    const sortKey = `${r['Date'].getFullYear()}-${String(r['Date'].getMonth() + 1).padStart(2, '0')}`;
    const displayKey = r['Date'].toLocaleString('default', { month: 'short', year: '2-digit' });
    if (!monthly[sortKey]) monthly[sortKey] = { label: displayKey, value: 0 };
    monthly[sortKey].value += r['Revenue'];
  });

  const sortedKeys = Object.keys(monthly).sort();
  const labels = sortedKeys.map(k => monthly[k].label);
  const values = sortedKeys.map(k => monthly[k].value);

  const ctx = document.getElementById('revenueTrendChart').getContext('2d');
  charts['trend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data: values,
        borderColor: COLORS.purple,
        backgroundColor: 'rgba(108,99,255,0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: COLORS.purple,
        pointRadius: 4,
      }]
    },
    options: chartOptions('Revenue (₹)', true)
  });
}

// ===== TOP PRODUCTS CHART =====
function renderTopProducts(data) {
  destroyChart('products');
  const productRev = {};
  data.forEach(r => { productRev[r['Product']] = (productRev[r['Product']] || 0) + r['Revenue']; });
  const sorted = Object.entries(productRev).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const ctx = document.getElementById('topProductsChart').getContext('2d');
  charts['products'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(p => p[0]),
      datasets: [{
        label: 'Revenue',
        data: sorted.map(p => p[1]),
        backgroundColor: PALETTE,
        borderRadius: 6,
      }]
    },
    options: chartOptions('Revenue (₹)', false)
  });
}

// ===== CATEGORY PIE CHART =====
function renderCategoryPie(data) {
  destroyChart('category');
  const catRev = {};
  data.forEach(r => { catRev[r['Category']] = (catRev[r['Category']] || 0) + r['Revenue']; });

  const ctx = document.getElementById('categoryChart').getContext('2d');
  charts['category'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(catRev),
      datasets: [{
        data: Object.values(catRev),
        backgroundColor: PALETTE,
        borderColor: '#1a1d27',
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { color: '#7c7f9e', font: { size: 11 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed;
              const formatted = val >= 1000 ? formatNum(val) : val.toLocaleString('en-IN');
              return ` Revenue: ₹${formatted}`;
            }
          }
        }
      },
      cutout: '60%',
    }
  });
}

// ===== REGION BAR CHART =====
function renderRegionChart(data) {
  destroyChart('region');
  const regionRev = {};
  data.forEach(r => { regionRev[r['Region']] = (regionRev[r['Region']] || 0) + r['Revenue']; });

  const ctx = document.getElementById('regionChart').getContext('2d');
  charts['region'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(regionRev),
      datasets: [{
        label: 'Revenue',
        data: Object.values(regionRev),
        backgroundColor: [COLORS.purple, COLORS.teal, COLORS.red, COLORS.yellow],
        borderRadius: 6,
      }]
    },
    options: { ...chartOptions('Revenue', false), indexAxis: 'y' }
  });
}

// ===== UNITS TREND =====
function renderUnitsTrend(data) {
  destroyChart('units');
  const monthly = {};
  data.forEach(r => {
    const sortKey = `${r['Date'].getFullYear()}-${String(r['Date'].getMonth() + 1).padStart(2, '0')}`;
    const displayKey = r['Date'].toLocaleString('default', { month: 'short', year: '2-digit' });
    if (!monthly[sortKey]) monthly[sortKey] = { label: displayKey, value: 0 };
    monthly[sortKey].value += r['Units Sold'];
  });

  const sortedKeys = Object.keys(monthly).sort();
  const labels = sortedKeys.map(k => monthly[k].label);
  const values = sortedKeys.map(k => monthly[k].value);

  const ctx = document.getElementById('unitsTrendChart').getContext('2d');
  charts['units'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Units Sold',
        data: values,
        backgroundColor: 'rgba(0,212,170,0.7)',
        borderColor: COLORS.teal,
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: chartOptions('Units', false)
  });
}

// ===== SHARED CHART OPTIONS =====
function chartOptions(yLabel, hasGradient) {
  const isCurrency = yLabel.includes('₹') || yLabel.toLowerCase().includes('revenue');
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#21253a',
        titleColor: '#e8eaf6',
        bodyColor: '#e8eaf6',
        borderColor: '#2d3148',
        borderWidth: 1,
        callbacks: {
          label: ctx => {
            const val = ctx.parsed.y ?? ctx.parsed;
            const formatted = val >= 1000 ? formatNum(val) : val.toLocaleString('en-IN');
            return ` ${ctx.dataset.label || ''}: ${isCurrency ? '₹' : ''}${formatted}`;
          }
        }
      }
    },
    scales: {
      x: { grid: { color: 'rgba(45,49,72,0.5)' }, ticks: { color: '#7c7f9e', font: { size: 11 } } },
      y: { grid: { color: 'rgba(45,49,72,0.5)' }, ticks: { color: '#7c7f9e', font: { size: 11 }, callback: v => (isCurrency ? '₹' : '') + formatNum(v) } }
    }
  };
}

// ===== DATA TABLE =====
function renderTable(data) {
  const tbody = document.getElementById('dataTableBody');
  const display = data.slice(0, 20);
  const tagClass = cat => {
    const m = { 'Electronics': 'electronics', 'Furniture': 'furniture', 'Apparel': 'apparel', 'Health': 'health', 'Home Appliances': 'home' };
    return 'tag tag-' + (m[cat] || 'electronics');
  };

  tbody.innerHTML = display.map(r => `
    <tr>
      <td>${r['Order ID']}</td>
      <td>${r['Date'].toLocaleDateString('en-IN')}</td>
      <td>${r['Product']}</td>
      <td><span class="${tagClass(r['Category'])}">${r['Category']}</span></td>
      <td>${r['Region']}</td>
      <td>${r['Units Sold']}</td>
      <td>₹${parseInt(r['Unit Price']).toLocaleString('en-IN')}</td>
      <td style="font-weight:600; color: var(--accent2)">₹${r['Revenue'].toLocaleString('en-IN')}</td>
    </tr>
  `).join('');

  document.getElementById('tableCount').textContent = `Showing ${display.length} of ${data.length} records`;
}

// ===== MASTER UPDATE =====
function updateDashboard(data) {
  updateKPIs(data);
  renderRevenueTrend(data);
  renderTopProducts(data);
  renderCategoryPie(data);
  renderRegionChart(data);
  renderUnitsTrend(data);
  renderTable(data);
}

// ===== SAMPLE DATA FALLBACK =====
function getSampleData() {
  // Minimal inline fallback
  const raw = `Order ID,Date,Product,Category,Region,Units Sold,Unit Price,Revenue
1001,2024-01-05,Laptop Pro,Electronics,North,12,85000,1020000
1002,2024-02-08,Wireless Headphones,Electronics,South,34,3500,119000
1003,2024-03-12,Office Chair,Furniture,East,8,12000,96000
1004,2024-04-15,Smartwatch,Electronics,West,21,15000,315000
1005,2024-05-18,Running Shoes,Apparel,North,60,4500,270000
1006,2024-06-22,Protein Powder,Health,South,38,2200,83600`;
  return parseCSV(raw);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setupUpload();
  document.getElementById('applyFilters').addEventListener('click', applyFilters);
  document.getElementById('resetFilters').addEventListener('click', resetFilters);
  loadDefaultData();
});
