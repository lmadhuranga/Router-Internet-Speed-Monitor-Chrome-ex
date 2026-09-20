# Router Internet Speed Monitor

A Chrome Manifest V3 extension for monitoring and managing a **Dialog Sri Lanka ZLT P11 Outdoor LTE CPE** directly from the browser.

The project communicates with the router's local web API and provides live internet speed, LTE signal information, Wi-Fi visibility controls, connected-device monitoring, device verification, and router diagnostics.

> Target device used during development:
>
> - **Router:** Dialog Sri Lanka ZLT P11 Outdoor LTE CPE
> - **Software:** 40.8
> - **Configuration:** Sri Lanka Dialog V9.8
> - **Default router address:** `http://192.168.8.1`

---

## Router Used for This Project

![Dialog ZLT P11 Router Kit](docs/images/dialog-zlt-p11-router-kit.jpg)

The project has been developed and tested around the Dialog-branded ZLT P11 outdoor LTE router shown above.

The router normally consists of:

- Outdoor LTE CPE / antenna unit
- Indoor Wi-Fi router
- PoE / power equipment
- Ethernet connection between the outdoor and indoor units

The APIs documented in this repository are firmware-specific and should not automatically be assumed to work with other ZLT models or firmware versions.

---

## Screenshots

### Extension Popup

![Router Monitor Popup](docs/screenshots/router-monitor-popup.png)

The popup provides a compact real-time view of the router and internet connection.

It includes:

- Upload speed
- Download speed
- Signal strength
- Router connection status
- Wi-Fi SSID visibility
- Show / hide Wi-Fi controls
- Manual refresh
- Open Live Monitor
- Open Settings

### Live Monitor / New Tab Page

![Router Monitor Live Monitor](docs/screenshots/router-monitor-live-monitor.png)

The full-page Live Monitor provides a larger dashboard for long-running monitoring.

It includes:

- Live upload and download speed
- Signal information
- Wi-Fi visibility controls
- Router/WAN information
- Connected / leased device list
- Device aliases
- Verified / trusted devices
- New-device detection
- Red warning state for newly detected MAC addresses
- Light / dark theme switching

### Settings Page

![Router Monitor Settings](docs/screenshots/router-monitor-settings.png)

The Settings page is used to configure the extension.

It includes:

- Router address
- Router administrator username
- Router password
- Connection test
- Refresh interval
- Speed display unit
- Theme preference
- New-device monitoring information

---

## Main Features

- Real-time upload and download speed monitoring
- `KB/s` and `Mbps` display modes
- Router RSSI / signal display
- Automatic authentication and retry after session expiry
- Wi-Fi SSID visibility detection
- Hide or show the Wi-Fi SSID
- Full-page Live Monitor
- Configurable light and dark themes
- Connected / DHCP-leased device list
- Device hostname, IP address, MAC address and lease time
- Custom device names stored locally by MAC address
- Mark devices as verified / trusted
- Detect newly observed MAC addresses
- Red `NEW DEVICE` warning state
- Chrome notification for newly detected devices
- Single bell + Chrome notification when the router disconnects or reconnects
- Router LTE/cell diagnostic API discovery
- API documentation
- Importable Postman collection

---

## Connected Device Monitoring

The extension uses the router's verified `CMD 121` API to retrieve the DHCP client list.

A device entry contains:

```text
IP Address
MAC Address
Hostname
Remaining DHCP Lease Time
```

Example:

```text
My Laptop
192.168.8.106
AA:BB:CC:DD:EE:FF
Lease: 23:54:27
```

### Custom Device Names

A device can be renamed locally inside the extension.

For example:

```text
AA:BB:CC:DD:EE:FF
Unknown device
        ↓
Living Room TV
```

The alias is stored locally against the MAC address.

### Device Verification

Devices can be marked as:

```text
VERIFIED / My Device
UNVERIFIED
NEW DEVICE
```

When a MAC address appears for the first time after the initial baseline, the extension marks it in red as a new device.

> Modern phones and laptops can use private/randomized Wi-Fi MAC addresses. A physical device may therefore appear with a different MAC address after privacy settings or network settings change.

---

## LTE / Cell Diagnostics

The router exposes radio diagnostics through `CMD 186`.

The verified request currently includes:

```text
AT+TZEARFCN?
AT+TZBAND?
AT+TZBANDWIDTH?
AT+TZTRANSMODE?
AT+TZRSRP?
AT+TZRSRQ?
AT+TZSINR?
AT+TZTA?
AT+TZTXPOWER?
AT+CEREG?
AT+TZGLBCELLID?
AT+TZPHYCELLID?
```

The response can provide:

- EARFCN
- LTE band
- Bandwidth
- Transmission mode
- RSRP
- RSRQ
- SINR
- Timing Advance
- TX power
- Tracking Area Code
- Global Cell ID / ECI
- eNodeB ID
- Cell / sector ID
- Physical Cell ID / PCI

Example verified values:

```text
EARFCN:            38948
Band:              40
Bandwidth:         100
RSRP:              -104 dBm
RSRQ:              -11 dB
SINR:              4 dB
Global Cell ID:    633601
eNodeB / Cell ID:  2475 / 1
Physical Cell ID:  430
```

Cell/signal history is now collected locally once per minute.

Each sample stores:

```text
timestamp
ISO date/time
local date/time
Global Cell ID / ECI
Global Cell ID in hex
eNodeB ID
sector/cell ID
RSRP signal strength (dBm)
```

The data stays in `chrome.storage.local`; nothing is sent outside the browser/router network. The extension keeps a rolling maximum of 43,200 samples (approximately 30 days at one sample per minute).

---

## Wi-Fi Visibility

The router's `CMD 117` API is used to read and update Wi-Fi configuration.

The verified SSID visibility field is:

```text
macinfo_broadcast = 0  -> SSID visible
macinfo_broadcast = 1  -> SSID hidden
```

The extension first reads the current Wi-Fi configuration and preserves the remaining configuration values before changing the visibility field.

---

## Router Access Rules

The router uses `CMD 23` to save IPv4/IPv6 MAC access rules and `CMD 20` to apply them.

Example rule:

```json
{
  "enableRule": true,
  "enableLink": false,
  "remark": "Example IPv4 rule",
  "ippro": "IPV4",
  "mac": "AA:BB:CC:DD:EE:FF"
}
```

Observed behavior:

```text
enableLink = true   -> connection allowed
enableLink = false  -> connection blocked
```

Rule workflow:

```text
Build complete rule list
        ↓
POST CMD 23
        ↓
Verify success=true
        ↓
POST CMD 20
        ↓
Apply changes
```

---

## Router API Documentation

Detailed notes for the verified router APIs are available here:

```text
docs/router-api.md
```

Current documented commands:

| CMD | Purpose |
|---|---|
| `0` | Router status and WAN counters |
| `100` | Authentication |
| `117` | Wi-Fi configuration / SSID visibility |
| `121` | DHCP client / device list |
| `23` | Save IPv4 / IPv6 MAC access rules |
| `20` | Apply / commit access rules |
| `186` | LTE / cell radio diagnostics |

These APIs were discovered from the router's own web interface and tested against the target Dialog ZLT P11 firmware.

---

## Postman Collection

An importable Postman collection is included:

```text
postman/Dialog-ZLT-P11-Router-API.postman_collection.json
```

Import it in Postman using:

```text
Import
→ File
→ Dialog-ZLT-P11-Router-API.postman_collection.json
```

The collection uses variables such as:

```text
{{baseUrl}}
{{sessionId}}
{{username}}
{{passwordHash}}
{{mac}}
```

Do not commit real credentials or active session information.

---

## Installation

1. Clone the repository.

```bash
git clone https://github.com/lmadhuranga/Router-Internet-Speed-Monitor-Chrome-ex.git
cd Router-Internet-Speed-Monitor-Chrome-ex
```

2. Open Chrome:

```text
chrome://extensions/
```

3. Enable **Developer mode**.

4. Click **Load unpacked**.

5. Select the extension directory containing `manifest.json`.

6. Pin **Router Internet Speed Monitor** to the Chrome toolbar.

---

## Recommended Project Structure

```text
Router-Internet-Speed-Monitor-Chrome-ex/
├── manifest.json
├── background.js
├── core.js
├── storage.js
├── md5.js
│
├── popup.html
├── popup.css
├── popup.js
│
├── monitor.html
├── monitor.css
├── monitor.js
│
├── options.html
├── options.css
├── options.js
│
├── docs/
│   ├── router-api.md
│   │
│   ├── images/
│   │   └── dialog-zlt-p11-router-kit.png
│   │
│   └── screenshots/
│       ├── router-monitor-popup.png
│       ├── router-monitor-live-monitor.png
│       └── router-monitor-settings.png
│
├── postman/
│   └── Dialog-ZLT-P11-Router-API.postman_collection.json
│
├── tests/
│   ├── core.test.js
│   ├── md5.test.js
│   └── storage.test.js
│
└── README.md
```

---

## Screenshot File Names

Use these exact filenames when you capture the application screenshots:

```text
docs/screenshots/router-monitor-popup.png
docs/screenshots/router-monitor-live-monitor.png
docs/screenshots/router-monitor-settings.png
```

Use this filename for the generated router image:

```text
docs/images/dialog-zlt-p11-router-kit.jpg
```

This keeps the README paths stable and avoids needing to edit Markdown each time screenshots are replaced.

---

## Security

Do not commit any of the following:

- Router administrator password
- Password hashes
- Active `sessionId`
- `SessionID` cookies
- Wi-Fi passwords
- IMEI
- IMSI
- ICCID
- Other private router or subscriber identifiers

The extension stores configuration locally in Chrome.

Passwords should not be stored as plaintext.

---

## Compatibility

This project currently targets:

```text
Dialog Sri Lanka
ZLT P11 Outdoor LTE CPE
Software 40.8
Sri Lanka Dialog V9.8
```

Other ZLT routers such as P11H, P11X, or other firmware variants may expose different API commands, response formats, or configuration fields.

---

## Disclaimer

This is an independent monitoring and management project based on behavior observed from a locally administered router.

It is not official Dialog or ZLT software.

Use it only with routers and networks that you are authorized to administer.

---

## Connection Alerts

Router Monitor detects transitions between reachable and unreachable router states.

- **Disconnected:** one bell sound and a red/high-priority Chrome notification.
- **Connected again:** one confirmation bell and a Chrome notification.
- Alerts play only when the state changes; they do **not** repeat on every refresh.
- The initial state after starting/reloading the extension is treated as a baseline and does not trigger a sound.

Manifest V3 uses an offscreen audio document for the bell because the background service worker cannot reliably play audio directly.

---

## Pause / Enable Monitoring

The popup includes a Monitoring control:

- **Pause Monitoring** can pause polling for 1 hour, 8 hours, until tomorrow at 8:00 AM, or indefinitely.
- When paused, the popup shows **Enable Monitoring** so monitoring can always be resumed manually.
- Device scans and router refresh polling are skipped while monitoring is paused.

---

## Paused / Offline Overlay

The popup makes non-running states immediately obvious:

- When **paused**, the dashboard is faded and covered by a `Monitoring paused` overlay with an **Enable Monitoring** button.
- When the router is **offline/unreachable**, the dashboard is faded and covered by a `Router offline` overlay with **Retry Connection** and **Open Settings** actions.
- The extension toolbar badge shows `II` in amber while paused.
- The extension toolbar badge shows `OFF` in red while the router is unreachable.
- When connected again, the normal live-speed badge is restored.

---

## Device Block / Allow Sequence

Router Monitor now manages device access using **IPv4 rules only**.

```text
CMD 23 GET
  ↓
CMD 23 POST — update IPv4 rule
  ↓
wait for successful router response
  ↓
700 ms settle delay
  ↓
CMD 20 POST — apply/commit
  ↓
800 ms settle delay
  ↓
CMD 23 GET — verify IPv4
```

IPv6 rules are left untouched. Existing rules for other devices are preserved when the IPv4 rule list is saved.

---

## Polling Intervals

To reduce unnecessary traffic to the router:

```text
CMD 0   Router/WAN status + speed   every 0.5s or 1s
CMD 121 Connected/DHCP devices      every 30s
```

`CMD 121` refreshes connected-device information every 30 seconds.

The IPv6 request is never sent until the IPv4 CMD 23 POST has returned successfully. Likewise, `CMD 20` is never sent until the IPv6 save has also returned successfully.

### IPv4 unblock behavior

Router Monitor does not create a separate IPv4 `allow` rule when you press **Allow Internet**.

Instead:

```text
Block device
  -> CMD 23 contains an IPV4 rule with enableLink=false

Allow / unblock device
  -> that device's IPV4 rule is removed from CMD 23 datas
  -> CMD 20 applies the updated rule list
  -> CMD 23 GET verifies the IPV4 rule is gone
```

Unblocking removes the IPv4 rule entirely while preserving all unrelated rules.

---

## MAC Blocking Feature Status

The MAC/device block-unblock feature has been removed from the active extension runtime and UI.

The verified CMD 23 / CMD 20 API documentation is intentionally retained under `docs/router-api.md` for possible reuse in a future version.

---

## Current Cell & Signal summary

The Live Monitor shows the latest locally stored LTE mapping in a readable sentence, for example:

```text
Cell ID 633601 is currently mapped to a signal strength of -104 dBm.
Recorded 9/20/2026, 11:24:00 AM
```

The card also shows the eNodeB ID and sector ID. It reads from the locally collected one-minute history and does not create an additional router request.


---

## Floating always-on-top cell HUD

The Live Monitor includes **Float Cell**, which opens the latest cell/signal summary in Chrome's Document Picture-in-Picture window.

The floating HUD shows:

```text
Cell 633601
-104 dBm
GOOD
Updated 9/20/2026, 11:25:00 AM
```

Behavior:

- Always on top of normal application windows using Chrome's Document Picture-in-Picture API.
- Uses the latest locally stored one-minute cell/signal sample.
- Does not add another router polling request.
- Uses `pointer-events:none` inside the HUD so its HTML content itself is non-interactive.
- Opening the floating window requires a user click because Chrome requires a user gesture.
- The floating window closes when its opener context is closed.
- Chrome still owns the outer Picture-in-Picture window. A pure Chrome extension cannot make the operating-system window itself fully mouse-click-through; the browser window frame/surface may still intercept clicks.


### v2.5.1 floating HUD

The floating Chrome Picture-in-Picture HUD now shows the four basic live values:

```text
Cell 633601       -92 dBm
↑ Upload          ↓ Download
121 KB/s          523 KB/s
Cell sample 18s ago
```

The HUD uses a full-bleed dark background to avoid the visible white page area around the previous card. Upload/download and router signal refresh from the normal live monitor status; Cell ID comes from the locally stored one-minute LTE cell history.


### v2.5.2 compact floating HUD

The floating HUD was reduced to a single compact box:

```text
Cell 633601      -92 dBm
↑ 121 KB/s | ↓ 523 KB/s
18s ago
```

Upload and download now share one line with arrows and a vertical separator. The floating window itself was reduced to approximately `230 × 86` CSS pixels to take up less screen space.


### v2.5.3 dark HUD color tuning

The floating HUD now uses softer low-glare text colors instead of bright white on the dark background.

- Primary text: soft blue-gray
- Upload/download text: muted blue-gray
- Signal: softer green
- Timestamp: darker muted gray
- Metric surface: slightly darker to reduce contrast

This keeps the HUD readable in a dark room without the harsh white-on-black effect.


---

## Floating Cell HUD access

The compact always-on-top **Cell / Signal / Traffic HUD** can be opened from the extension UI.

Current floating HUD content:

```text
Cell 633601      -92 dBm
↑ 121 KB/s | ↓ 523 KB/s
18s ago
```

It shows:

- Current LTE Cell ID / ECI from the latest locally stored cell sample.
- Current router signal strength.
- Live upload speed.
- Live download speed.
- Age of the latest cell sample.

The HUD uses Chrome's Document Picture-in-Picture window so it can remain above normal windows while Chrome is running.

The floating window uses a compact dark, low-glare design and does not make an additional router request just to render the HUD.

### Opening the floating HUD

The **Float Cell** control is available from the Router Monitor interface. The same floating control is intended to be accessible from the extension popup so the user does not need to first open the full Live Monitor page.

Chrome requires a user gesture to create a Document Picture-in-Picture window, so the HUD must be opened by clicking the floating button.

### Browser limitation

The content inside the HUD uses `pointer-events: none`, but Chrome owns the outer Picture-in-Picture window. A pure Chrome extension cannot guarantee operating-system-level mouse click-through for the entire native floating window.

### Local cell history

Cell and signal history is collected once per minute using CMD `186` and stored only in `chrome.storage.local`.

Current stored mapping:

```text
timestamp
ISO date/time
local date/time
Global Cell ID / ECI
Global Cell ID hex
eNodeB ID
sector/cell ID
RSRP signal strength
```

The rolling retention limit is 43,200 samples, approximately 30 days at one sample per minute.


### v2.5.4 options floating button

The same **Float Cell** control is now also available from the Options page. It opens the compact always-on-top HUD directly from Options, showing Cell ID, signal, upload and download.


---

## Cell & Signal History dashboard

Router Monitor stores one local LTE sample per minute in `chrome.storage.local` and now provides a dedicated **Cell & Signal History** page.

Each sample includes:

```text
timestamp
Cell ID / ECI
eNodeB ID
sector ID
RSRP signal strength (dBm)
```

The History page provides:

- 1 hour, 6 hour, 24 hour, 7 day and 30 day views
- RSRP-over-time line chart
- different chart color for each Cell ID
- current cell and latest signal
- best signal in the selected range
- average signal
- per-cell sample count
- per-cell average / best / worst RSRP
- last-seen time for every Cell ID
- manual refresh and local-history clear controls

No external service is required. The chart is rendered locally with the browser Canvas API and the history stays inside the extension's local storage.


### v2.6.1 popup Float button

The main Chrome extension popup now contains a **▣ Float** button next to Refresh and Open Monitor.

It launches the same compact floating HUD:

```text
Cell 633601      -92 dBm
↑ 121 KB/s | ↓ 523 KB/s
18s ago
```

The floating HUD uses Document Picture-in-Picture and keeps the same dark, low-glare styling.


### v2.7.0 signal distribution and tower sessions

The Cell & Signal History dashboard now extracts more useful information from the existing one-minute local samples.

For every Cell ID, the dashboard can show exact RSRP-value frequency, for example:

```text
Cell 633601
-99 dBm   -> 18 samples
-100 dBm  -> 41 samples
-101 dBm  -> 27 samples
-102 dBm  -> 9 samples
```

Each exact signal row also keeps its first-recorded and last-recorded timestamps.

The dashboard also estimates daily tower connection sessions:

```text
2026-09-20  Cell 633601
Connections: 4
Approx. time: ~2h 18m
First seen: 07:12
Last seen: 21:44
```

A new connection session is counted when the Cell ID changes, the calendar day changes, or there is a gap of more than 2.5 minutes between samples. Connected time is approximate because sampling happens once per minute.

This makes it possible to analyze later how often a tower was used, how long it was used, and which signal values were most common at different times of day.
