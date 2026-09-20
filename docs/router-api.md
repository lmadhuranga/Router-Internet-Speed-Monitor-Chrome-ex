# Dialog ZLT P11 Router API Documentation

This document records only the router APIs that have been observed and used with the target router/firmware.

## Target router

- Dialog Sri Lanka ZLT P11 Outdoor LTE CPE
- Software: `40.8`
- Config: `Sri Lanka Dialog V9.8`
- Router origin: `http://192.168.8.1`
- API endpoint: `http://192.168.8.1/cgi-bin/http.cgi`

> These are undocumented, firmware-specific APIs discovered from the router web UI. Do not assume the same behavior on other ZLT models or firmware versions.

## Common request pattern

All verified calls are sent as HTTP `POST` requests to:

```text
http://192.168.8.1/cgi-bin/http.cgi
```

Typical headers:

```http
Accept: text/plain, */*; q=0.01
Content-Type: application/json; charset=UTF-8
Origin: http://192.168.8.1
Referer: http://192.168.8.1/mindex.html
X-Requested-With: XMLHttpRequest
```

Authenticated calls include a current `sessionId`.

Do not commit real router passwords, password hashes, active session IDs, cookies, Wi-Fi passwords, IMEI/IMSI/ICCID values, or other private router data.

## Command summary

| CMD | Method in JSON | Purpose |
|---|---|---|
| `0` | `GET` | Router status / WAN counters |
| `100` | `POST` | Authentication |
| `117` | `GET` | Read Wi-Fi configuration / SSID visibility |
| `117` | `POST` | Update Wi-Fi configuration / SSID visibility |
| `121` | `GET` | DHCP client / device list |
| `23` | `POST` | Save complete IPv4/IPv6 MAC access-rule list |
| `20` | `POST` | Apply / commit access-rule changes |

---

## CMD 0 — Router status

### Request

```json
{
  "cmd": 0,
  "method": "GET",
  "language": "EN",
  "sessionId": "<CURRENT_SESSION_ID>"
}
```

Fields currently used by the extension:

```text
rssi
wanRxBytes
wanTxBytes
wanRxPackets
wanTxPackets
wanIP
wanGateway
plmn
uptime
```

`wanRxBytes` and `wanTxBytes` are used to calculate live download/upload speed.

---

## CMD 100 — Authentication

### Request

```json
{
  "cmd": 100,
  "method": "POST",
  "sessionId": "<CURRENT_SESSION_ID>",
  "username": "<USERNAME>",
  "passwd": "<PASSWORD_HASH>",
  "language": "EN"
}
```

The extension uses this command when the router reports an expired or invalid session such as:

```json
{
  "success": false,
  "message": "NO_AUTH"
}
```

---

## CMD 117 — Wi-Fi configuration / SSID visibility

### Read current Wi-Fi configuration

```json
{
  "cmd": 117,
  "method": "GET",
  "language": "EN",
  "sessionId": "<CURRENT_SESSION_ID>"
}
```

The observed response is comma-separated text.

The extension currently uses:

```text
broadcast = 0 -> SSID visible
broadcast = 1 -> SSID hidden
```

### Update Wi-Fi visibility

The router expects the current Wi-Fi configuration to be sent back with the requested field changed.

Important:

- Read the current configuration first.
- Preserve the other Wi-Fi configuration fields.
- Change only `macinfo_broadcast`.
- Verify the result with another CMD `117` GET.

---

## CMD 121 — DHCP client / device list

### Request

```json
{
  "cmd": 121,
  "method": "GET",
  "language": "EN",
  "sessionId": "<CURRENT_SESSION_ID>"
}
```

### Verified response shape

```json
{
  "success": true,
  "cmd": 121,
  "data": [
    [
      "192.168.8.101",
      "AA:BB:CC:DD:EE:FF",
      "Example-Device",
      "23:56:09"
    ]
  ],
  "expiredTime": "86400"
}
```

Device row mapping:

```text
data[n][0] = IPv4 address
data[n][1] = MAC address
data[n][2] = hostname / device name
data[n][3] = remaining DHCP lease time
```

`expiredTime = 86400` corresponds to a 24-hour lease duration.

This appears to be a DHCP client/lease list, so recently disconnected devices may remain listed until their leases expire.

---

## CMD 23 — Save MAC access rules

CMD `23` saves the complete desired access-rule list.

### Example: IPv4 + IPv6 rules

```json
{
  "cmd": 23,
  "method": "POST",
  "success": true,
  "datas": [
    {
      "enableRule": true,
      "enableLink": true,
      "remark": "Example IPv6 rule",
      "ippro": "IPV6",
      "mac": "AA:BB:CC:DD:EE:FF"
    },
    {
      "enableRule": true,
      "enableLink": false,
      "remark": "Example IPv4 rule",
      "ippro": "IPV4",
      "mac": "AA:BB:CC:DD:EE:FF"
    }
  ],
  "language": "EN",
  "sessionId": "<CURRENT_SESSION_ID>"
}
```

### Verified field behavior

```text
enableRule = true   -> rule is enabled
enableLink = true   -> connection allowed
enableLink = false  -> connection blocked
ippro = IPV4/IPV6   -> protocol family
mac                 -> target device MAC address
remark              -> rule label
```

### Verified success response

```json
{
  "success": true,
  "cmd": 23,
  "message": ""
}
```

Treat CMD `23` as successful when:

```text
HTTP request succeeds
success === true
cmd === 23
```

Do not send CMD `20` if CMD `23` fails.

### Delete a rule

Deletion is performed by omitting the unwanted rule from the `datas` array and sending the remaining rules back with CMD `23`.

Example: keep only the IPv4 rule:

```json
{
  "cmd": 23,
  "method": "POST",
  "success": true,
  "datas": [
    {
      "enableRule": true,
      "enableLink": false,
      "remark": "Example IPv4 rule",
      "ippro": "IPV4",
      "mac": "AA:BB:CC:DD:EE:FF"
    }
  ],
  "language": "EN",
  "sessionId": "<CURRENT_SESSION_ID>"
}
```

Verified response:

```json
{
  "success": true,
  "cmd": 23,
  "message": ""
}
```

This indicates that CMD `23` behaves as a full rule-list update on the observed firmware: rules omitted from `datas` are removed from the saved rule set.

After CMD `23` succeeds, send CMD `20` to apply the change.

---

## CMD 20 — Apply / commit access rules

### Request

```json
{
  "cmd": 20,
  "method": "POST",
  "language": "EN",
  "sessionId": "<CURRENT_SESSION_ID>"
}
```

CMD `20` is sent after a successful CMD `23`.

The target firmware has been observed returning an empty response body for this command.

Clients should therefore not require JSON from CMD `20`.

Recommended handling:

```text
1. Save the complete rule list with CMD 23
2. Verify success === true and cmd === 23
3. Send CMD 20
4. Require HTTP-level success
5. Accept an empty response body
6. Re-read / verify router state when possible
```

The exact HTTP status returned by CMD `20` should be recorded once verified.

---

## Rule update workflow

```text
Read / preserve current rules
        |
Add, edit, allow, block, or remove the intended rule
        |
Build the complete desired datas array
        |
POST CMD 23
        |
Verify success=true and cmd=23
        |
POST CMD 20
        |
Require HTTP-level success
        |
Re-read / verify router state
```

---

## Session retry flow

```text
Router request
      |
Session invalid / NO_AUTH
      |
CMD 100 authentication
      |
Update current session
      |
Retry original request
```

## Notes

- MAC addresses are used by the extension to identify and locally label devices.
- Modern phones and laptops may use private/randomized Wi-Fi MAC addresses.
- The same physical device can therefore sometimes appear under a different MAC address.
- CMD `121` should be treated as a DHCP client/lease list rather than a guaranteed real-time online-device list.
- Avoid storing active session IDs or cookies in documentation or public source control.
