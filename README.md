# Router Internet Speed Monitor

A lightweight Chrome extension for monitoring router internet statistics directly from the browser.

The extension communicates with a router at `192.168.8.1` and displays real-time connection information including signal strength, upload/download speed, router status, and Wi-Fi SSID visibility.

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

### `manifest.json`

Defines the Chrome extension configuration, permissions, router host access, background service worker, and popup.

### `background.js`

Handles communication with the router, including:

- Router API requests
- Authentication
- Session handling
- Router information retrieval
- Upload/download speed calculation
- Wi-Fi configuration
- Wi-Fi visibility changes
- Chrome badge updates
- Error handling and retries

### `popup.html`

Contains the popup interface for displaying:

- Signal strength
- Upload speed
- Download speed
- Wi-Fi visibility
- Router connection status
- Refresh controls

### `popup.js`

Connects the popup UI with the background service worker.

It periodically requests router information and updates the popup without requiring the extension to be reopened.

### `popup.css`

Provides the dark user interface and styles for:

- Signal status
- Speed cards
- Wi-Fi controls
- Refresh controls
- Connection/error states

## Requirements

- Google Chrome or another Chromium-based browser
- A compatible router accessible at:

```text
http://192.168.8.1
```

- Access to the router's local network
- Valid router authentication credentials

## Installation

This extension is currently intended to be loaded manually as an unpacked Chrome extension.

### 1. Download or clone the project

```bash
git clone <repository-url>
cd router-internet-speed-monitor
```

Or download the project as a ZIP file and extract it.

### 2. Open Chrome Extensions

Open:

```text
chrome://extensions/
```

### 3. Enable Developer Mode

Enable **Developer mode** in the top-right corner.

### 4. Load the extension

Click:

```text
Load unpacked
```

Select the project directory containing `manifest.json`.

The **Router Internet Speed Monitor** extension should now appear in Chrome.

## Usage

Click the extension icon in the Chrome toolbar.

The popup displays the current:

```text
Router Monitor

Signal
-95 dBm

↑ Upload
25 KB

↓ Download
450 KB

Wi-Fi Visibility
Visible

[ Hide Wi-Fi ]

[ Refresh ] [ 500ms ] [ 1000ms ]
```

Values depend on the current router and network activity.

## Speed Monitoring

The extension retrieves the router's WAN RX and TX byte counters.

Download speed is calculated from the difference between consecutive RX values:

```text
download = (currentRxBytes - previousRxBytes) / elapsedTime
```

Upload speed uses the same approach with TX bytes:

```text
upload = (currentTxBytes - previousTxBytes) / elapsedTime
```

The extension calculates both:

```text
KB/s
Mbps
```

The popup currently displays the KB value.

## Signal Strength

Router signal strength is displayed in `dBm`.

The interface uses two visual states:

```text
|RSSI| <= 105  → Good
|RSSI| > 105   → Weak
```

Good signal values are displayed in green and weaker values in red.

## Wi-Fi Visibility

The extension can detect whether the router's Wi-Fi SSID is visible or hidden.

The router configuration uses:

```text
broadcast = 0
```

for a visible SSID and:

```text
broadcast = 1
```

for a hidden SSID.

When Wi-Fi is visible, the popup displays:

```text
Visible

[ Hide Wi-Fi ]
```

When Wi-Fi is hidden:

```text
Hidden

[ Show Wi-Fi ]
```

The extension first reads the current Wi-Fi configuration before modifying the broadcast setting.

## Automatic Authentication

Router sessions can expire while the extension is running.

For example, the router may return:

```json
{
  "success": false,
  "cmd": 117,
  "message": "NO_AUTH"
}
```

The extension detects authentication/session errors including:

```text
NO_AUTH
unauthorized
invalid session
session expired
authentication failed
login required
```

When this happens, the extension automatically performs the following flow:

```text
Router Request
      ↓
   NO_AUTH
      ↓
Authenticate
      ↓
Receive/restore session
      ↓
Retry original request
      ↓
Continue monitoring
```

This prevents the user from having to manually restart the extension when the router session expires.

## Router Commands

The extension currently uses several router commands.

### Router Information

```text
cmd: 0
method: GET
```

Used to retrieve router information such as:

- RSSI
- WAN RX bytes
- WAN TX bytes
- WAN RX packets
- WAN TX packets
- WAN IP
- WAN gateway
- PLMN
- Uptime

### Authentication

```text
cmd: 100
method: POST
```

Used to authenticate with the router when the current session becomes invalid.

### Wi-Fi Information

```text
cmd: 117
method: GET
```

Used to retrieve the current Wi-Fi configuration and SSID visibility.

### Wi-Fi Update

The extension sends the updated Wi-Fi configuration back to the router when changing SSID visibility.

Only the broadcast setting is intentionally changed while the existing Wi-Fi configuration is preserved.

## Refresh Intervals

The popup supports two refresh speeds:

```text
500ms
1000ms
```

The default popup refresh interval is:

```text
1000ms
```

Changing the interval controls how frequently the popup requests updated information while it is open.

## Chrome Badge

The extension also displays the current download speed on the Chrome extension badge.

Example:

```text
245
```

indicates approximately:

```text
245 KB/s
```

When the Wi-Fi SSID is hidden, the badge adds `*` before the value.

Example:

```text
*245
```

The badge color also reflects the router signal condition.

## Configuration

Router configuration is currently located near the beginning of `background.js`.

Example:

```javascript
const ROUTER_URL =
  "http://192.168.8.1/cgi-bin/http.cgi";

const ROUTER_ORIGIN =
  "http://192.168.8.1";

const REFRESH_INTERVAL =
  2000;
```

Authentication configuration is also defined in `background.js`.

For security, avoid committing real router credentials, password hashes, session IDs, or session cookies to a public Git repository.

A better production implementation would store sensitive configuration securely or request credentials from the user.

## Permissions

The extension requires access to:

```text
http://192.168.8.1/*
```

This allows the background service worker to communicate with the router's local HTTP API.

## Troubleshooting

### Router shows `NO_AUTH`

The extension should automatically attempt to authenticate and retry the failed request.

Check the background service worker console if authentication continues to fail.

### No router information appears

Verify that the router is accessible:

```text
http://192.168.8.1
```

Also make sure the computer is connected to the router's network.

### Wi-Fi visibility cannot be changed

The Wi-Fi configuration API is router-specific.

Verify that the router supports the commands used by this extension.

### Extension logs

Open:

```text
chrome://extensions/
```

Find **Router Internet Speed Monitor** and open the background service worker developer tools.

The extension logs router requests, responses, authentication attempts, Wi-Fi configuration operations, and errors to the console.

## Security

This project communicates directly with a router's local administration API.

Do not publish a version containing real:

```text
password hashes
session IDs
session cookies
router credentials
```

These values should be removed from source control before publishing the repository.

## Browser Support

Designed primarily for:

- Google Chrome
- Chromium-based browsers supporting Manifest V3

## Version

Current manifest version:

```text
1.1.0
```

## Disclaimer

This project communicates with router-specific APIs that may not be documented or standardized.

Commands and response formats may differ between router models and firmware versions.

Use the extension only with routers and networks you are authorized to administer.

## License

Add the license appropriate for your project, for example:
