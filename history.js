const $ = id => document.getElementById(id);
let selectedRange = 1440;
let currentHistory = [];
let resizeTimer = null;

function formatDbm(value){
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n)} dBm` : "-- dBm";
}

function formatDateTime(timestamp){
  const n = Number(timestamp);
  return Number.isFinite(n) ? new Date(n).toLocaleString() : "--";
}

function formatShortTime(timestamp, rangeMinutes){
  const d = new Date(Number(timestamp));
  if(rangeMinutes <= 1440){
    return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  }
  return d.toLocaleDateString([], {month:"short", day:"numeric"});
}

function groupByCell(history){
  const map = new Map();

  for(const sample of history){
    const id = String(sample.globalCellId ?? "--");
    const rsrp = Number(sample.rsrpDbm);
    if(!Number.isFinite(rsrp)) continue;

    if(!map.has(id)){
      map.set(id, {
        cellId:id,
        samples:0,
        sum:0,
        best:-Infinity,
        worst:Infinity,
        lastSeen:0
      });
    }

    const row = map.get(id);
    row.samples += 1;
    row.sum += rsrp;
    row.best = Math.max(row.best, rsrp);
    row.worst = Math.min(row.worst, rsrp);
    row.lastSeen = Math.max(row.lastSeen, Number(sample.timestamp) || 0);
  }

  return [...map.values()]
    .map(row => ({...row, average:row.sum / row.samples}))
    .sort((a,b) => b.lastSeen - a.lastSeen);
}

function renderSummary(history){
  $("sampleCount").textContent = `${history.length} ${history.length === 1 ? "sample" : "samples"}`;

  if(!history.length){
    $("currentCell").textContent = "--";
    $("currentCellMeta").textContent = "No data";
    $("latestSignal").textContent = "-- dBm";
    $("latestSignalTime").textContent = "No data";
    $("bestSignal").textContent = "-- dBm";
    $("bestSignalCell").textContent = "No data";
    $("averageSignal").textContent = "-- dBm";
    $("averageSignalMeta").textContent = "No data";
    return;
  }

  const valid = history.filter(s => Number.isFinite(Number(s.rsrpDbm)));
  const latest = history[history.length - 1];
  const latestValid = [...valid].reverse()[0] || latest;
  const best = valid.reduce((a,b) => Number(b.rsrpDbm) > Number(a.rsrpDbm) ? b : a, valid[0]);
  const avg = valid.reduce((sum,s) => sum + Number(s.rsrpDbm), 0) / Math.max(1, valid.length);

  $("currentCell").textContent = latest.globalCellId ?? "--";
  $("currentCellMeta").textContent = `Last seen ${formatDateTime(latest.timestamp)}`;
  $("latestSignal").textContent = formatDbm(latestValid.rsrpDbm);
  $("latestSignalTime").textContent = formatDateTime(latestValid.timestamp);
  $("bestSignal").textContent = formatDbm(best?.rsrpDbm);
  $("bestSignalCell").textContent = best ? `Cell ${best.globalCellId ?? "--"}` : "No data";
  $("averageSignal").textContent = formatDbm(avg);
  $("averageSignalMeta").textContent = `${new Set(valid.map(s => String(s.globalCellId))).size} cell(s)`;
}


function signalClass(value){
  const n = Number(value);
  if(!Number.isFinite(n)) return "";
  if(n >= -95) return "signal-strong";
  if(n >= -105) return "signal-mid";
  return "signal-weak";
}

function buildSignalDistribution(history){
  const map = new Map();

  for(const sample of history){
    const cellId = String(sample.globalCellId ?? "--");
    const rsrp = Number(sample.rsrpDbm);
    const timestamp = Number(sample.timestamp);
    if(!Number.isFinite(rsrp) || !Number.isFinite(timestamp)) continue;

    const rounded = Math.round(rsrp);
    const key = `${cellId}|${rounded}`;

    if(!map.has(key)){
      map.set(key,{
        cellId,
        rsrp:rounded,
        count:0,
        firstSeen:timestamp,
        lastSeen:timestamp
      });
    }

    const row = map.get(key);
    row.count += 1;
    row.firstSeen = Math.min(row.firstSeen,timestamp);
    row.lastSeen = Math.max(row.lastSeen,timestamp);
  }

  return [...map.values()].sort((a,b) => {
    if(a.cellId !== b.cellId) return a.cellId.localeCompare(b.cellId, undefined, {numeric:true});
    return b.rsrp - a.rsrp;
  });
}

function renderSignalDistribution(history){
  const rows = buildSignalDistribution(history);
  const body = $("signalDistributionBody");

  if(!rows.length){
    body.innerHTML = '<tr><td colspan="5" class="empty-cell">No data in this range</td></tr>';
    return;
  }

  body.innerHTML = rows.map(row => `
    <tr>
      <td><strong>${row.cellId}</strong></td>
      <td class="${signalClass(row.rsrp)}"><strong>${row.rsrp} dBm</strong></td>
      <td>${row.count}</td>
      <td>${formatDateTime(row.firstSeen)}</td>
      <td>${formatDateTime(row.lastSeen)}</td>
    </tr>
  `).join("");
}

function dateKey(timestamp){
  const d = new Date(Number(timestamp));
  if(Number.isNaN(d.getTime())) return "--";
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function timeOnly(timestamp){
  const d = new Date(Number(timestamp));
  return Number.isNaN(d.getTime())
    ? "--"
    : d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}

function buildTowerSessions(history){
  const valid = history
    .filter(s => Number.isFinite(Number(s.timestamp)) && s.globalCellId !== undefined && s.globalCellId !== null)
    .sort((a,b) => Number(a.timestamp) - Number(b.timestamp));

  const sessions = [];
  let current = null;
  const gapLimitMs = 2.5 * 60 * 1000;

  for(const sample of valid){
    const timestamp = Number(sample.timestamp);
    const cellId = String(sample.globalCellId);
    const day = dateKey(timestamp);

    const mustStartNew = !current ||
      current.cellId !== cellId ||
      current.day !== day ||
      timestamp - current.lastSeen > gapLimitMs;

    if(mustStartNew){
      current = {
        day,
        cellId,
        firstSeen:timestamp,
        lastSeen:timestamp,
        samples:1
      };
      sessions.push(current);
    }else{
      current.lastSeen = timestamp;
      current.samples += 1;
    }
  }

  return sessions;
}

function summarizeTowerSessions(history){
  const sessions = buildTowerSessions(history);
  const map = new Map();

  for(const session of sessions){
    const key = `${session.day}|${session.cellId}`;
    if(!map.has(key)){
      map.set(key,{
        day:session.day,
        cellId:session.cellId,
        connections:0,
        samples:0,
        firstSeen:session.firstSeen,
        lastSeen:session.lastSeen
      });
    }

    const row = map.get(key);
    row.connections += 1;
    row.samples += session.samples;
    row.firstSeen = Math.min(row.firstSeen,session.firstSeen);
    row.lastSeen = Math.max(row.lastSeen,session.lastSeen);
  }

  return [...map.values()].sort((a,b) => {
    if(a.day !== b.day) return b.day.localeCompare(a.day);
    return a.cellId.localeCompare(b.cellId, undefined, {numeric:true});
  });
}

function formatApproxMinutes(samples){
  const mins = Math.max(0, Number(samples) || 0);
  if(mins < 60) return `~${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `~${hours}h ${rest}m` : `~${hours}h`;
}

function renderTowerSessions(history){
  const rows = summarizeTowerSessions(history);
  const body = $("towerSessionsBody");

  if(!rows.length){
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">No data in this range</td></tr>';
    return;
  }

  body.innerHTML = rows.map(row => `
    <tr>
      <td>${row.day}</td>
      <td><strong>${row.cellId}</strong></td>
      <td>${row.connections}</td>
      <td>${formatApproxMinutes(row.samples)}</td>
      <td>${timeOnly(row.firstSeen)}</td>
      <td>${timeOnly(row.lastSeen)}</td>
    </tr>
  `).join("");
}

function renderCellTable(history){
  const rows = groupByCell(history);
  const body = $("cellSummaryBody");

  if(!rows.length){
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">No data in this range</td></tr>';
    return;
  }

  body.innerHTML = rows.map(row => `
    <tr>
      <td><strong>${row.cellId}</strong></td>
      <td>${row.samples}</td>
      <td>${formatDbm(row.average)}</td>
      <td>${formatDbm(row.best)}</td>
      <td>${formatDbm(row.worst)}</td>
      <td>${formatDateTime(row.lastSeen)}</td>
    </tr>
  `).join("");
}

function cellColor(index){
  const palette = [
    "#78c99a","#6eb5e5","#d5a86f","#c29be1",
    "#d98590","#8fc7c2","#b8b26d","#9aa9d8"
  ];
  return palette[index % palette.length];
}

function renderLegend(history){
  const cells = [...new Set(history.map(s => String(s.globalCellId ?? "--")))];
  $("chartLegend").innerHTML = cells.map((cell,index) => `
    <span class="legend-item">
      <span class="legend-dot" style="background:${cellColor(index)}"></span>
      Cell ${cell}
    </span>
  `).join("");
}

function drawChart(history){
  const canvas = $("signalChart");
  const empty = $("emptyChart");
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(320, Math.floor(rect.width));
  const height = 360;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,width,height);

  const valid = history.filter(s =>
    Number.isFinite(Number(s.timestamp)) &&
    Number.isFinite(Number(s.rsrpDbm))
  );

  if(valid.length < 2){
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const pad = {left:50,right:18,top:18,bottom:36};
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const minTime = Number(valid[0].timestamp);
  const maxTime = Number(valid[valid.length-1].timestamp);
  const spanTime = Math.max(1, maxTime - minTime);

  // RSRP-focused scale, expanded only if data exceeds it.
  const values = valid.map(s => Number(s.rsrpDbm));
  const minValue = Math.min(-120, Math.floor(Math.min(...values) / 5) * 5);
  const maxValue = Math.max(-70, Math.ceil(Math.max(...values) / 5) * 5);
  const valueSpan = Math.max(5, maxValue - minValue);

  const x = ts => pad.left + ((Number(ts) - minTime) / spanTime) * plotW;
  const y = value => pad.top + ((maxValue - Number(value)) / valueSpan) * plotH;

  // Grid
  ctx.font = "10px system-ui";
  ctx.lineWidth = 1;
  ctx.textBaseline = "middle";

  for(let i=0;i<=5;i++){
    const value = maxValue - (valueSpan * i / 5);
    const yy = pad.top + plotH * i / 5;
    ctx.strokeStyle = "#1d3042";
    ctx.beginPath();
    ctx.moveTo(pad.left,yy);
    ctx.lineTo(width-pad.right,yy);
    ctx.stroke();

    ctx.fillStyle = "#73889b";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(value)}`, pad.left-8, yy);
  }

  // X labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for(let i=0;i<=4;i++){
    const ts = minTime + spanTime * i / 4;
    const xx = pad.left + plotW * i / 4;
    ctx.fillStyle = "#73889b";
    ctx.fillText(formatShortTime(ts, selectedRange), xx, height-pad.bottom+10);
  }

  // Break lines by cell so switches are visually obvious.
  const cellIds = [...new Set(valid.map(s => String(s.globalCellId ?? "--")))];
  const colorMap = new Map(cellIds.map((id,index) => [id,cellColor(index)]));

  for(let i=1;i<valid.length;i++){
    const a = valid[i-1];
    const b = valid[i];
    const aCell = String(a.globalCellId ?? "--");
    const bCell = String(b.globalCellId ?? "--");

    ctx.strokeStyle = colorMap.get(bCell);
    ctx.lineWidth = aCell === bCell ? 2 : 1;
    if(aCell !== bCell) ctx.setLineDash([4,4]);

    ctx.beginPath();
    ctx.moveTo(x(a.timestamp), y(a.rsrpDbm));
    ctx.lineTo(x(b.timestamp), y(b.rsrpDbm));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Points
  const pointEvery = valid.length > 1200 ? 30 : valid.length > 400 ? 10 : valid.length > 150 ? 4 : 1;
  for(let i=0;i<valid.length;i+=pointEvery){
    const s = valid[i];
    ctx.fillStyle = colorMap.get(String(s.globalCellId ?? "--"));
    ctx.beginPath();
    ctx.arc(x(s.timestamp), y(s.rsrpDbm), 2.2, 0, Math.PI*2);
    ctx.fill();
  }

  // Y-axis label
  ctx.save();
  ctx.translate(14, pad.top + plotH/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillStyle = "#73889b";
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("RSRP (dBm)", 0, 0);
  ctx.restore();
}

function renderAll(history){
  currentHistory = history;
  renderSummary(history);
  renderCellTable(history);
  renderSignalDistribution(history);
  renderTowerSessions(history);
  renderLegend(history);
  drawChart(history);
}

async function loadHistory(){
  try{
    $("error").classList.add("hidden");
    const result = await chrome.runtime.sendMessage({
      type:"getCellSignalHistory",
      limit:selectedRange
    });

    if(!result?.success) throw new Error(result?.message || "Unable to load cell history.");

    const history = Array.isArray(result.history) ? result.history : [];
    renderAll(history);
  }catch(error){
    $("error").textContent = error?.message || "Unable to load history.";
    $("error").classList.remove("hidden");
    renderAll([]);
  }
}

document.querySelectorAll(".range-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    selectedRange = Number(btn.dataset.range) || 1440;
    document.querySelectorAll(".range-btn").forEach(x => x.classList.toggle("active", x === btn));
    await loadHistory();
  });
});

$("refreshBtn").addEventListener("click", loadHistory);

$("clearBtn").addEventListener("click", async () => {
  if(!confirm("Clear all locally stored cell and signal history?")) return;
  await chrome.runtime.sendMessage({type:"clearCellSignalHistory"});
  await loadHistory();
});

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => drawChart(currentHistory), 120);
});

loadHistory();
