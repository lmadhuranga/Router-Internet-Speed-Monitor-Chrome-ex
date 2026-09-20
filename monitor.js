const $=id=>document.getElementById(id);
let refreshMs=1000;
const DEVICE_REFRESH_MS=30000;
let cellPipWindow=null;
let latestCellSample=null;
let latestMonitorStatus=null;

function setTheme(theme){
  const normalized = RouterCore.sanitizeTheme(theme);
  document.body.classList.toggle("light", normalized === "light");
  const btn = $("themeBtn");
  if (btn) {
    btn.textContent = normalized === "light" ? "☀" : "☾";
    btn.title = normalized === "light" ? "Switch to dark mode" : "Switch to light mode";
  }
}

async function toggleTheme(){
  const current = await chrome.storage.local.get(["theme"]);
  const next = RouterCore.sanitizeTheme(current.theme) === "light" ? "dark" : "light";
  await chrome.storage.local.set({ theme: next });
  setTheme(next);
}
function showError(msg){$("error").textContent=msg;$("error").classList.remove("hidden");}
function hideError(){$("error").classList.add("hidden");}
function apply(s){
  latestMonitorStatus = s || null;
  const speedUnit = RouterCore.sanitizeSpeedUnit(s?.settings?.speedUnit);
  document.title=RouterCore.buildLiveTitle(s, speedUnit);
  const connected=s?.status==="connected";
  $("statusPill").textContent=connected?"Connected":s?.status==="authenticating"?"Authenticating":"Offline";
  $("statusPill").classList.toggle("connected",connected);
  if (speedUnit === "Mbps") {
    $("download").innerHTML=`${RouterCore.formatMbps(s?.speed?.downloadMbps)} <small>Mbps</small>`;
    $("upload").innerHTML=`${RouterCore.formatMbps(s?.speed?.uploadMbps)} <small>Mbps</small>`;
  } else {
    $("download").innerHTML=`${RouterCore.formatKB(s?.speed?.downloadKB)} <small>KB/s</small>`;
    $("upload").innerHTML=`${RouterCore.formatKB(s?.speed?.uploadKB)} <small>KB/s</small>`;
  }
  const sig=RouterCore.signalDisplay(s?.router?.rssi).value;
  $("signal").innerHTML=`${sig} <small>dBm</small>`;
  const wifiVisible = s?.wifi?.visible;
  $("wifi").textContent=wifiVisible?"Visible":s?.wifi?.hidden?"Hidden":"--";
  if ($("wifiState")) $("wifiState").textContent=wifiVisible?"Visible":"Hidden";
  if ($("wifiToggleBtn")) {
    $("wifiToggleBtn").disabled=false;
    $("wifiToggleBtn").textContent=wifiVisible?"Hide Wi-Fi":"Show Wi-Fi";
  }
  $("origin").textContent=(s?.settings?.routerOrigin||"--").replace(/^https?:\/\//,"");
  $("wanIP").textContent=s?.router?.wanIP||"--";
  $("gateway").textContent=s?.router?.wanGateway||"--";
  $("plmn").textContent=s?.router?.plmn||"--";
  $("uptime").textContent=s?.router?.uptime||"--";
  $("ssid").textContent=s?.wifi?.ssid||"--";
  if(s?.settings){setTheme(s.settings.theme);refreshMs=RouterCore.sanitizeRefreshInterval(s.settings.refreshInterval);}
  updateCellPipContent();
}

async function toggleWifiVisibility(){
  const btn=$("wifiToggleBtn");
  if(!btn)return;
  btn.disabled=true;
  const previous=btn.textContent;
  btn.textContent="Updating…";
  try{
    const current=await chrome.runtime.sendMessage({type:"getWifiVisibility"});
    if(!current?.success) throw new Error(current?.message||"Unable to read Wi-Fi visibility.");
    const target=String(current.broadcast)==="0"?"1":"0";
    const result=await chrome.runtime.sendMessage({type:"setWifiVisibility",broadcast:target});
    if(!result?.success) throw new Error(result?.message||"Unable to update Wi-Fi visibility.");
    await load();
    hideError();
  }catch(e){
    showError(e.message);
    btn.textContent=previous;
  }finally{
    btn.disabled=false;
  }
}


function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}




function renderDevices(result){
  const list=$("devicesList");
  if(!list)return;

  if(!result?.success){
    list.innerHTML='<div class="device-empty">Unable to load devices.</div>';
    $("deviceCount").textContent="0 devices";
    return;
  }

  const devices=Array.isArray(result.devices)?result.devices:[];
  $("deviceCount").textContent=`${devices.length} ${devices.length===1?"device":"devices"}`;

  if(!devices.length){
    list.innerHTML='<div class="device-empty">No leased devices reported.</div>';
    return;
  }

  const rows=devices.map(device=>{
    const name=device.displayName || device.hostname?.trim() || "Unknown device";
    const classes=["device-card"];
    if(device.isNew && !device.trusted) classes.push("device-new");
    else if(device.trusted) classes.push("device-trusted");
    else classes.push("device-unverified");

    const status=device.isNew && !device.trusted
      ? '<span class="device-badge danger">NEW DEVICE</span>'
      : device.trusted
        ? '<span class="device-badge trusted">VERIFIED</span>'
        : '<span class="device-badge warning">UNVERIFIED</span>';

    return `
      <article class="${classes.join(" ")}" data-mac="${escapeHtml(device.mac)}">
        <div class="device-main">
          <div class="device-title-line">
            <strong>${escapeHtml(name)}</strong>
            ${status}
          </div>
          <div class="device-meta">
            <span>${escapeHtml(device.ip || "--")}</span>
            <span class="mac">${escapeHtml(device.mac || "--")}</span>
            <span>Lease ${escapeHtml(device.leaseRemaining || "--")}</span>
          </div>
          ${device.alias ? `<small class="alias-note">Custom name · Router name: ${escapeHtml(device.hostname || "Unknown")}</small>` : ""}
        </div>
        <div class="device-actions">
          <button class="device-btn rename-btn" data-mac="${escapeHtml(device.mac)}" data-name="${escapeHtml(name)}">Rename</button>
          ${device.trusted
            ? `<button class="device-btn verified-btn unverify-btn" data-mac="${escapeHtml(device.mac)}">✓ My device</button>`
            : `<button class="device-btn trust-btn" data-mac="${escapeHtml(device.mac)}">Verify as mine</button>`}
          ${device.isNew && !device.trusted
            ? `<button class="device-btn dismiss-btn" data-mac="${escapeHtml(device.mac)}">Not new</button>`
            : ""}
        </div>
      </article>`;
  }).join("");

  list.innerHTML=rows;

  list.querySelectorAll(".rename-btn").forEach(btn=>btn.addEventListener("click",async()=>{
    const current=btn.dataset.name || "";
    const alias=prompt("Device name",current);
    if(alias===null)return;
    await chrome.runtime.sendMessage({type:"renameDevice",mac:btn.dataset.mac,alias});
    await loadDevices();
  }));

  list.querySelectorAll(".trust-btn").forEach(btn=>btn.addEventListener("click",async()=>{
    await chrome.runtime.sendMessage({type:"setDeviceTrusted",mac:btn.dataset.mac,trusted:true});
    await loadDevices();
  }));

  list.querySelectorAll(".unverify-btn").forEach(btn=>btn.addEventListener("click",async()=>{
    const ok = confirm("Remove verification for this device? It will return to UNVERIFIED.");
    if(!ok) return;
    await chrome.runtime.sendMessage({type:"setDeviceTrusted",mac:btn.dataset.mac,trusted:false});
    await loadDevices();
  }));

  list.querySelectorAll(".dismiss-btn").forEach(btn=>btn.addEventListener("click",async()=>{
    await chrome.runtime.sendMessage({type:"clearDeviceNewFlag",mac:btn.dataset.mac});
    await loadDevices();
  }));
}


function formatSampleTime(sample){
  if(!sample) return "--";
  const timestamp = Number(sample.timestamp);
  if(!Number.isFinite(timestamp)) return sample.localTime || sample.isoTime || "--";
  return new Date(timestamp).toLocaleString();
}

function sampleAgeLabel(sample){
  const timestamp = Number(sample?.timestamp);
  if(!Number.isFinite(timestamp)) return "Latest sample";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if(seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if(minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}


function cellSignalQuality(rsrp){
  const n = Number(rsrp);
  if(!Number.isFinite(n)) return {label:"Unknown", className:"unknown"};
  if(n >= -90) return {label:"Excellent", className:"excellent"};
  if(n >= -100) return {label:"Good", className:"good"};
  if(n >= -110) return {label:"Fair", className:"fair"};
  return {label:"Weak", className:"weak"};
}

function updateCellPipContent(sample=latestCellSample){
  if(!cellPipWindow || cellPipWindow.closed) return;

  const doc = cellPipWindow.document;
  const cell = doc.getElementById("pipCellId");
  const signal = doc.getElementById("pipSignal");
  const traffic = doc.getElementById("pipTraffic");
  const time = doc.getElementById("pipTime");

  if(!cell || !signal || !traffic || !time) return;

  const status = latestMonitorStatus;
  const speedUnit = RouterCore.sanitizeSpeedUnit(status?.settings?.speedUnit);

  let uploadText;
  let downloadText;

  if(speedUnit === "Mbps"){
    uploadText = `${RouterCore.formatMbps(status?.speed?.uploadMbps)} Mbps`;
    downloadText = `${RouterCore.formatMbps(status?.speed?.downloadMbps)} Mbps`;
  }else{
    uploadText = `${RouterCore.formatKB(status?.speed?.uploadKB)} KB/s`;
    downloadText = `${RouterCore.formatKB(status?.speed?.downloadKB)} KB/s`;
  }

  traffic.textContent = `↑ ${uploadText}  |  ↓ ${downloadText}`;

  const routerSignal = RouterCore.signalDisplay(status?.router?.rssi).value;
  signal.textContent = routerSignal === "--" ? "-- dBm" : `${routerSignal} dBm`;

  if(!sample){
    cell.textContent = "Cell --";
    time.textContent = "Waiting for cell sample";
    return;
  }

  cell.textContent = `Cell ${sample.globalCellId ?? "--"}`;
  time.textContent = sampleAgeLabel(sample);
}
function buildCellPipDocument(pipWindow){
  const doc = pipWindow.document;
  doc.title = "Router Monitor";

  const style = doc.createElement("style");
  style.textContent = `
    *{box-sizing:border-box}
    html,body{
      margin:0;
      width:100%;
      height:100%;
      overflow:hidden;
      background:#07111b;
      color:#c6d3df;
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      pointer-events:none;
      user-select:none;
      -webkit-user-select:none;
    }
    body{display:block}
    .hud{
      width:100%;
      height:100%;
      display:flex;
      flex-direction:column;
      justify-content:center;
      gap:5px;
      padding:8px 10px;
      background:#07111b;
    }
    .row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      min-width:0;
    }
    .cell,.signal{
      font-size:12px;
      font-weight:850;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .signal{color:#78c99a}
    .traffic{
      font-size:11px;
      font-weight:800;
      color:#b9c8d6;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .time{
      color:#7f93a6;
      font-size:9px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
  `;
  doc.head.appendChild(style);

  const hud = doc.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="row">
      <div id="pipCellId" class="cell">Cell --</div>
      <div id="pipSignal" class="signal">-- dBm</div>
    </div>
    <div id="pipTraffic" class="traffic">↑ 0 KB/s  |  ↓ 0 KB/s</div>
    <div id="pipTime" class="time">Waiting for cell sample</div>
  `;
  doc.body.appendChild(hud);
}
async function openCellFloatingWindow(){
  const btn = $("floatCellBtn");
  if(!btn) return;

  if(!("documentPictureInPicture" in window)){
    showError("Always-on-top floating window requires Chrome 116 or later.");
    return;
  }

  if(documentPictureInPicture.window){
    documentPictureInPicture.window.focus();
    cellPipWindow = documentPictureInPicture.window;
    updateCellPipContent();
    return;
  }

  const previous = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Opening…";

  try{
    const pipWindow = await documentPictureInPicture.requestWindow({
      width: 230,
      height: 86,
      disallowReturnToOpener: true,
      preferInitialWindowPlacement: false
    });

    cellPipWindow = pipWindow;
    buildCellPipDocument(pipWindow);
    updateCellPipContent();

    pipWindow.addEventListener("pagehide",()=>{
      cellPipWindow = null;
      if(btn){
        btn.disabled = false;
        btn.textContent = "▣ Float Cell";
      }
    },{once:true});

    hideError();
  }catch(error){
    showError(error?.message || "Unable to open floating cell window.");
  }finally{
    if(!cellPipWindow && btn){
      btn.disabled = false;
      btn.textContent = previous;
    }else if(btn){
      btn.disabled = false;
      btn.textContent = "▣ Floating";
    }
  }
}

function renderCellSignalSummary(result){
  const sample = result?.latest || null;
  latestCellSample = sample;
  updateCellPipContent(sample);

  if(!sample){
    $("currentCellId").textContent = "--";
    $("currentCellSignal").innerHTML = `-- <small>dBm</small>`;
    $("currentENodeB").textContent = "--";
    $("currentSector").textContent = "--";
    $("cellSignalSentence").textContent = "Waiting for the first cell signal sample.";
    $("cellSignalTime").textContent = "--";
    $("cellSampleAge").textContent = "Waiting for sample…";
    return;
  }

  const cellId = sample.globalCellId ?? "--";
  const rsrp = Number(sample.rsrpDbm);
  const signalText = Number.isFinite(rsrp) ? `${rsrp}` : "--";

  $("currentCellId").textContent = String(cellId);
  $("currentCellSignal").innerHTML = `${signalText} <small>dBm</small>`;
  $("currentENodeB").textContent = sample.eNodeBId ?? "--";
  $("currentSector").textContent = sample.sectorId ?? "--";
  $("cellSignalTime").textContent = `Recorded ${formatSampleTime(sample)}`;
  $("cellSampleAge").textContent = sampleAgeLabel(sample);

  if(Number.isFinite(rsrp) && cellId !== "--"){
    $("cellSignalSentence").textContent =
      `Cell ID ${cellId} is currently mapped to a signal strength of ${rsrp} dBm.`;
  }else{
    $("cellSignalSentence").textContent =
      `Latest recorded cell ID: ${cellId}.`;
  }
}

async function loadCellSignalSummary(){
  try{
    const result = await chrome.runtime.sendMessage({
      type:"getCellSignalHistory",
      limit:1
    });
    renderCellSignalSummary(result);
  }catch(_){
    renderCellSignalSummary(null);
  }
}

async function loadDevices(){
  try{
    const result=await chrome.runtime.sendMessage({type:"getConnectedDevices"});
    renderDevices(result);
  }catch(_){
    renderDevices({success:false,devices:[]});
  }
}

async function load(){
  try{
    const s=await chrome.runtime.sendMessage({type:"getStatus"});
    apply(s); hideError();
  }catch(e){document.title="● Offline | Router Monitor";showError(e.message);}
}
$("settingsBtn").addEventListener("click",()=>chrome.runtime.openOptionsPage());
$("floatCellBtn")?.addEventListener("click",openCellFloatingWindow);
$("historyBtn")?.addEventListener("click",()=>chrome.tabs.create({url:chrome.runtime.getURL("history.html")}));
$("themeBtn").addEventListener("click",toggleTheme);
$("wifiToggleBtn").addEventListener("click",toggleWifiVisibility);
(async()=>{
  const s=await chrome.storage.local.get(["theme","refreshInterval"]);
  setTheme(RouterCore.sanitizeTheme(s.theme));
  refreshMs=RouterCore.sanitizeRefreshInterval(s.refreshInterval);

  // Initial load.
  await Promise.all([load(),loadDevices(),loadCellSignalSummary()]);

  // Fast loop: router status / speed only.
  const statusLoop=async()=>{
    await load();
    setTimeout(statusLoop,refreshMs);
  };
  setTimeout(statusLoop,refreshMs);

  // Slow loop: DHCP / connected devices only.
  const deviceLoop=async()=>{
    await loadDevices();
    setTimeout(deviceLoop,DEVICE_REFRESH_MS);
  };
  setTimeout(deviceLoop,DEVICE_REFRESH_MS);

  // Local-only summary refresh. This does not send a router request.
  const cellSummaryLoop=async()=>{
    await loadCellSignalSummary();
    setTimeout(cellSummaryLoop,DEVICE_REFRESH_MS);
  };
  setTimeout(cellSummaryLoop,DEVICE_REFRESH_MS);
})();

function monitorPauseUntilFromPreset(preset){
  const now = new Date();
  if(preset === "1h") return Date.now() + 60 * 60 * 1000;
  if(preset === "8h") return Date.now() + 8 * 60 * 60 * 1000;
  if(preset === "tomorrow"){
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    t.setHours(8,0,0,0);
    return t.getTime();
  }
  return "indefinite";
}

function monitorPauseText(state){
  if(!state?.paused) return "Running normally";
  if(state.until === "indefinite") return "Paused until you enable it";
  return `Paused until ${new Date(state.until).toLocaleString()}`;
}

async function refreshMonitorPauseControls(){
  const state = await chrome.runtime.sendMessage({type:"getExtensionPauseState"});
  const paused = state?.paused === true;
  $("monitorPauseStatus").textContent = monitorPauseText(state);
  $("pausePanel").classList.toggle("paused", paused);
  $("resumeMonitorBtn").classList.toggle("hidden", !paused);
  $("monitorPauseChoices").classList.toggle("hidden", paused);
  $("pauseMonitorBtn").textContent = paused ? "Paused" : "Pause";
}

document.querySelectorAll("#monitorPauseChoices [data-pause]").forEach(btn=>btn.addEventListener("click",async()=>{
  await chrome.runtime.sendMessage({type:"pauseExtension",until:monitorPauseUntilFromPreset(btn.dataset.pause)});
  await refreshMonitorPauseControls();
}));

$("resumeMonitorBtn")?.addEventListener("click",async()=>{
  await chrome.runtime.sendMessage({type:"resumeExtension"});
  await refreshMonitorPauseControls();
  await load();
});

$("pauseMonitorBtn")?.addEventListener("click",()=>{
  document.getElementById("pausePanel")?.scrollIntoView({behavior:"smooth",block:"start"});
});

refreshMonitorPauseControls();
