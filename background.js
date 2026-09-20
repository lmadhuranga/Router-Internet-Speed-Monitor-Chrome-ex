importScripts("core.js", "storage.js", "cell-history.js");

const Core = RouterCore;
const Store = RouterStorage;
const CellHistory = RouterCellHistory;
const storage = chrome.storage.local;

let settings = { ...Core.DEFAULT_SETTINGS };
let sessionId = "";
let routerStatus = "connecting";
let isRefreshing = false;
let isAuthenticating = false;
let isWifiRequestRunning = false;
let refreshTimer = null;
let deviceScanTimer = null;
let lastStableConnectionState = null;
const EXTENSION_PAUSE_ALARM = "router-monitor-resume";
const CELL_HISTORY_ALARM = "router-monitor-cell-history";
const CELL_HISTORY_STORAGE_KEY = "cellSignalHistory";
let extensionPausedUntil = null;

let previousCounters = null;
let previousTimestamp = null;

let speed = { uploadKB: 0, downloadKB: 0, uploadMbps: 0, downloadMbps: 0 };
let router = {
  rssi: "--", wanRxBytes: 0, wanTxBytes: 0, wanRxPackets: 0, wanTxPackets: 0,
  wanIP: "", wanGateway: "", plmn: "", uptime: ""
};

let wifiConfig = {
  ipMacId: "-1", macinfo_mac: "", macinfo_ip: "192.168.8.1", macinfo_wifiOpen: "yes",
  macinfo_broadcast: "0", macinfo_ssid: "", macinfo_rts: "", macinfo_txPower: "",
  macinfo_channel: "auto", macinfo_wifiWorkMode: "", macinfo_security_config: "",
  macinfo_pwd: "", secMode: "", secFile: "", cypher: "", wpa: "", debug: "0",
  groupRekey: "", gmkRekey: "", pskKey: "", chMode: "", pureg: "0", puren: "0",
  rateCtl: "auto", manRate: "", manRetries: ""
};

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function tryParseJSON(text) { try { return JSON.parse(text); } catch { return null; } }

function isSessionInvalid(text) {
  if (!text) return true;
  const lower = String(text).toLowerCase();
  return ["invalid session","session expired","sessionid invalid","invalid sessionid",
    "authentication failed","unauthorized","login required","not login","not logged","no_auth"]
    .some(word => lower.includes(word));
}

function findSessionId(text) {
  const json = tryParseJSON(text);
  if (!json) return null;
  for (const key of ["sessionId","sessionID","SessionID","sid","session"]) {
    if (typeof json[key] === "string" && json[key]) return json[key];
  }
  return null;
}

function getHeaders() {
  return {
    "Accept": "text/plain, */*; q=0.01",
    "Content-Type": "application/json; charset=UTF-8",
    "Origin": settings.routerOrigin,
    "Referer": `${settings.routerOrigin}/mindex.html`,
    "X-Requested-With": "XMLHttpRequest"
  };
}

async function routerRequest(payload, timeoutMs = 5000, allowEmpty = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(Core.apiUrl(settings.routerOrigin), {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text && !allowEmpty) throw new Error("Empty router response");
    return text;
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("Router request timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function authenticate() {
  if (isAuthenticating) {
    for (let i=0; i<50 && isAuthenticating; i++) await sleep(100);
    return routerStatus === "connected";
  }
  isAuthenticating = true;
  routerStatus = "authenticating";
  try {
    for (let attempt=0; attempt<3; attempt++) {
      try {
        const response = await routerRequest({
          cmd: 100, method: "POST", sessionId,
          username: settings.routerUsername,
          passwd: settings.routerPasswordHash,
          language: "EN"
        });
        const json = tryParseJSON(response);
        if (!isSessionInvalid(response) && !(json && json.success === false)) {
          const newSession = findSessionId(response);
          if (newSession) sessionId = newSession;
          routerStatus = "connected";
          return true;
        }
      } catch (_) {}
      await sleep(500);
    }
    routerStatus = "authentication_failed";
    return false;
  } finally {
    isAuthenticating = false;
  }
}

async function routerRequestWithAuth(payload, { allowEmpty = false } = {}) {
  let response = await routerRequest(payload, 5000, allowEmpty);

  // An empty body is a valid success only for commands where the caller
  // explicitly opted into allowEmpty (currently CMD 20).
  if (allowEmpty && response === "") return response;

  if (!isSessionInvalid(response)) return response;
  if (!(await authenticate())) throw new Error("AUTHENTICATION_FAILED");

  payload.sessionId = sessionId;
  response = await routerRequest(payload, 5000, allowEmpty);

  if (allowEmpty && response === "") return response;
  if (isSessionInvalid(response)) throw new Error("SESSION_EXPIRED");
  return response;
}

function updateSpeed() {
  const now = Date.now();
  const current = { rx: Number(router.wanRxBytes), tx: Number(router.wanTxBytes) };
  if (previousCounters && previousTimestamp) {
    speed = Core.calculateSpeed(previousCounters, current, now - previousTimestamp);
  }
  previousCounters = current;
  previousTimestamp = now;
}

function resetSpeed() {
  previousCounters = null;
  previousTimestamp = null;
  speed = { uploadKB: 0, downloadKB: 0, uploadMbps: 0, downloadMbps: 0 };
}

function normalizeRssi(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "--";
  return n > 0 ? -Math.abs(n) : n;
}

async function getRouterInformation() {
  const response = await routerRequestWithAuth({ cmd: 0, method: "GET", language: "EN", sessionId });
  const data = tryParseJSON(response);
  if (!data || typeof data !== "object") throw new Error("Invalid router JSON response");
  router.rssi = normalizeRssi(data.rssi ?? router.rssi);
  router.wanRxBytes = Number(data.wanRxBytes) || 0;
  router.wanTxBytes = Number(data.wanTxBytes) || 0;
  router.wanRxPackets = Number(data.wanRxPackets) || 0;
  router.wanTxPackets = Number(data.wanTxPackets) || 0;
  router.wanIP = data.wanIP ?? "";
  router.wanGateway = data.wanGateway ?? "";
  router.plmn = data.plmn ?? "";
  router.uptime = data.uptime ?? "";
  updateSpeed();
  updateBadge();
  return data;
}

function parseWifiResponse(responseText) {
  const json = tryParseJSON(responseText);
  if (json && json.success === false) throw new Error(json.message || "Wi-Fi request failed");
  const values = String(responseText).split(",").map(v => v.trim());
  const broadcast = values[4];
  if (broadcast !== "0" && broadcast !== "1") throw new Error("Invalid Wi-Fi visibility response");
  wifiConfig.macinfo_mac = values[0] || wifiConfig.macinfo_mac;
  wifiConfig.macinfo_ip = values[1] || wifiConfig.macinfo_ip;
  wifiConfig.macinfo_wifiOpen = values[2] || wifiConfig.macinfo_wifiOpen;
  wifiConfig.macinfo_ssid = values[3] || wifiConfig.macinfo_ssid;
  wifiConfig.macinfo_broadcast = broadcast;
  wifiConfig.macinfo_channel = values[5] || wifiConfig.macinfo_channel;
  wifiConfig.macinfo_txPower = values[6] || wifiConfig.macinfo_txPower;
  wifiConfig.secMode = values[7] || wifiConfig.secMode;
  wifiConfig.wpa = values[8] || wifiConfig.wpa;
  wifiConfig.secFile = values[9] || wifiConfig.secFile;
  wifiConfig.macinfo_pwd = values[10] || wifiConfig.macinfo_pwd;
  wifiConfig.pskKey = values[10] || wifiConfig.pskKey;
  wifiConfig.cypher = values[11] || wifiConfig.cypher;
  wifiConfig.chMode = values[12] || wifiConfig.chMode;
  wifiConfig.pureg = values[13] || wifiConfig.pureg;
  wifiConfig.puren = values[14] || wifiConfig.puren;
  wifiConfig.macinfo_wifiWorkMode = values[15] || wifiConfig.macinfo_wifiWorkMode;
  wifiConfig.rateCtl = values[16] || wifiConfig.rateCtl;
  wifiConfig.manRate = values[17] || wifiConfig.manRate;
  wifiConfig.manRetries = values[18] || wifiConfig.manRetries;
  return { success: true, visible: broadcast === "0", hidden: broadcast === "1", broadcast, ssid: wifiConfig.macinfo_ssid };
}

async function getWifiVisibility() {
  const response = await routerRequestWithAuth({ cmd: 117, method: "GET", language: "EN", sessionId });
  const result = parseWifiResponse(response);
  updateBadge();
  return result;
}

async function setWifiVisibility(broadcast) {
  broadcast = String(broadcast);
  if (!["0","1"].includes(broadcast)) return { success:false, message:"Invalid broadcast value" };
  if (isWifiRequestRunning) return { success:false, message:"Wi-Fi request already running" };
  isWifiRequestRunning = true;
  try {
    await getWifiVisibility();
    wifiConfig.macinfo_broadcast = broadcast;
    const wifiData = {
      ipMacId:"-1", macinfo_mac:wifiConfig.macinfo_mac, macinfo_ip:wifiConfig.macinfo_ip,
      macinfo_wifiOpen:wifiConfig.macinfo_wifiOpen, macinfo_ssid:wifiConfig.macinfo_ssid,
      macinfo_rts:wifiConfig.macinfo_rts, macinfo_txPower:wifiConfig.macinfo_txPower,
      macinfo_channel:wifiConfig.macinfo_channel, macinfo_wifiWorkMode:wifiConfig.macinfo_wifiWorkMode,
      macinfo_security_config:wifiConfig.macinfo_security_config, macinfo_pwd:wifiConfig.macinfo_pwd,
      macinfo_broadcast:broadcast, cmd:2, method:"POST", secMode:wifiConfig.secMode,
      secFile:wifiConfig.secFile, cypher:wifiConfig.cypher, wpa:wifiConfig.wpa, debug:wifiConfig.debug,
      groupRekey:wifiConfig.groupRekey, gmkRekey:wifiConfig.gmkRekey, pskKey:wifiConfig.pskKey,
      chMode:wifiConfig.chMode, pureg:wifiConfig.pureg, puren:wifiConfig.puren,
      rateCtl:wifiConfig.rateCtl, manRate:wifiConfig.manRate, manRetries:wifiConfig.manRetries
    };
    await routerRequestWithAuth({ cmd:117, method:"POST", datas:[wifiData], language:"EN", sessionId });
    await sleep(500);
    const verified = await getWifiVisibility();
    if (verified.broadcast !== broadcast) {
      return { success:false, message:"Router did not apply the visibility change", ...verified };
    }
    return { success:true, message:broadcast==="1"?"Wi-Fi is now hidden":"Wi-Fi is now visible", ...verified };
  } catch (error) {
    return { success:false, message:error.message || "Wi-Fi visibility request failed" };
  } finally {
    isWifiRequestRunning = false;
  }
}



async function getExtensionPauseState() {
  const data = await storage.get(["extensionPausedUntil"]);
  const value = data.extensionPausedUntil;
  if (value === "indefinite") {
    extensionPausedUntil = "indefinite";
    return { paused: true, until: "indefinite" };
  }

  const until = Number(value);
  if (Number.isFinite(until) && until > Date.now()) {
    extensionPausedUntil = until;
    return { paused: true, until };
  }

  extensionPausedUntil = null;
  await storage.remove(["extensionPausedUntil"]);
  return { paused: false, until: null };
}

async function setExtensionPause(until) {
  if (until === "indefinite") {
    extensionPausedUntil = "indefinite";
    await storage.set({ extensionPausedUntil: "indefinite" });
    await chrome.alarms.clear(EXTENSION_PAUSE_ALARM);
    setPausedBadge();
    return { success: true, paused: true, until: "indefinite" };
  }

  const timestamp = Number(until);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    throw new Error("Invalid pause time");
  }

  extensionPausedUntil = timestamp;
  await storage.set({ extensionPausedUntil: timestamp });
  await chrome.alarms.create(EXTENSION_PAUSE_ALARM, { when: timestamp });
  setPausedBadge();
  return { success: true, paused: true, until: timestamp };
}

async function resumeExtension() {
  extensionPausedUntil = null;
  await storage.remove(["extensionPausedUntil"]);
  await chrome.alarms.clear(EXTENSION_PAUSE_ALARM);
  chrome.action.setBadgeText({text:"..."});
  chrome.action.setBadgeBackgroundColor({color:"#475569"});
  chrome.action.setTitle({title:"Router Monitor — Reconnecting"});
  try { await refreshRouter(); } catch (_) {}
  return { success: true, paused: false, until: null };
}

function isExtensionPaused() {
  if (extensionPausedUntil === "indefinite") return true;
  if (Number.isFinite(extensionPausedUntil) && extensionPausedUntil > Date.now()) return true;
  if (extensionPausedUntil && extensionPausedUntil !== "indefinite") extensionPausedUntil = null;
  return false;
}

function pausedStatusPayload() {
  return {
    status: "paused",
    paused: true,
    pausedUntil: extensionPausedUntil,
    speed: { downloadKB: 0, uploadKB: 0, downloadMbps: 0, uploadMbps: 0 },
    router: null,
    wifi: null,
    settings: { ...settings }
  };
}


async function getCellDiagnostics() {
  const response = await routerRequestWithAuth({
    method: "POST",
    cmd: 186,
    atcmd: [
      "AT+TZRSRP?",
      "AT+TZGLBCELLID?"
    ],
    language: "EN",
    sessionId
  });

  const data = tryParseJSON(response);
  if (!data) throw new Error("Invalid CMD 186 JSON response");
  return CellHistory.parseDiagnosticsResponse(data);
}

async function saveCellSignalSample() {
  if (isExtensionPaused()) return { success:false, skipped:"paused" };
  if (routerStatus !== "connected" || isAuthenticating) {
    return { success:false, skipped:"router_not_connected" };
  }

  const parsed = await getCellDiagnostics();
  const sample = CellHistory.createSample(parsed, Date.now());
  const stored = await storage.get([CELL_HISTORY_STORAGE_KEY]);
  const history = CellHistory.appendHistory(
    stored[CELL_HISTORY_STORAGE_KEY],
    sample
  );

  await storage.set({
    [CELL_HISTORY_STORAGE_KEY]: history,
    latestCellSignalSample: sample
  });

  return { success:true, sample, count:history.length };
}

async function getCellSignalHistory(limit = 1440) {
  const stored = await storage.get([CELL_HISTORY_STORAGE_KEY, "latestCellSignalSample"]);
  const history = Array.isArray(stored[CELL_HISTORY_STORAGE_KEY])
    ? stored[CELL_HISTORY_STORAGE_KEY]
    : [];
  const requested = Math.max(1, Math.min(Number(limit) || 1440, CellHistory.MAX_HISTORY_ENTRIES));

  return {
    success:true,
    latest: stored.latestCellSignalSample || history.at(-1) || null,
    history: history.slice(-requested),
    total: history.length
  };
}

async function clearCellSignalHistory() {
  await storage.remove([CELL_HISTORY_STORAGE_KEY, "latestCellSignalSample"]);
  return { success:true };
}

async function ensureCellHistoryAlarm() {
  const existing = await chrome.alarms.get(CELL_HISTORY_ALARM);
  if (!existing) {
    await chrome.alarms.create(CELL_HISTORY_ALARM, {
      periodInMinutes: 1
    });
  }
}

async function getDeviceRegistry() {
  const data = await storage.get(["deviceRegistry", "deviceBaselineInitialized"]);
  return {
    registry: data.deviceRegistry && typeof data.deviceRegistry === "object" ? data.deviceRegistry : {},
    baselineInitialized: data.deviceBaselineInitialized === true
  };
}

async function saveDeviceRegistry(registry, baselineInitialized = true) {
  await storage.set({ deviceRegistry: registry, deviceBaselineInitialized: baselineInitialized });
}

function normalizeMac(mac) {
  return String(mac || "").trim().toLowerCase();
}

async function notifyNewDevice(device) {
  try {
    await chrome.notifications.create(`router-new-device-${device.mac}`, {
      type: "basic",
      iconUrl: "icon128.png",
      title: "New device connected",
      message: `${device.hostname || "Unknown device"} · ${device.mac}`,
      priority: 2
    });
  } catch (_) {
    // Notification may be unavailable if Chrome has disabled extension notifications.
  }
}


async function getConnectedDevices({ updateRegistry = true, notify = false } = {}) {
  const response = await routerRequestWithAuth({
    cmd: 121,
    method: "GET",
    language: "EN",
    sessionId
  });

  const data = tryParseJSON(response);
  if (!data || data.success !== true || !Array.isArray(data.data)) {
    throw new Error("Invalid connected devices response");
  }

  const { registry, baselineInitialized } = await getDeviceRegistry();
  const now = Date.now();
  let changed = false;

  const devices = data.data.map((row, index) => {
    const mac = normalizeMac(row?.[1]);
    const hostname = String(row?.[2] || "");
    let record = registry[mac];

    if (!record) {
      record = {
        alias: "",
        trusted: false,
        isNew: baselineInitialized,
        firstSeen: now,
        lastSeen: now,
        lastHostname: hostname
      };
      registry[mac] = record;
      changed = true;
    } else {
      record.lastSeen = now;
      if (hostname) record.lastHostname = hostname;
      changed = true;
    }

    return {
      index,
      ip: String(row?.[0] || ""),
      mac,
      hostname,
      displayName: record.alias || hostname || "Unknown device",
      alias: record.alias || "",
      trusted: record.trusted === true,
      isNew: record.isNew === true,
      leaseRemaining: String(row?.[3] || "")
    };
  });

  if (updateRegistry && changed) {
    await saveDeviceRegistry(registry, true);
  } else if (updateRegistry && !baselineInitialized) {
    await saveDeviceRegistry(registry, true);
  }

  if (notify && baselineInitialized) {
    for (const device of devices) {
      if (device.isNew && !device.trusted) {
        const rec = registry[device.mac];
        if (!rec.notifiedAt) {
          rec.notifiedAt = now;
          await notifyNewDevice(device);
          changed = true;
        }
      }
    }
    if (changed) await saveDeviceRegistry(registry, true);
  }

  return {
    success: true,
    devices,
    count: devices.length,
    expiredTime: Number(data.expiredTime) || null
  };
}

async function renameDevice(mac, alias) {
  mac = normalizeMac(mac);
  const { registry, baselineInitialized } = await getDeviceRegistry();
  if (!registry[mac]) {
    registry[mac] = { trusted:false, isNew:false, firstSeen:Date.now(), lastSeen:Date.now(), lastHostname:"" };
  }
  registry[mac].alias = String(alias || "").trim();
  await saveDeviceRegistry(registry, baselineInitialized);
  return { success:true };
}

async function setDeviceTrusted(mac, trusted = true) {
  mac = normalizeMac(mac);
  const { registry, baselineInitialized } = await getDeviceRegistry();
  if (!registry[mac]) {
    registry[mac] = { alias:"", firstSeen:Date.now(), lastSeen:Date.now(), lastHostname:"" };
  }
  registry[mac].trusted = trusted === true;
  registry[mac].isNew = false;
  registry[mac].verifiedAt = trusted ? Date.now() : null;
  registry[mac].unverifiedAt = trusted ? null : Date.now();
  await saveDeviceRegistry(registry, baselineInitialized);
  return { success:true };
}

async function clearDeviceNewFlag(mac) {
  mac = normalizeMac(mac);
  const { registry, baselineInitialized } = await getDeviceRegistry();
  if (registry[mac]) {
    registry[mac].isNew = false;
    await saveDeviceRegistry(registry, baselineInitialized);
  }
  return { success:true };
}

async function scanDevicesForAlerts() {
  if (isExtensionPaused()) return;
  if (routerStatus !== "connected" || isAuthenticating) return;
  try {
    await getConnectedDevices({ updateRegistry:true, notify:true });
  } catch (_) {}
}

function scheduleDeviceScan() {
  if (deviceScanTimer) clearTimeout(deviceScanTimer);
  deviceScanTimer = setTimeout(async () => {
    await scanDevicesForAlerts();
    scheduleDeviceScan();
  }, 30000);
}

function getStatus() {
  if (isExtensionPaused()) return pausedStatusPayload();
  return {
    status: routerStatus,
    speed: { ...speed },
    router: { ...router },
    wifi: {
      visible: wifiConfig.macinfo_broadcast === "0",
      hidden: wifiConfig.macinfo_broadcast === "1",
      broadcast: wifiConfig.macinfo_broadcast,
      ssid: wifiConfig.macinfo_ssid
    },
    settings: {
      routerOrigin: settings.routerOrigin,
      routerUsername: settings.routerUsername,
      refreshInterval: settings.refreshInterval,
      theme: settings.theme,
      speedUnit: settings.speedUnit
    }
  };
}

function updateBadge() {
  const text = `${wifiConfig.macinfo_broadcast === "1" ? "*" : ""}${Math.floor(Number(speed.downloadKB)||0)}`;
  chrome.action.setBadgeText({ text });
  const sig = Core.signalDisplay(router.rssi);
  chrome.action.setBadgeBackgroundColor({ color: sig.quality === "good" ? "#16a34a" : sig.quality === "weak" ? "#b91c1c" : "#475569" });
  chrome.action.setTitle({title:"Router Monitor — Connected"});
}


async function ensureAudioOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");

  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    if (contexts.length) return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play a single audible alert when the router disconnects or reconnects."
    });
  } catch (error) {
    // Ignore "already exists" races; sending the message below will still work.
    if (!String(error?.message || error).toLowerCase().includes("single offscreen")) {
      throw error;
    }
  }
}

async function playConnectionBell(kind) {
  try {
    await ensureAudioOffscreenDocument();
    await chrome.runtime.sendMessage({
      type: "playConnectionBell",
      kind
    });
  } catch (_) {
    // Audio alerts must never break router monitoring.
  }
}

async function showConnectionNotification(connected) {
  try {
    await chrome.notifications.create(
      connected ? "router-monitor-connected" : "router-monitor-disconnected",
      {
        type: "basic",
        iconUrl: "icon128.png",
        title: connected ? "Router connected" : "Router disconnected",
        message: connected
          ? "Connection to the router has been restored."
          : "Router Monitor can no longer reach the router.",
        priority: connected ? 1 : 2
      }
    );
  } catch (_) {}
}

async function updateStableConnectionState(connected) {
  // Do not alert on extension startup. Establish the initial baseline first.
  if (lastStableConnectionState === null) {
    lastStableConnectionState = connected;
    return;
  }

  if (lastStableConnectionState === connected) return;

  lastStableConnectionState = connected;

  await Promise.all([
    playConnectionBell(connected ? "connected" : "disconnected"),
    showConnectionNotification(connected)
  ]);
}

function setPausedBadge() {
  chrome.action.setBadgeText({text:"II"});
  chrome.action.setBadgeBackgroundColor({color:"#d97706"});
  chrome.action.setTitle({title:"Router Monitor — Paused"});
}

function setOfflineBadge() {
  chrome.action.setBadgeText({text:"OFF"});
  chrome.action.setBadgeBackgroundColor({color:"#b91c1c"});
  chrome.action.setTitle({title:"Router Monitor — Offline"});
}

function setErrorBadge() {
  setOfflineBadge();
}

async function refreshRouter() {
  if (isExtensionPaused()) return pausedStatusPayload();
  if (isRefreshing || isAuthenticating) return;
  isRefreshing = true;
  try {
    await getRouterInformation();
    routerStatus = "connected";
    await updateStableConnectionState(true);
  } catch (error) {
    resetSpeed();
    routerStatus = error.message === "AUTHENTICATION_FAILED" ? "authentication_failed" : "server_error";
    setErrorBadge();
    await updateStableConnectionState(false);
  } finally {
    isRefreshing = false;
  }
}

async function testConnection() {
  sessionId = "";
  resetSpeed();
  try {
    const ok = await authenticate();
    if (!ok) return {success:false, message:"Authentication failed. Check username/password."};
    await getRouterInformation();
    return {success:true, message:"Connected successfully.", status:getStatus()};
  } catch (error) {
    return {success:false, message:error.message || "Unable to connect to router."};
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    await refreshRouter();
    scheduleRefresh();
  }, Core.sanitizeRefreshInterval(settings.refreshInterval));
}

async function reloadSettings() {
  settings = await Store.getSettings(storage);
  sessionId = "";
  resetSpeed();
  lastStableConnectionState = null;
  scheduleRefresh();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (["routerOrigin","routerUsername","routerPasswordHash","refreshInterval","theme","speedUnit"].some(k => changes[k])) {
    reloadSettings().then(refreshRouter);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message && message.type) {
      case "getStatus": return getStatus();
      case "forceRefresh": await refreshRouter(); return getStatus();
      case "getWifiVisibility": return await getWifiVisibility();
      case "setWifiVisibility": return await setWifiVisibility(message.broadcast);
      case "getConnectedDevices": return await getConnectedDevices({ updateRegistry:true, notify:false });
      case "getCellSignalHistory": return await getCellSignalHistory(message.limit);
      case "collectCellSignalSample": return await saveCellSignalSample();
      case "clearCellSignalHistory": return await clearCellSignalHistory();
      case "renameDevice": return await renameDevice(message.mac, message.alias);
      case "setDeviceTrusted": return await setDeviceTrusted(message.mac, message.trusted !== false);
      case "clearDeviceNewFlag": return await clearDeviceNewFlag(message.mac);
      case "getExtensionPauseState": return await getExtensionPauseState();
      case "pauseExtension": return await setExtensionPause(message.until);
      case "resumeExtension": return await resumeExtension();
      case "testConnection": return await testConnection();
      case "settingsChanged": await reloadSettings(); await refreshRouter(); return getStatus();
      case "openMonitor":
        await chrome.tabs.create({url: chrome.runtime.getURL("monitor.html")});
        return {success:true};
      default: return {success:false, message:"Unknown message"};
    }
  })().then(sendResponse).catch(error => sendResponse({success:false,message:error.message}));
  return true;
});

(async function start() {
  chrome.action.setBadgeText({text:"0"});
  chrome.action.setBadgeBackgroundColor({color:"#475569"});
  settings = await Store.initializeSettings(storage);
  settings = await Store.getSettings(storage);
  const pauseState = await getExtensionPauseState();
  if (pauseState.paused) setPausedBadge();
  scheduleRefresh();
  scheduleDeviceScan();
  await ensureCellHistoryAlarm();
  await refreshRouter();
  try { await saveCellSignalSample(); } catch (_) {}
})();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === EXTENSION_PAUSE_ALARM) {
    await resumeExtension();
    return;
  }

  if (alarm.name === CELL_HISTORY_ALARM) {
    try { await saveCellSignalSample(); } catch (_) {}
  }
});
