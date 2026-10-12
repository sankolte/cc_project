// monitor-server/public/app.js
// Live Dashboard UI controller & Chart.js rendering

let latencyChartInstance = null;
let statusChartInstance = null;

// Target application URL (defaulting to port 3000)
const TARGET_APP_BASE = 'http://localhost:3000';

// -------------------------------------------------------------
// 1. CHART INITIALIZATION
// -------------------------------------------------------------
function initCharts() {
  const ctxLatency = document.getElementById('latencyChart').getContext('2d');
  latencyChartInstance = new Chart(ctxLatency, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Observed Latency (ms)',
          data: [],
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3
        },
        {
          label: 'SLA Limit (1500ms)',
          data: [],
          borderColor: 'rgba(239, 68, 68, 0.6)',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } },
          suggestedMax: 2000,
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 11 } }
        }
      }
    }
  });

  const ctxStatus = document.getElementById('statusChart').getContext('2d');
  statusChartInstance = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: ['2xx Success', '5xx Server Error'],
      datasets: [{
        data: [1, 0],
        backgroundColor: ['#10b981', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { size: 11 }, padding: 14 }
        }
      },
      cutout: '70%'
    }
  });
}

// -------------------------------------------------------------
// 2. DASHBOARD DATA REFRESH LOGIC
// -------------------------------------------------------------
async function refreshDashboard() {
  try {
    // 1. Fetch Metrics Summary
    const resStats = await fetch('/api/stats');
    const dataStats = await resStats.json();
    if (dataStats.success) {
      updateHeroStatus(dataStats.data);
      updateKpis(dataStats.data);
    }

    // 2. Fetch Incidents
    const resIncidents = await fetch('/api/incidents?limit=15');
    const dataIncidents = await resIncidents.json();
    if (dataIncidents.success) {
      updateIncidentsTable(dataIncidents.data);
    }

    // 3. Fetch Recent Telemetry Logs & Update Charts
    const resLogs = await fetch('/api/logs?limit=20');
    const dataLogs = await resLogs.json();
    if (dataLogs.success) {
      updateLogsTable(dataLogs.data);
      updateChartsData(dataLogs.data);
    }

    document.getElementById('lastUpdated').textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.warn('Dashboard sync warning:', err.message);
  }
}

function updateHeroStatus(stats) {
  const hero = document.getElementById('heroStatus');
  const icon = document.getElementById('statusIcon');
  const title = document.getElementById('statusTitle');
  const desc = document.getElementById('statusDesc');

  if (stats.status === 'CRITICAL' || stats.activeIncidents > 0) {
    hero.classList.add('critical');
    icon.textContent = '🚨';
    title.textContent = 'CRITICAL ANOMALY DETECTED';
    desc.textContent = `Warning: ${stats.activeIncidents} active incident(s) detected. High latency or server crash thresholds have been breached.`;
  } else {
    hero.classList.remove('critical');
    icon.textContent = '🟢';
    title.textContent = 'SYSTEM HEALTHY';
    desc.textContent = 'All telemetry within normal bounds. Response latency and error rates comply with SLA thresholds.';
  }
}

function updateKpis(stats) {
  document.getElementById('kpiTotal').textContent = stats.totalRequests || 0;
  document.getElementById('kpiLatency').innerHTML = `${stats.avgLatency || 0} <small>ms</small>`;
  document.getElementById('kpiErrorRate').innerHTML = `${stats.errorRate || '0.0'} <small>%</small>`;
  document.getElementById('kpiErrorCount').textContent = `${stats.serverErrors || 0} server crash(es)`;
  document.getElementById('kpiIncidents').textContent = stats.activeIncidents || 0;
}

function updateIncidentsTable(incidents) {
  const tbody = document.getElementById('incidentsTableBody');
  const badge = document.getElementById('incidentCountBadge');
  badge.textContent = `${incidents.length} Detected`;

  if (!incidents || incidents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No incidents detected. System is running cleanly.</td></tr>`;
    return;
  }

  tbody.innerHTML = incidents.map(item => `
    <tr>
      <td><span class="tag-badge ${item.severity === 'CRITICAL' ? 'tag-critical' : 'tag-warning'}">${item.type}</span></td>
      <td><strong>${item.severity}</strong></td>
      <td>${item.endpoint}</td>
      <td style="color: #f87171; font-weight: 700;">${item.observed_value}</td>
      <td>${item.threshold_value}</td>
      <td>${new Date(item.timestamp).toLocaleTimeString()}</td>
    </tr>
  `).join('');
}

function updateLogsTable(logs) {
  const tbody = document.getElementById('logsTableBody');
  if (!logs || logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Awaiting incoming telemetry...</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.slice(0, 10).map(item => `
    <tr>
      <td><strong style="color: #60a5fa">${item.method}</strong></td>
      <td>${item.endpoint}</td>
      <td class="${item.status_code >= 500 ? 'tag-status-5xx' : 'tag-status-2xx'}">${item.status_code}</td>
      <td style="${item.latency_ms > 1500 ? 'color: #f87171; font-weight: 700' : ''}">${item.latency_ms} ms</td>
      <td>${new Date(item.timestamp).toLocaleTimeString()}</td>
    </tr>
  `).join('');
}

function updateChartsData(logs) {
  if (!logs || logs.length === 0) return;

  const reversed = [...logs].reverse();
  const labels = reversed.map(l => new Date(l.timestamp).toLocaleTimeString());
  const latencies = reversed.map(l => l.latency_ms);
  const slaLimits = reversed.map(() => 1500);

  if (latencyChartInstance) {
    latencyChartInstance.data.labels = labels;
    latencyChartInstance.data.datasets[0].data = latencies;
    latencyChartInstance.data.datasets[1].data = slaLimits;
    latencyChartInstance.update();
  }

  // Update Status Doughnut
  const count2xx = logs.filter(l => l.status_code >= 200 && l.status_code < 400).length;
  const count5xx = logs.filter(l => l.status_code >= 500).length;

  if (statusChartInstance) {
    statusChartInstance.data.datasets[0].data = [count2xx, count5xx];
    statusChartInstance.update();
  }
}

// -------------------------------------------------------------
// 3. QUICK LIVE SIMULATION TRIGGERS
// -------------------------------------------------------------
async function triggerSimulation(type) {
  try {
    if (type === 'normal') {
      for (let i = 0; i < 3; i++) {
        fetch(`${TARGET_APP_BASE}/api/products`).catch(() => {});
        fetch(`${TARGET_APP_BASE}/api/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: 1 }) }).catch(() => {});
      }
    } else if (type === 'slow') {
      fetch(`${TARGET_APP_BASE}/api/payment?delay=2200`, { method: 'POST' }).catch(() => {});
    } else if (type === 'error') {
      fetch(`${TARGET_APP_BASE}/api/error`).catch(() => {});
    } else if (type === 'flush') {
      const res = await fetch('/api/flush-archive', { method: 'POST' });
      const data = await res.json();
      alert(`S3 Raw Log Batch Flushed: ${data.result?.count || 0} logs archived.`);
    }
  } catch (err) {
    console.error('Simulation trigger failed:', err);
  }
  setTimeout(refreshDashboard, 600);
}

// Event Listeners
document.getElementById('btnSimNormal').addEventListener('click', () => triggerSimulation('normal'));
document.getElementById('btnSimSlow').addEventListener('click', () => triggerSimulation('slow'));
document.getElementById('btnSimError').addEventListener('click', () => triggerSimulation('error'));
document.getElementById('btnFlushS3').addEventListener('click', () => triggerSimulation('flush'));

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  initCharts();
  refreshDashboard();
  // Poll every 2 seconds
  setInterval(refreshDashboard, 2000);
});
