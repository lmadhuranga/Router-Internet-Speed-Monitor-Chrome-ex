const $=id=>document.getElementById(id);
let refreshMs=1000;

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
$("themeBtn").addEventListener("click",toggleTheme);
$("wifiToggleBtn").addEventListener("click",toggleWifiVisibility);
(async()=>{
  const s=await chrome.storage.local.get(["theme","refreshInterval"]); setTheme(RouterCore.sanitizeTheme(s.theme)); refreshMs=RouterCore.sanitizeRefreshInterval(s.refreshInterval);
  await Promise.all([load(),loadDevices()]);
  const loop=async()=>{await Promise.all([load(),loadDevices()]);setTimeout(loop,refreshMs)}; setTimeout(loop,refreshMs);
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
