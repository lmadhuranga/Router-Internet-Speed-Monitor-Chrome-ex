const $=id=>document.getElementById(id);
let existingHash="";

function setTheme(theme){
  document.body.classList.toggle("light",theme==="light");
  $("themeBtn").textContent=theme==="light"?"☀":"☾";
}
function notice(message,error=false){
  const el=$("notice"); el.textContent=message; el.classList.toggle("error",error); el.classList.remove("hidden");
}
async function ensurePermission(origin){
  const pattern=RouterCore.permissionPattern(origin);
  const has=await chrome.permissions.contains({origins:[pattern]});
  if(has)return true;
  return await chrome.permissions.request({origins:[pattern]});
}
async function save({silent=false}={}){
  try{
    const origin=RouterCore.normalizeRouterOrigin($("routerOrigin").value);
    if(!(await ensurePermission(origin)))throw new Error("Permission to access this router address was not granted.");
    const username=$("routerUsername").value.trim();
    if(!username)throw new Error("Username is required.");
    const pwd=$("routerPassword").value;
    const hash=pwd?RouterMD5.md5(pwd):existingHash||RouterCore.DEFAULT_SETTINGS.routerPasswordHash;
    const data={
      routerOrigin:origin,
      routerUsername:username,
      routerPasswordHash:hash,
      refreshInterval:RouterCore.sanitizeRefreshInterval($("refreshInterval").value),
      theme:RouterCore.sanitizeTheme($("theme").value),
      speedUnit:RouterCore.sanitizeSpeedUnit($("speedUnit").value)
    };
    await chrome.storage.local.set(data);
    existingHash=hash; $("routerPassword").value="";
    await chrome.runtime.sendMessage({type:"settingsChanged"});
    setTheme(data.theme);
    if(!silent)notice("Settings saved successfully.");
    return true;
  }catch(e){notice(e.message,true);return false;}
}
async function load(){
  const s=await chrome.storage.local.get(RouterCore.DEFAULT_SETTINGS);
  $("routerOrigin").value=s.routerOrigin;
  $("routerUsername").value=s.routerUsername;
  $("refreshInterval").value=String(RouterCore.sanitizeRefreshInterval(s.refreshInterval));
  $("theme").value=RouterCore.sanitizeTheme(s.theme);
  $("speedUnit").value=RouterCore.sanitizeSpeedUnit(s.speedUnit);
  existingHash=s.routerPasswordHash||RouterCore.DEFAULT_SETTINGS.routerPasswordHash;
  setTheme($("theme").value);
}
$("saveBtn").addEventListener("click",()=>save());
$("testBtn").addEventListener("click",async()=>{
  $("testBtn").disabled=true;$("testResult").textContent="Testing…";
  const ok=await save({silent:true});
  if(!ok){$("testResult").textContent="Save settings first";$("testBtn").disabled=false;return;}
  try{
    const result=await chrome.runtime.sendMessage({type:"testConnection"});
    $("testResult").textContent=result?.success?"✓ Connected":`✕ ${result?.message||"Connection failed"}`;
  }catch(e){$("testResult").textContent=`✕ ${e.message}`;}
  $("testBtn").disabled=false;
});
$("resetBtn").addEventListener("click",async()=>{
  const d=RouterCore.DEFAULT_SETTINGS;
  await chrome.storage.local.set({...d});
  existingHash=d.routerPasswordHash; await load();
  await chrome.runtime.sendMessage({type:"settingsChanged"});
  notice("Defaults restored.");
});
$("showPassword").addEventListener("click",()=>{
  const input=$("routerPassword"); input.type=input.type==="password"?"text":"password";
  $("showPassword").textContent=input.type==="password"?"Show":"Hide";
});
$("themeBtn").addEventListener("click",()=>{
  const theme=$("theme").value==="light"?"dark":"light"; $("theme").value=theme; setTheme(theme);
});
$("theme").addEventListener("change",()=>setTheme($("theme").value));
load();