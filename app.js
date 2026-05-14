const storageKey = "tsumpace-web-records-v1";

const form = document.querySelector("#recordForm");
const playedAtInput = document.querySelector("#playedAt");
const characterInput = document.querySelector("#character");
const baseCoinsInput = document.querySelector("#baseCoins");
const playMinutesInput = document.querySelector("#playMinutes");
const memoInput = document.querySelector("#memo");
const formNote = document.querySelector("#formNote");
const sampleButton = document.querySelector("#sampleButton");
const exportButton = document.querySelector("#exportButton");
const resetButton = document.querySelector("#resetButton");
const historyBody = document.querySelector("#historyBody");
const rankingList = document.querySelector("#rankingList");
const coinChart = document.querySelector("#coinChart");
const periodButtons = document.querySelectorAll("[data-period]");
const chartTitle = document.querySelector("#chartTitle");

let records = loadRecords();
let currentPeriod = "day";

const sampleCharacters = ["ガストン", "ナミネ", "シンデレラ", "ジェダイルーク", "アナキン"];
const sampleItems = [
  ["+Coin"],
  ["+Coin", "5→4"],
  ["+Coin", "+Time"],
  ["+Coin", "5→4", "+Bomb"],
  []
];

playedAtInput.value = toDateInputValue(new Date());
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const baseCoins = Number(baseCoinsInput.value);
  const character = characterInput.value.trim();

  if (!playedAtInput.value || !character || !Number.isFinite(baseCoins) || baseCoins < 0) {
    showNote("日付、キャラ、素コインを入力してください。");
    return;
  }

  const checkedItems = [...document.querySelectorAll('input[name="item"]:checked')].map((input) => input.value);
  records.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    playedAt: playedAtInput.value,
    character,
    baseCoins,
    playMinutes: Number(playMinutesInput.value || 0),
    items: checkedItems,
    memo: memoInput.value.trim(),
    createdAt: new Date().toISOString()
  });

  saveRecords();
  baseCoinsInput.value = "";
  playMinutesInput.value = "";
  memoInput.value = "";
  showNote("記録しました。");
  render();
});

sampleButton.addEventListener("click", () => {
  addSampleRecords();
  showNote("サンプル記録を追加しました。");
  render();
});

exportButton.addEventListener("click", () => {
  if (records.length === 0) {
    showNote("CSVに出力する記録がありません。");
    return;
  }

  const rows = [
    ["playedAt", "character", "baseCoins", "coinBonusEstimate", "playMinutes", "items", "memo"],
    ...records.map((record) => [
      record.playedAt,
      record.character,
      record.baseCoins,
      Math.round(record.baseCoins * 1.3),
      record.playMinutes || "",
      record.items.join(" / "),
      record.memo || ""
    ])
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tsumpace-records-${toDateInputValue(new Date())}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
});

resetButton.addEventListener("click", () => {
  if (records.length === 0) {
    showNote("削除する記録がありません。");
    return;
  }

  const confirmed = window.confirm("ブラウザ内のTsumPace Web記録をすべて削除しますか？");
  if (!confirmed) return;
  records = [];
  saveRecords();
  showNote("すべて削除しました。");
  render();
});

periodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentPeriod = button.dataset.period;
    periodButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderChart();
  });
});

window.addEventListener("resize", renderChart);

function loadRecords() {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(storageKey, JSON.stringify(records.slice(0, 500)));
}

function render() {
  renderSummary();
  renderHistory();
  renderRanking();
  renderChart();
}

function renderSummary() {
  const today = toDateInputValue(new Date());
  const todayCoins = records
    .filter((record) => record.playedAt === today)
    .reduce((total, record) => total + record.baseCoins, 0);
  const totalCoins = records.reduce((total, record) => total + record.baseCoins, 0);
  const average = records.length ? Math.round(totalCoins / records.length) : 0;
  const best = records.length ? Math.max(...records.map((record) => record.baseCoins)) : 0;

  document.querySelector("#todayCoins").textContent = formatNumber(todayCoins);
  document.querySelector("#totalCount").textContent = formatNumber(records.length);
  document.querySelector("#averageCoins").textContent = formatNumber(average);
  document.querySelector("#bestCoins").textContent = formatNumber(best);
  document.querySelector("#todayMeter").style.width = `${Math.min(100, (todayCoins / 50000) * 100)}%`;
}

function renderHistory() {
  if (records.length === 0) {
    historyBody.innerHTML = `<tr class="empty-row"><td colspan="6">まだ記録がありません。まずはサンプル追加か、今日の記録を入れてみてください。</td></tr>`;
    return;
  }

  historyBody.innerHTML = records.slice(0, 50).map((record) => `
    <tr>
      <td>${record.playedAt}</td>
      <td>${escapeHtml(record.character)}</td>
      <td class="numeric">${formatNumber(record.baseCoins)}</td>
      <td class="numeric">${formatNumber(Math.round(record.baseCoins * 1.3))}</td>
      <td>${record.items.length ? record.items.map(escapeHtml).join(" / ") : "なし"}</td>
      <td>${record.memo ? escapeHtml(record.memo) : ""}</td>
    </tr>
  `).join("");
}

function renderRanking() {
  const grouped = new Map();
  for (const record of records) {
    const current = grouped.get(record.character) || { count: 0, total: 0, best: 0 };
    current.count += 1;
    current.total += record.baseCoins;
    current.best = Math.max(current.best, record.baseCoins);
    grouped.set(record.character, current);
  }

  const ranking = [...grouped.entries()]
    .map(([character, value]) => ({
      character,
      count: value.count,
      average: Math.round(value.total / value.count),
      best: value.best
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);

  if (ranking.length === 0) {
    rankingList.innerHTML = `<li><span class="rank-no">-</span><span class="rank-name">記録待ち</span><span class="rank-value">0</span></li>`;
    return;
  }

  rankingList.innerHTML = ranking.map((item, index) => `
    <li>
      <span class="rank-no">${index + 1}</span>
      <span>
        <span class="rank-name">${escapeHtml(item.character)}</span>
        <span class="rank-meta">${item.count}回 / 最高 ${formatNumber(item.best)}</span>
      </span>
      <span class="rank-value">${formatNumber(item.average)}</span>
    </li>
  `).join("");
}

function renderChart() {
  const context = coinChart.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = coinChart.getBoundingClientRect();
  coinChart.width = Math.max(320, Math.floor(rect.width * ratio));
  coinChart.height = Math.floor(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  context.clearRect(0, 0, width, height);

  const series = buildSeries(currentPeriod);
  chartTitle.textContent = `${periodLabel(currentPeriod)}コイン`;

  const padding = { top: 28, right: 20, bottom: 44, left: 62 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1000, ...series.map((item) => item.value));

  drawGrid(context, padding, chartWidth, chartHeight, maxValue);

  if (series.length === 0) {
    context.fillStyle = "#536473";
    context.font = "700 14px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("記録を追加するとグラフが表示されます", width / 2, height / 2);
    return;
  }

  const barGap = 8;
  const barWidth = Math.max(14, (chartWidth - barGap * (series.length - 1)) / series.length);

  series.forEach((item, index) => {
    const x = padding.left + index * (barWidth + barGap);
    const barHeight = Math.max(3, (item.value / maxValue) * chartHeight);
    const y = padding.top + chartHeight - barHeight;

    context.fillStyle = "#12a6a0";
    roundedRect(context, x, y, barWidth, barHeight, 6);
    context.fill();

    context.fillStyle = "#536473";
    context.font = "700 11px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(item.label, x + barWidth / 2, height - 18);
  });
}

function drawGrid(context, padding, chartWidth, chartHeight, maxValue) {
  context.strokeStyle = "rgba(31, 65, 78, 0.12)";
  context.fillStyle = "#7d8b93";
  context.font = "700 11px system-ui, sans-serif";
  context.textAlign = "right";

  for (let i = 0; i <= 4; i += 1) {
    const value = Math.round((maxValue / 4) * i);
    const y = padding.top + chartHeight - (chartHeight / 4) * i;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + chartWidth, y);
    context.stroke();
    context.fillText(formatCompact(value), padding.left - 10, y + 4);
  }
}

function buildSeries(period) {
  const grouped = new Map();
  for (const record of records) {
    const key = groupKey(record.playedAt, period);
    grouped.set(key, (grouped.get(key) || 0) + record.baseCoins);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-10)
    .map(([key, value]) => ({ label: formatGroupLabel(key, period), value }));
}

function groupKey(dateText, period) {
  const date = new Date(`${dateText}T00:00:00`);
  if (period === "month") return dateText.slice(0, 7);
  if (period === "week") {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    return toDateInputValue(weekStart);
  }
  return dateText;
}

function formatGroupLabel(key, period) {
  if (period === "month") return key.replace("-", "/");
  const [, month, day] = key.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function periodLabel(period) {
  if (period === "week") return "週別";
  if (period === "month") return "月別";
  return "日別";
}

function addSampleRecords() {
  const today = new Date();
  const newRecords = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const character = sampleCharacters[index % sampleCharacters.length];
    const baseCoins = 3200 + Math.round(Math.random() * 5200) + (index % 3) * 800;
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`,
      playedAt: toDateInputValue(date),
      character,
      baseCoins,
      playMinutes: 5 + (index % 4),
      items: sampleItems[index % sampleItems.length],
      memo: index % 4 === 0 ? "調子よさそう" : "",
      createdAt: new Date().toISOString()
    };
  });
  records = [...newRecords, ...records].slice(0, 500);
  saveRecords();
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height);
  context.lineTo(x, y + height);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP").format(value || 0);
}

function formatCompact(value) {
  if (value >= 10000) return `${Math.round(value / 1000) / 10}万`;
  return formatNumber(value);
}

function escapeCsv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showNote(message) {
  formNote.textContent = message;
  window.setTimeout(() => {
    if (formNote.textContent === message) formNote.textContent = "";
  }, 2500);
}
