# Router Internet Speed Monitor

A lightweight Chrome extension for monitoring router internet statistics directly from the browser.

The extension communicates with a router at `192.168.8.1` and displays real-time connection information including signal strength, upload/download speed, router status, and Wi-Fi SSID visibility.

## Screenshot

![Router Internet Speed Monitor](https://raw.githubusercontent.com/lmadhuranga/router-api/refs/heads/main/screenshot.png)

## Features

- Real-time download speed monitoring
- Real-time upload speed monitoring
- Router signal strength (RSSI/RSRP) display
- Connection status indicator
- Chrome extension badge showing download speed
- Wi-Fi SSID visibility detection
- Hide Wi-Fi SSID
- Show Wi-Fi SSID
- Manual refresh
- Selectable `500ms` / `1000ms` popup refresh interval
- Automatic router authentication when the session expires
- Automatic retry after `NO_AUTH`
- Router communication through a Manifest V3 background service worker
- Dark popup interface

## Project Structure

```text
router-internet-speed-monitor/
├── manifest.json
├── background.js
├── popup.html
├── popup.js
├── popup.css
└── README.md
```

## Installation

1. Clone the repository:

```bash
git clone https://github.com/lmadhuranga/router-api.git
cd router-api
```

2. Open Chrome and navigate to:

```text
chrome://extensions/
```

3. Enable **Developer mode**.

4. Click **Load unpacked**.

5. Select the project directory containing `manifest.json`.

6. Pin **Router Internet Speed Monitor** to the Chrome toolbar.

## Usage

Click the extension icon to open the Router Monitor.

The popup displays:

- Signal strength in `dBm`
- Current upload speed
- Current download speed
- Wi-Fi visibility status
- Router connection status
- Wi-Fi visibility controls
- Manual refresh
- `500ms` / `1000ms` refresh intervals

## Wi-Fi Visibility

The extension can detect whether the router's Wi-Fi SSID is visible or hidden.

```text
broadcast = 0 → Visible
broadcast = 1 → Hidden
```

When Wi-Fi is visible:

```text
Visible
[ Hide Wi-Fi ]
```

When Wi-Fi is hidden:

```text
Hidden
[ Show Wi-Fi ]
```

## Automatic Authentication

If the router session expires, the router may return:

```json
{
  "success": false,
  "cmd": 117,
  "message": "NO_AUTH"
}
```

The extension automatically attempts to authenticate again and retry the original request.

```text
Router Request
      ↓
   NO_AUTH
      ↓
Authenticate
      ↓
Restore Session
      ↓
Retry Request
      ↓
Continue Monitoring
```

## Router API

The extension communicates with:

```text
http://192.168.8.1/cgi-bin/http.cgi
```

Main commands used by the extension:

| Command | Method | Purpose |
|---|---|---|
| `0` | GET | Router information |
| `100` | POST | Authentication |
| `117` | GET | Wi-Fi configuration |
| `117` | POST | Update Wi-Fi configuration |

## Speed Monitoring

Download speed is calculated using changes in WAN RX bytes.

```text
download = (currentRxBytes - previousRxBytes) / elapsedTime
```

Upload speed is calculated using WAN TX bytes.

```text
upload = (currentTxBytes - previousTxBytes) / elapsedTime
```

## Security

Do not commit real router credentials, password hashes, session IDs, or session cookies to a public repository.

## Browser Support

Designed primarily for:

- Google Chrome
- Chromium-based browsers supporting Manifest V3

## Version

`1.1.0`

## Disclaimer

The router API used by this project may be specific to certain router models or firmware versions.

Use this extension only with routers and networks you are authorized to administer.