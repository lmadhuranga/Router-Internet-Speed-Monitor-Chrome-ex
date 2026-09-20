const $ = id => document.getElementById(id);
let wifiBusy = false;

function send(message, timeout=7000){
  return new Promise((resolve,reject)=>{
    let done=false;
    const timer=setTimeout(()=>{if(!done){done=true;reject(new Error("Request timeout"));}},timeout);
    chrome.runtime.sendMessage(message,response=>{
      if(done)return; done=true; clearTimeout(timer);
      if(chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(response);
    });
  });
}

function setTheme(theme){
  document.body.classList.toggle("light", theme==="light");
  $("themeBtn").textContent = theme==="light" ? "☀" : "☾";
}

async function toggleTheme(){
  const data=await chrome.storage.local.get(["theme"]);
  const theme=data.theme==="light"?"dark":"light";
  await chrome.storage.local.set({theme});
  setTheme(theme);
}

function setStatus(status){
  const dot=$("statusDot"), text=$("statusText");
  dot.className="dot";
  if(status==="connected"){dot.classList.add("connected");text.textContent="Connected";}
  else if(status==="connecting"||status==="authenticating"){dot.classList.add("connecting");text.textContent=status==="authenticating"?"Authenticating":"Connecting";}
  else{dot.classList.add("error");text.textContent=status==="authentication_failed"?"Login Failed":"Offline";}
}

function showError(message){
  $("errorMessage").textContent=message;
  $("errorMessage").classList.remove("hidden");
}
function hideError(){$("errorMessage").classList.add("hidden");}

function applyStatus(result){
  if(!result)return;
  setStatus(result.status);
  const speedUnit = RouterCore.sanitizeSpeedUnit(result.settings?.speedUnit);
  if (speedUnit === "Mbps") {
    $("downloadSpeed").textContent = RouterCore.formatMbps(result.speed?.downloadMbps);
    $("uploadSpeed").textContent = RouterCore.formatMbps(result.speed?.uploadMbps);
  } else {
    $("downloadSpeed").textContent = RouterCore.formatKB(result.speed?.downloadKB);
    $("uploadSpeed").textContent = RouterCore.formatKB(result.speed?.uploadKB);
  }
  $("downloadUnit").textContent = ` ${speedUnit}`;
  $("uploadUnit").textContent = ` ${speedUnit}`;
  $("signalValue").textContent=RouterCore.signalDisplay(result.router?.rssi).text;
  if(result.settings){
    $("routerAddress").textContent=result.settings.routerOrigin.replace(/^https?:\/\//,"");
    $("refreshText").textContent=`Live update: ${result.settings.refreshInterval===500?".5":"1"}s`;
    setTheme(result.settings.theme);
  }
  const visible=result.wifi?.visible;
  $("wifiStatus").textContent=visible?"Visible":"Hidden";
  $("wifiToggleBtn").disabled=false;
  $("wifiToggleBtn").textContent=visible?"Hide Wi-Fi":"Show Wi-Fi";
}

async function load(){
  try{applyStatus(await send({type:"getStatus"},3000));}
  catch(e){setStatus("server_error");showError(e.message);}
}

async function refresh(){
  hideError();
  try{applyStatus(await send({type:"forceRefresh"},7000));}
  catch(e){showError(e.message);}
}

async function toggleWifi(){
  if(wifiBusy)return; wifiBusy=true;
  const btn=$("wifiToggleBtn"); btn.disabled=true; btn.textContent="Updating…";
  try{
    const current=await send({type:"getWifiVisibility"});
    if(!current?.success)throw new Error(current?.message||"Could not read Wi-Fi state");
    const result=await send({type:"setWifiVisibility",broadcast:String(current.broadcast)==="0"?"1":"0"},10000);
    if(!result?.success)throw new Error(result?.message||"Wi-Fi update failed");
    await load(); hideError();
  }catch(e){showError(e.message);}
  finally{wifiBusy=false;btn.disabled=false;}
}

$("themeBtn").addEventListener("click",toggleTheme);
$("settingsBtn").addEventListener("click",()=>chrome.runtime.openOptionsPage());
$("refreshBtn").addEventListener("click",refresh);
$("wifiToggleBtn").addEventListener("click",toggleWifi);
$("openMonitorBtn").addEventListener("click",()=>send({type:"openMonitor"}));

(async()=>{
  const s=await chrome.storage.local.get(["theme","refreshInterval"]);
  setTheme(RouterCore.sanitizeTheme(s.theme));
  await load();
  setInterval(load,RouterCore.sanitizeRefreshInterval(s.refreshInterval));
})();

function pauseUntilFromPreset(preset){
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

function formatPauseStatus(state){
  if(!state?.paused) return "Running normally";
  if(state.until === "indefinite") return "Paused until you enable it";
  return `Paused until ${new Date(state.until).toLocaleString()}`;
}

async function refreshPauseControls(){
  const state = await chrome.runtime.sendMessage({type:"getExtensionPauseState"});
  const paused = state?.paused === true;
  const status = document.getElementById("pauseStatus");
  const pauseBtn = document.getElementById("pauseMenuBtn");
  const resumeBtn = document.getElementById("resumeBtn");
  const menu = document.getElementById("pauseMenu");
  if(status) status.textContent = formatPauseStatus(state);
  if(pauseBtn) pauseBtn.classList.toggle("hidden", paused);
  if(resumeBtn) resumeBtn.classList.toggle("hidden", !paused);
  if(menu) menu.classList.add("hidden");
}

document.getElementById("pauseMenuBtn")?.addEventListener("click",()=>{
  document.getElementById("pauseMenu")?.classList.toggle("hidden");
});

document.querySelectorAll("#pauseMenu [data-pause]").forEach(btn=>btn.addEventListener("click",async()=>{
  const until = pauseUntilFromPreset(btn.dataset.pause);
  await chrome.runtime.sendMessage({type:"pauseExtension",until});
  await refreshPauseControls();
}));

document.getElementById("resumeBtn")?.addEventListener("click",async()=>{
  await chrome.runtime.sendMessage({type:"resumeExtension"});
  await refreshPauseControls();
});

refreshPauseControls();
