// NetworkTool — Frontend Logic
const { invoke } = window.__TAURI__.core;

const portListEl = document.getElementById("port-list");
const emptyStateEl = document.getElementById("empty-state");
const filterEmptyEl = document.getElementById("filter-empty");
const filterEmptyMsg = document.getElementById("filter-empty-msg");
const filterInput = document.getElementById("filter-input");
const refreshBtn = document.getElementById("refresh-btn");
const clearFilterBtn = document.getElementById("clear-filter-btn");
const portCountEl = document.getElementById("port-count");
const lastScanEl = document.getElementById("last-scan");
const toastEl = document.getElementById("toast");

let currentData = [];
let lastJson = "";
let filterQuery = "";
let killTimers = {};
let toastTimeout = null;
let refreshInterval = null;

// ── Scan & Render ──

async function scanPorts() {
  try {
    const entries = await invoke("scan_ports");
    const json = JSON.stringify(entries);
    if (json === lastJson) return; // no change
    lastJson = json;
    currentData = entries;
    render();
    updateStatus();
  } catch (e) {
    console.error("Scan failed:", e);
  }
}

function render() {
  const filtered = getFilteredData();

  // Determine which state to show
  if (currentData.length === 0) {
    portListEl.innerHTML = "";
    portListEl.style.display = "none";
    filterEmptyEl.style.display = "none";
    emptyStateEl.style.display = "flex";
    return;
  }

  if (filtered.length === 0 && filterQuery) {
    portListEl.innerHTML = "";
    portListEl.style.display = "none";
    emptyStateEl.style.display = "none";
    filterEmptyMsg.textContent = `No ports match "${filterQuery}"`;
    filterEmptyEl.style.display = "flex";
    return;
  }

  emptyStateEl.style.display = "none";
  filterEmptyEl.style.display = "none";
  portListEl.style.display = "block";

  const html = filtered.map((entry) => {
    const isDev = entry.port >= 1024;
    const tagClass = isDev ? "tag-dev" : "tag-sys";
    const tagLabel = isDev ? "DEV" : "SYS";
    const killId = `kill-${entry.pid}-${entry.port}`;
    const isConfirming = killTimers[killId];

    return `<div class="port-row" data-port="${entry.port}" data-pid="${entry.pid}" data-process="${entry.process_name}">
      <span class="cell-port">:${entry.port}</span>
      <span class="cell-process" title="${escapeHtml(entry.process_name)}">${escapeHtml(entry.process_name)}</span>
      <span class="cell-pid">${entry.pid}</span>
      <span class="cell-address" title="${escapeHtml(entry.address)}">${escapeHtml(entry.address)}</span>
      <span class="cell-type"><span class="tag ${tagClass}">${tagLabel}</span></span>
      <span class="cell-action"><button class="kill-btn${isConfirming ? " confirming" : ""}" id="${killId}" onclick="handleKill(${entry.pid}, '${killId}')">${isConfirming ? "Sure?" : "Kill"}</button></span>
    </div>`;
  }).join("");

  portListEl.innerHTML = html;
}

function getFilteredData() {
  if (!filterQuery) return currentData;
  const q = filterQuery.toLowerCase();
  return currentData.filter((e) =>
    String(e.port).includes(q) ||
    e.process_name.toLowerCase().includes(q) ||
    String(e.pid).includes(q) ||
    e.address.toLowerCase().includes(q)
  );
}

function updateStatus() {
  const count = currentData.length;
  portCountEl.textContent = `${count} port${count !== 1 ? "s" : ""} listening`;
  const now = new Date();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  lastScanEl.textContent = `Last scan: ${time}`;
}

// ── Kill Process ──

window.handleKill = async function (pid, killId) {
  // First click: confirm
  if (!killTimers[killId]) {
    killTimers[killId] = true;
    render();
    setTimeout(() => {
      if (killTimers[killId]) {
        delete killTimers[killId];
        render();
      }
    }, 2000);
    return;
  }

  // Second click: execute
  delete killTimers[killId];
  const btn = document.getElementById(killId);
  if (btn) btn.textContent = "...";

  try {
    const msg = await invoke("kill_process", { pid });
    showToast(msg, "success");
    // Force immediate rescan
    lastJson = "";
    await scanPorts();
  } catch (e) {
    showToast(String(e), "error");
    render();
  }
};

// ── Toast ──

function showToast(message, type) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.className = `toast ${type} visible`;
  const duration = type === "error" ? 3000 : 2000;
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("visible");
  }, duration);
}

// ── Filter ──

let filterDebounce = null;
filterInput.addEventListener("input", () => {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(() => {
    filterQuery = filterInput.value.trim();
    render();
  }, 100);
});

clearFilterBtn.addEventListener("click", () => {
  filterInput.value = "";
  filterQuery = "";
  render();
  filterInput.focus();
});

// ── Refresh Button ──

refreshBtn.addEventListener("click", async () => {
  const icon = refreshBtn.querySelector(".refresh-icon");
  icon.classList.remove("spinning");
  // Force reflow to restart animation
  void icon.offsetWidth;
  icon.classList.add("spinning");
  lastJson = "";
  await scanPorts();
});

// ── Utility ──

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Init ──

async function init() {
  await scanPorts();
  // Start auto-refresh
  refreshInterval = setInterval(scanPorts, 3000);
}

init();
