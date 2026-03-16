/* ============================================================
   MY MONEY TRACKER  —  script.js
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Food','Transport','Rent','Shopping','Entertainment','Healthcare','Education','Utilities','Travel','Other'];
const INCOME_CATEGORIES  = ['Salary','Freelance','Investment','Business','Gift','Other Income'];

const CAT_ICONS = {
  Food:'🍽️', Transport:'🚌', Rent:'🏠', Shopping:'🛍️', Entertainment:'🎬',
  Healthcare:'💊', Education:'📚', Utilities:'💡', Travel:'✈️', Other:'📦',
  Salary:'💼', Freelance:'💻', Investment:'📈', Business:'🏢', Gift:'🎁', 'Other Income':'💰'
};

const CAT_COLORS = {
  Food:'#f87171', Transport:'#60a5fa', Rent:'#a78bfa', Shopping:'#fbbf24',
  Entertainment:'#f472b6', Healthcare:'#34d399', Education:'#38bdf8',
  Utilities:'#fb923c', Travel:'#818cf8', Other:'#94a3b8',
  Salary:'#4ade80', Freelance:'#2dd4bf', Investment:'#86efac',
  Business:'#a3e635', Gift:'#facc15', 'Other Income':'#67e8f9'
};

const LS_KEY = 'mmt_transactions';

// ── STATE ──────────────────────────────────────────────────────
let transactions = [];
let currentType  = 'expense';
let editingId    = null;
let confirmCallback = null;

let dashPieChart = null;
let pieChart     = null;
let barChart     = null;

// ── STORAGE ────────────────────────────────────────────────────
function loadData()  { try { transactions = JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { transactions = []; } }
function saveData()  { localStorage.setItem(LS_KEY, JSON.stringify(transactions)); }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── HELPERS ────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n);
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function monthOf(dateStr) {
  return dateStr ? dateStr.slice(0,7) : '';
}
function icon(cat) { return CAT_ICONS[cat] || '💳'; }

// ── NAVIGATION ────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.dataset.page === page) b.classList.add('active');
  });

  // Render charts when entering their pages
  if (page === 'dashboard') renderDashboard();
  if (page === 'income')       renderIncomePage();
  if (page === 'expenses')     renderExpensePage();
  if (page === 'transactions') renderTransactionsPage();
  if (page === 'charts')       renderChartsPage();

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── DASHBOARD ────────────────────────────────────────────────
function renderDashboard() {
  const income   = transactions.filter(t => t.type === 'income').reduce((s,t)  => s + t.amount, 0);
  const expense  = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance  = income - expense;
  const savings  = income > 0 ? Math.round((balance / income) * 100) : 0;

  document.getElementById('stat-income').textContent       = fmt(income);
  document.getElementById('stat-expense').textContent      = fmt(expense);
  document.getElementById('stat-balance').textContent      = fmt(balance);
  document.getElementById('stat-savings').textContent      = savings + '%';
  document.getElementById('stat-income-count').textContent = transactions.filter(t=>t.type==='income').length + ' entries';
  document.getElementById('stat-expense-count').textContent= transactions.filter(t=>t.type==='expense').length + ' entries';

  // Recent transactions (last 5)
  const recent = [...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const list   = document.getElementById('recentList');
  if (recent.length === 0) {
    list.innerHTML = '<div class="tx-empty">No transactions yet. Add one to get started!</div>';
  } else {
    list.innerHTML = recent.map(t => `
      <div class="tx-item">
        <div class="tx-icon ${t.type}">${icon(t.category)}</div>
        <div class="tx-meta">
          <div class="tx-cat">${t.category}${t.description ? ' · ' + t.description : ''}</div>
          <div class="tx-date">${fmtDate(t.date)}</div>
        </div>
        <div class="tx-amt ${t.type}">${t.type==='income' ? '+' : '-'}${fmt(t.amount)}</div>
      </div>
    `).join('');
  }

  // Pie chart on dashboard
  renderMiniPie(transactions.filter(t => t.type === 'expense'));
}

function renderMiniPie(expenses) {
  const ctx = document.getElementById('dashPieChart');
  if (!ctx) return;

  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category]||0) + t.amount; });
  const labels = Object.keys(catMap);
  const data   = labels.map(l => catMap[l]);
  const colors = labels.map(l => CAT_COLORS[l] || '#94a3b8');

  if (dashPieChart) dashPieChart.destroy();

  if (labels.length === 0) {
    ctx.parentElement.innerHTML = '<div class="tx-empty" style="padding:40px">No expenses yet</div>';
    return;
  }

  dashPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#11141c', borderWidth: 3, hoverOffset: 8 }] },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8892aa', font: { family: 'DM Sans', size: 11 }, padding: 12, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
      },
      cutout: '62%'
    }
  });
}

// ── INCOME PAGE ──────────────────────────────────────────────
function renderIncomePage() {
  const monthFilter = document.getElementById('incomeMonthFilter')?.value || '';
  let rows = transactions.filter(t => t.type === 'income');
  if (monthFilter) rows = rows.filter(t => monthOf(t.date) === monthFilter);
  rows.sort((a,b) => new Date(b.date) - new Date(a.date));

  renderTable('incomeTableWrap', rows, ['Date','Source','Description','Amount','Actions'], t => `
    <td>${fmtDate(t.date)}</td>
    <td><span class="cat-badge">${icon(t.category)} ${t.category}</span></td>
    <td style="color:var(--text2)">${t.description || '—'}</td>
    <td><span class="amt-green">+${fmt(t.amount)}</span></td>
    <td><div class="action-btns">
      <button class="btn-edit" onclick="editTransaction('${t.id}')">Edit</button>
      <button class="btn-del"  onclick="deleteTransaction('${t.id}')">Delete</button>
    </div></td>
  `);
}

// ── EXPENSE PAGE ─────────────────────────────────────────────
function renderExpensePage() {
  const catFilter   = document.getElementById('expCatFilter')?.value || '';
  const monthFilter = document.getElementById('expMonthFilter')?.value || '';
  let rows = transactions.filter(t => t.type === 'expense');
  if (catFilter)   rows = rows.filter(t => t.category === catFilter);
  if (monthFilter) rows = rows.filter(t => monthOf(t.date) === monthFilter);
  rows.sort((a,b) => new Date(b.date) - new Date(a.date));

  renderTable('expenseTableWrap', rows, ['Date','Category','Description','Amount','Actions'], t => `
    <td>${fmtDate(t.date)}</td>
    <td><span class="cat-badge">${icon(t.category)} ${t.category}</span></td>
    <td style="color:var(--text2)">${t.description || '—'}</td>
    <td><span class="amt-red">-${fmt(t.amount)}</span></td>
    <td><div class="action-btns">
      <button class="btn-edit" onclick="editTransaction('${t.id}')">Edit</button>
      <button class="btn-del"  onclick="deleteTransaction('${t.id}')">Delete</button>
    </div></td>
  `);
}

// ── TRANSACTIONS PAGE ────────────────────────────────────────
function renderTransactionsPage() {
  const typeFilter  = document.getElementById('txTypeFilter')?.value || '';
  const monthFilter = document.getElementById('txMonthFilter')?.value || '';
  let rows = [...transactions];
  if (typeFilter)  rows = rows.filter(t => t.type === typeFilter);
  if (monthFilter) rows = rows.filter(t => monthOf(t.date) === monthFilter);
  rows.sort((a,b) => new Date(b.date) - new Date(a.date));

  renderTable('txTableWrap', rows, ['Date','Type','Category','Description','Amount','Actions'], t => `
    <td>${fmtDate(t.date)}</td>
    <td><span class="badge badge-${t.type}">${t.type === 'income' ? '↑' : '↓'} ${t.type}</span></td>
    <td><span class="cat-badge">${icon(t.category)} ${t.category}</span></td>
    <td style="color:var(--text2)">${t.description || '—'}</td>
    <td><span class="${t.type==='income'?'amt-green':'amt-red'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</span></td>
    <td><div class="action-btns">
      <button class="btn-edit" onclick="editTransaction('${t.id}')">Edit</button>
      <button class="btn-del"  onclick="deleteTransaction('${t.id}')">Delete</button>
    </div></td>
  `);
}

// ── TABLE RENDERER ────────────────────────────────────────────
function renderTable(wrapperId, rows, headers, rowFn) {
  const wrap = document.getElementById(wrapperId);
  if (!wrap) return;
  if (rows.length === 0) {
    wrap.innerHTML = `<div class="table-empty"><div class="empty-icon">📭</div>No records found.</div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(t=>`<tr>${rowFn(t)}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

// ── CHARTS PAGE ──────────────────────────────────────────────
function renderChartsPage() {
  renderFullPie();
  renderBarChart();
}

function renderFullPie() {
  const ctx = document.getElementById('pieChart');
  if (!ctx) return;
  const expenses = transactions.filter(t => t.type === 'expense');

  const catMap = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category]||0) + t.amount; });
  const labels = Object.keys(catMap).sort((a,b) => catMap[b] - catMap[a]);
  const data   = labels.map(l => catMap[l]);
  const colors = labels.map(l => CAT_COLORS[l] || '#94a3b8');

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#11141c', borderWidth: 3, hoverOffset: 10 }] },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8892aa', font: { family: 'DM Sans', size: 12 }, padding: 14, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)} (${Math.round(ctx.parsed/data.reduce((a,b)=>a+b,0)*100)}%)` } }
      },
      cutout: '58%'
    }
  });
}

function renderBarChart() {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;

  // Build last 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({ key: d.toISOString().slice(0,7), label: d.toLocaleDateString('en-IN', { month:'short', year:'2-digit' }) });
  }

  const incomeData  = months.map(m => transactions.filter(t => t.type==='income'  && monthOf(t.date)===m.key).reduce((s,t)=>s+t.amount, 0));
  const expenseData = months.map(m => transactions.filter(t => t.type==='expense' && monthOf(t.date)===m.key).reduce((s,t)=>s+t.amount, 0));

  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Income',  data: incomeData,  backgroundColor: 'rgba(74,222,128,0.7)', borderColor: '#4ade80', borderWidth: 1, borderRadius: 6 },
        { label: 'Expense', data: expenseData, backgroundColor: 'rgba(248,113,113,0.7)', borderColor: '#f87171', borderWidth: 1, borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#8892aa', font: { family: 'DM Sans', size: 12 }, padding: 14, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } }
      },
      scales: {
        x: { ticks: { color: '#8892aa', font: { family: 'DM Sans', size: 11 } }, grid: { color: '#1d2230' } },
        y: { ticks: { color: '#8892aa', font: { family: 'DM Sans', size: 11 }, callback: v => '₹'+v.toLocaleString('en-IN') }, grid: { color: '#1d2230' } }
      }
    }
  });
}

// ── MODAL ─────────────────────────────────────────────────────
function openModal(type, id) {
  editingId = id || null;
  const overlay = document.getElementById('modalOverlay');
  const title   = document.getElementById('modalTitle');
  const submitBtn = document.getElementById('submitBtn');

  document.getElementById('txForm').reset();
  document.getElementById('fDate').value = todayISO();
  document.getElementById('formError').classList.add('hidden');

  if (id) {
    // Edit mode
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    currentType = t.type;
    title.textContent = 'Edit Transaction';
    submitBtn.textContent = 'Update';
    document.getElementById('fAmount').value = t.amount;
    document.getElementById('fDesc').value   = t.description || '';
    document.getElementById('fDate').value   = t.date;
    updateTypeTabs(t.type);
    populateCategories(t.type);
    document.getElementById('fCategory').value = t.category;
  } else {
    currentType = type || 'expense';
    title.textContent = 'Add Transaction';
    submitBtn.textContent = currentType === 'income' ? 'Add Income' : 'Add Expense';
    updateTypeTabs(currentType);
    populateCategories(currentType);
  }

  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

function switchType(type) {
  currentType = type;
  updateTypeTabs(type);
  populateCategories(type);
  const btn = document.getElementById('submitBtn');
  btn.textContent = type === 'income' ? 'Add Income' : 'Add Expense';
  btn.classList.toggle('income-mode', type === 'income');
}

function updateTypeTabs(type) {
  document.querySelectorAll('.type-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.type === type);
  });
  const btn = document.getElementById('submitBtn');
  if (btn) btn.classList.toggle('income-mode', type === 'income');
}

function populateCategories(type) {
  const sel  = document.getElementById('fCategory');
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  sel.innerHTML = '<option value="">Select category...</option>' + cats.map(c => `<option value="${c}">${icon(c)} ${c}</option>`).join('');
}

// ── FORM SUBMIT ──────────────────────────────────────────────
function handleFormSubmit(e) {
  e.preventDefault();
  const amount   = parseFloat(document.getElementById('fAmount').value);
  const category = document.getElementById('fCategory').value;
  const desc     = document.getElementById('fDesc').value.trim();
  const date     = document.getElementById('fDate').value;
  const errEl    = document.getElementById('formError');

  if (!amount || amount <= 0) { showFormError('Please enter a valid amount.'); return; }
  if (!category)              { showFormError('Please select a category.'); return; }
  if (!date)                  { showFormError('Please select a date.'); return; }

  errEl.classList.add('hidden');

  if (editingId) {
    const idx = transactions.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      transactions[idx] = { ...transactions[idx], type: currentType, amount, category, description: desc, date };
    }
  } else {
    transactions.push({ id: genId(), type: currentType, amount, category, description: desc, date });
  }

  saveData();
  closeModal();
  refreshCurrentPage();
}

function showFormError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── EDIT / DELETE ────────────────────────────────────────────
function editTransaction(id) {
  openModal(null, id);
}

function deleteTransaction(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  showConfirm(
    'Delete this transaction?',
    `${t.type === 'income' ? '+' : '-'}${fmt(t.amount)} · ${t.category} · ${fmtDate(t.date)}`,
    () => {
      transactions = transactions.filter(x => x.id !== id);
      saveData();
      refreshCurrentPage();
    }
  );
}

function refreshCurrentPage() {
  const active = document.querySelector('.page.active');
  if (active) {
    const id = active.id.replace('page-', '');
    navigate(id);
  }
}

// ── CONFIRM DIALOG ────────────────────────────────────────────
function showConfirm(title, sub, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmSub').textContent   = sub;
  confirmCallback = cb;
  document.getElementById('confirmOverlay').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  confirmCallback = null;
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Card links (View all →)
  document.querySelectorAll('.card-link[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Quick add button
  document.getElementById('quickAddBtn')?.addEventListener('click', () => openModal('expense'));

  // Modal overlay close on backdrop
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('confirmOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeConfirm();
  });

  // Confirm OK
  document.getElementById('confirmOkBtn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
  });

  // Clear all data
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    showConfirm('Clear all data?', 'This will permanently delete all transactions.', () => {
      transactions = [];
      saveData();
      navigate('dashboard');
    });
  });

  // Mobile menu
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  });

  // Keyboard: Escape closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeConfirm(); }
  });

  // Initial render
  navigate('dashboard');
});
