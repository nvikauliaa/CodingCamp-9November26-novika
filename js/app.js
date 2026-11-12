/**
 * Expense Tracker — app.js
 * Vanilla JS · LocalStorage · Chart.js
 */

// ─── Constants ───────────────────────────────────────────────
const STORAGE_KEY = 'expense_tracker_transactions';

const CATEGORY_META = {
  Food:      { icon: '🍔', color: '#f97316' },
  Transport: { icon: '🚌', color: '#3b82f6' },
  Fun:       { icon: '🎉', color: '#a855f7' },
};

// ─── State ───────────────────────────────────────────────────
let transactions = loadTransactions();
let chart = null;

// ─── DOM refs ────────────────────────────────────────────────
const form            = document.getElementById('transaction-form');
const nameInput       = document.getElementById('item-name');
const amountInput     = document.getElementById('amount');
const categorySelect  = document.getElementById('category');
const listEl          = document.getElementById('transaction-list');
const emptyState      = document.getElementById('empty-state');
const chartEmptyState = document.getElementById('chart-empty-state');
const balanceEl       = document.getElementById('total-balance');
const chartCanvas     = document.getElementById('spending-chart');

const errorName     = document.getElementById('error-name');
const errorAmount   = document.getElementById('error-amount');
const errorCategory = document.getElementById('error-category');

// ─── LocalStorage helpers ────────────────────────────────────
function loadTransactions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ─── Validation ──────────────────────────────────────────────
function clearErrors() {
  [nameInput, amountInput, categorySelect].forEach(el => el.classList.remove('input-error'));
  errorName.textContent     = '';
  errorAmount.textContent   = '';
  errorCategory.textContent = '';
}

function validateForm() {
  clearErrors();
  let valid = true;

  const name     = nameInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const category = categorySelect.value;

  if (!name) {
    errorName.textContent = 'Item name is required.';
    nameInput.classList.add('input-error');
    valid = false;
  }

  if (!amountInput.value.trim() || isNaN(amount) || amount <= 0) {
    errorAmount.textContent = 'Enter a valid amount greater than 0.';
    amountInput.classList.add('input-error');
    valid = false;
  }

  if (!category) {
    errorCategory.textContent = 'Please select a category.';
    categorySelect.classList.add('input-error');
    valid = false;
  }

  return valid ? { name, amount, category } : null;
}

// ─── CRUD ────────────────────────────────────────────────────
function addTransaction(name, amount, category) {
  const transaction = {
    id:       crypto.randomUUID(),
    name,
    amount,
    category,
    date:     new Date().toISOString(),
  };
  transactions.push(transaction);
  saveTransactions();
  render();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  render();
}

// ─── Render: Balance ─────────────────────────────────────────
function renderBalance() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  balanceEl.textContent = formatCurrency(total);
}

// ─── Render: Transaction List ────────────────────────────────
function renderList() {
  listEl.innerHTML = '';

  if (transactions.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // Show newest first
  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(t => {
    const meta = CATEGORY_META[t.category] || { icon: '💸', color: '#ccc' };
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.setAttribute('data-category', t.category);
    li.setAttribute('data-id', t.id);

    li.innerHTML = `
      <div class="transaction-info">
        <span class="transaction-name">${escapeHtml(t.name)}</span>
        <span class="transaction-category">${meta.icon} ${t.category}</span>
      </div>
      <div class="transaction-right">
        <span class="transaction-amount">-${formatCurrency(t.amount)}</span>
        <button
          class="btn-delete"
          aria-label="Delete ${escapeHtml(t.name)}"
          data-id="${t.id}"
        >✕</button>
      </div>
    `;

    listEl.appendChild(li);
  });
}

// ─── Render: Chart ───────────────────────────────────────────
function renderChart() {
  // Build totals per category
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach(t => {
    if (totals[t.category] !== undefined) {
      totals[t.category] += t.amount;
    }
  });

  const labels  = Object.keys(totals).filter(k => totals[k] > 0);
  const data    = labels.map(k => parseFloat(totals[k].toFixed(2)));
  const colors  = labels.map(k => CATEGORY_META[k].color);

  const hasData = data.length > 0;
  chartEmptyState.style.display = hasData ? 'none' : 'block';
  chartCanvas.style.display     = hasData ? 'block' : 'none';

  if (!hasData) {
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  if (chart) {
    chart.data.labels            = labels;
    chart.data.datasets[0].data  = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
    return;
  }

  chart = new Chart(chartCanvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor:     '#ffffff',
        borderWidth:     3,
        hoverOffset:     8,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 13, family: "'Segoe UI', system-ui, sans-serif" },
            padding:   16,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const val   = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ─── Master render ───────────────────────────────────────────
function render() {
  renderBalance();
  renderList();
  renderChart();
}

// ─── Utility ─────────────────────────────────────────────────
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Event listeners ─────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  const data = validateForm();
  if (!data) return;

  addTransaction(data.name, data.amount, data.category);

  // Reset form
  form.reset();
  clearErrors();
  nameInput.focus();
});

// Delegate delete clicks on the list
listEl.addEventListener('click', e => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  deleteTransaction(btn.dataset.id);
});

// Clear individual field errors on input
nameInput.addEventListener('input', () => {
  nameInput.classList.remove('input-error');
  errorName.textContent = '';
});
amountInput.addEventListener('input', () => {
  amountInput.classList.remove('input-error');
  errorAmount.textContent = '';
});
categorySelect.addEventListener('change', () => {
  categorySelect.classList.remove('input-error');
  errorCategory.textContent = '';
});

// ─── Init ────────────────────────────────────────────────────
render();
