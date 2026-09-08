// ============================================================
// ROUTER MONITOR - popup.js
// ============================================================

let refreshInterval = 1000;
let refreshTimer = null;

let wifiRequestRunning = false;
let wifiInitialized = false;


// ============================================================
// DOM
// ============================================================

const signalValue =
  document.getElementById("signalValue");

const uploadSpeed =
  document.getElementById("uploadSpeed");

const downloadSpeed =
  document.getElementById("downloadSpeed");

const statusDot =
  document.getElementById("statusDot");

const wifiStatus =
  document.getElementById("wifiStatus");

const wifiToggleBtn =
  document.getElementById("wifiToggleBtn");

const refreshBtn =
  document.getElementById("refreshBtn");

const refresh500Btn =
  document.getElementById("refresh500Btn");

const refresh1000Btn =
  document.getElementById("refresh1000Btn");

const errorMessage =
  document.getElementById("errorMessage");


// ============================================================
// SEND MESSAGE TO BACKGROUND
// ============================================================

function sendMessage(message, timeout = 5000) {

  return new Promise((resolve, reject) => {

    let completed = false;

    const timer = setTimeout(() => {

      if (completed) {
        return;
      }

      completed = true;

      reject(
        new Error(
          "Router request timeout"
        )
      );

    }, timeout);


    chrome.runtime.sendMessage(
      message,
      response => {

        if (completed) {
          return;
        }

        completed = true;

        clearTimeout(timer);


        if (chrome.runtime.lastError) {

          reject(
            new Error(
              chrome.runtime.lastError.message
            )
          );

          return;
        }


        if (!response) {

          reject(
            new Error(
              "No response from background"
            )
          );

          return;
        }


        resolve(response);

      }
    );

  });

}


// ============================================================
// ERROR MESSAGE
// ============================================================

function showError(message) {

  if (!errorMessage) {
    return;
  }

  errorMessage.textContent =
    message || "Unknown error";

  errorMessage.classList.remove(
    "hidden"
  );
}


function hideError() {

  if (!errorMessage) {
    return;
  }

  errorMessage.textContent =
    "";

  errorMessage.classList.add(
    "hidden"
  );
}


// ============================================================
// SIGNAL
// ============================================================

function updateSignal(rssi) {

  if (!signalValue) {
    return;
  }


  const value =
    Number(rssi);


  signalValue.classList.remove(
    "signal-good",
    "signal-weak"
  );


  if (!Number.isFinite(value)) {

    signalValue.textContent =
      "-- dBm";

    return;
  }


  signalValue.textContent =
    `${Math.round(value)} dBm`;


  /*
   * RSRP:
   *
   * <= 105 = Green
   * > 105  = Red
   */

  if (
    Math.abs(value) <= 105
  ) {

    signalValue.classList.add(
      "signal-good"
    );

  } else {

    signalValue.classList.add(
      "signal-weak"
    );

  }

}


// ============================================================
// ROUTER STATUS
// ============================================================

function updateRouterStatus(status) {

  if (!statusDot) {
    return;
  }


  statusDot.classList.remove(
    "connected",
    "connecting",
    "error"
  );


  if (
    status === "connected"
  ) {

    statusDot.classList.add(
      "connected"
    );

  } else if (
    status === "connecting" ||
    status === "authenticating"
  ) {

    statusDot.classList.add(
      "connecting"
    );

  } else {

    statusDot.classList.add(
      "error"
    );

  }

}


// ============================================================
// LOAD GENERAL STATUS
// ============================================================

async function loadStatus() {

  try {

    const result =
      await sendMessage(
        {
          type: "getStatus"
        },
        3000
      );


    if (!result) {
      return;
    }


    updateRouterStatus(
      result.status
    );


    if (result.router) {

      updateSignal(
        result.router.rssi
      );

    }


    if (result.speed) {

      const upload =
        Number(
          result.speed.uploadKB
        ) || 0;


      const download =
        Number(
          result.speed.downloadKB
        ) || 0;


      if (uploadSpeed) {

        uploadSpeed.textContent =
          `${Math.round(upload)} KB`;

      }


      if (downloadSpeed) {

        downloadSpeed.textContent =
          `${Math.round(download)} KB`;

      }

    }

  } catch (error) {

    console.error(
      "Status error:",
      error
    );

    updateRouterStatus(
      "error"
    );

  }

}


// ============================================================
// LOAD WIFI VISIBILITY
//
// IMPORTANT:
// This function DOES NOT change the UI to "Checking..."
// during normal refreshes.
//
// Visible / Hidden stays visible while the request runs.
// ============================================================

async function loadWifiVisibility() {

  if (wifiRequestRunning) {
    return;
  }


  wifiRequestRunning =
    true;


  try {

    console.log(
      "Checking Wi-Fi visibility..."
    );


    const result =
      await sendMessage(
        {
          type: "getWifiVisibility"
        },
        5000
      );


    console.log(
      "Wi-Fi visibility response:",
      result
    );


    if (
      !result
    ) {

      throw new Error(
        "Empty Wi-Fi response"
      );

    }


    if (
      result.success === false
    ) {

      throw new Error(
        result.message ||
        "Unable to get Wi-Fi visibility"
      );

    }


    const broadcast =
      String(
        result.broadcast
      );


    /*
     * 0 = Visible
     * 1 = Hidden
     */

    if (
      broadcast === "0"
    ) {

      setWifiVisibleUI();

    } else if (
      broadcast === "1"
    ) {

      setWifiHiddenUI();

    } else {

      throw new Error(
        `Invalid Wi-Fi visibility value: ${broadcast}`
      );

    }


    wifiInitialized =
      true;


  } catch (error) {

    console.error(
      "Wi-Fi visibility error:",
      error
    );


    /*
     * IMPORTANT:
     *
     * Don't disturb an already-working UI.
     *
     * If we already know the state, keep:
     *
     * Visible / Hide Wi-Fi
     *
     * or
     *
     * Hidden / Show Wi-Fi
     */

    if (
      !wifiInitialized
    ) {

      if (wifiStatus) {

        wifiStatus.textContent =
          "Error";

        wifiStatus.classList.remove(
          "wifi-visible",
          "wifi-hidden"
        );

        wifiStatus.classList.add(
          "wifi-error"
        );

      }


      if (wifiToggleBtn) {

        wifiToggleBtn.disabled =
          false;

        wifiToggleBtn.textContent =
          "Retry";

      }


      showError(
        error.message ||
        "Unable to check Wi-Fi visibility"
      );

    }

  } finally {

    wifiRequestRunning =
      false;

  }

}


// ============================================================
// WIFI VISIBLE UI
// ============================================================

function setWifiVisibleUI() {

  if (wifiStatus) {

    wifiStatus.textContent =
      "Visible";


    wifiStatus.classList.remove(
      "wifi-hidden",
      "wifi-error"
    );


    wifiStatus.classList.add(
      "wifi-visible"
    );

  }


  if (wifiToggleBtn) {

    wifiToggleBtn.disabled =
      false;


    wifiToggleBtn.textContent =
      "Hide Wi-Fi";


    wifiToggleBtn.classList.remove(
      "hide-wifi"
    );


    wifiToggleBtn.classList.add(
      "show-wifi"
    );

  }


  hideError();

}


// ============================================================
// WIFI HIDDEN UI
// ============================================================

function setWifiHiddenUI() {

  if (wifiStatus) {

    wifiStatus.textContent =
      "Hidden";


    wifiStatus.classList.remove(
      "wifi-visible",
      "wifi-error"
    );


    wifiStatus.classList.add(
      "wifi-hidden"
    );

  }


  if (wifiToggleBtn) {

    wifiToggleBtn.disabled =
      false;


    wifiToggleBtn.textContent =
      "Show Wi-Fi";


    wifiToggleBtn.classList.remove(
      "show-wifi"
    );


    wifiToggleBtn.classList.add(
      "hide-wifi"
    );

  }


  hideError();

}


// ============================================================
// TOGGLE WIFI
// ============================================================

async function toggleWifi() {

  if (wifiRequestRunning) {
    return;
  }


  wifiRequestRunning =
    true;


  if (wifiToggleBtn) {

    wifiToggleBtn.disabled =
      true;

    /*
     * Don't change the button text to Checking.
     *
     * Use Updating only during the actual
     * visibility change.
     */

    wifiToggleBtn.textContent =
      "Updating...";

  }


  hideError();


  try {

    /*
     * --------------------------------------------------------
     * GET CURRENT STATE
     * --------------------------------------------------------
     */

    const current =
      await sendMessage(
        {
          type: "getWifiVisibility"
        },
        5000
      );


    if (
      !current ||
      current.success === false
    ) {

      throw new Error(
        current?.message ||
        "Unable to read current Wi-Fi state"
      );

    }


    const currentBroadcast =
      String(
        current.broadcast
      );


    let newBroadcast;


    /*
     * Visible -> Hide
     */

    if (
      currentBroadcast === "0"
    ) {

      newBroadcast =
        "1";

    /*
     * Hidden -> Show
     */

    } else if (
      currentBroadcast === "1"
    ) {

      newBroadcast =
        "0";

    } else {

      throw new Error(
        "Invalid current Wi-Fi state"
      );

    }


    console.log(
      "Changing Wi-Fi:",
      currentBroadcast,
      "->",
      newBroadcast
    );


    /*
     * --------------------------------------------------------
     * SEND POST
     * --------------------------------------------------------
     */

    const result =
      await sendMessage(
        {
          type:
            "setWifiVisibility",

          broadcast:
            newBroadcast
        },
        10000
      );


    console.log(
      "Wi-Fi change response:",
      result
    );


    if (
      !result ||
      result.success !== true
    ) {

      throw new Error(
        result?.message ||
        "Wi-Fi visibility change failed"
      );

    }


    /*
     * --------------------------------------------------------
     * USE VERIFIED RESULT
     * --------------------------------------------------------
     */

    if (
      String(result.broadcast) ===
      "1"
    ) {

      setWifiHiddenUI();

    } else {

      setWifiVisibleUI();

    }


    wifiInitialized =
      true;


  } catch (error) {

    console.error(
      "Wi-Fi toggle error:",
      error
    );


    showError(
      error.message ||
      "Wi-Fi update failed"
    );


    /*
     * Restore actual state.
     */

    await loadWifiVisibility();


  } finally {

    wifiRequestRunning =
      false;

  }

}


// ============================================================
// FORCE REFRESH
// ============================================================

async function forceRefresh() {

  try {

    hideError();


    await sendMessage(
      {
        type: "forceRefresh"
      },
      5000
    );


    await loadStatus();


    await loadWifiVisibility();


  } catch (error) {

    console.error(
      "Force refresh error:",
      error
    );


    showError(
      error.message ||
      "Refresh failed"
    );

  }

}


// ============================================================
// REFRESH LOOP
// ============================================================

function startRefreshLoop() {

  if (refreshTimer) {

    clearInterval(
      refreshTimer
    );

  }


  refreshTimer =
    setInterval(
      async () => {

        /*
         * Popup is open.
         *
         * Refresh router information.
         */

        await loadStatus();


        /*
         * Refresh Wi-Fi visibility.
         *
         * IMPORTANT:
         *
         * loadWifiVisibility()
         * does NOT show "Checking..."
         * anymore.
         */

        await loadWifiVisibility();

      },
      refreshInterval
    );

}


// ============================================================
// REFRESH INTERVAL
// ============================================================

function setRefreshInterval(
  interval
) {

  refreshInterval =
    interval;


  if (refresh500Btn) {

    refresh500Btn.classList.remove(
      "active"
    );

  }


  if (refresh1000Btn) {

    refresh1000Btn.classList.remove(
      "active"
    );

  }


  if (
    interval === 500
  ) {

    if (refresh500Btn) {

      refresh500Btn.classList.add(
        "active"
      );

    }

  } else {

    if (refresh1000Btn) {

      refresh1000Btn.classList.add(
        "active"
      );

    }

  }


  startRefreshLoop();

}


// ============================================================
// BUTTON EVENTS
// ============================================================

if (wifiToggleBtn) {

  wifiToggleBtn.addEventListener(
    "click",
    toggleWifi
  );

}


if (refreshBtn) {

  refreshBtn.addEventListener(
    "click",
    forceRefresh
  );

}


if (refresh500Btn) {

  refresh500Btn.addEventListener(
    "click",
    () => {

      setRefreshInterval(
        500
      );

    }
  );

}


if (refresh1000Btn) {

  refresh1000Btn.addEventListener(
    "click",
    () => {

      setRefreshInterval(
        1000
      );

    }
  );

}


// ============================================================
// INITIALIZE
// ============================================================

async function initialize() {

  console.log(
    "Router Monitor popup initialized"
  );


  /*
   * Only on the first load do we show
   * the initial Checking state.
   */

  if (wifiStatus) {

    wifiStatus.textContent =
      "Checking...";

  }


  if (wifiToggleBtn) {

    wifiToggleBtn.disabled =
      true;

    wifiToggleBtn.textContent =
      "Checking...";

  }


  /*
   * Initial router status.
   */

  await loadStatus();


  /*
   * Initial Wi-Fi visibility.
   */

  await loadWifiVisibility();


  /*
   * Start popup-only refresh.
   */

  startRefreshLoop();

}


// ============================================================
// START
// ============================================================

initialize();