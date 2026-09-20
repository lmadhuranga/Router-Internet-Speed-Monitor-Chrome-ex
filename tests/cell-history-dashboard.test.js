const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "history.html"), "utf8");
const js = fs.readFileSync(path.join(root, "history.js"), "utf8");
const monitorHtml = fs.readFileSync(path.join(root, "monitor.html"), "utf8");
const optionsHtml = fs.readFileSync(path.join(root, "options.html"), "utf8");

test("history dashboard has signal chart and cell summary table", () => {
  assert.match(html, /id="signalChart"/);
  assert.match(html, /id="cellSummaryBody"/);
  assert.match(html, /Signal strength over time/);
  assert.match(html, /Cell summary/);
});

test("history dashboard supports multiple time ranges", () => {
  assert.match(html, /data-range="60"/);
  assert.match(html, /data-range="360"/);
  assert.match(html, /data-range="1440"/);
  assert.match(html, /data-range="10080"/);
  assert.match(html, /data-range="43200"/);
});

test("history dashboard reads only local cell history", () => {
  assert.match(js, /type:"getCellSignalHistory"/);
  assert.doesNotMatch(js, /cmd:\s*186/);
  assert.doesNotMatch(js, /fetch\(/);
});

test("history chart plots RSRP and distinguishes cell IDs", () => {
  assert.match(js, /RSRP \(dBm\)/);
  assert.match(js, /globalCellId/);
  assert.match(js, /cellColor/);
});

test("history dashboard summarizes average best worst and latest", () => {
  assert.match(js, /average/);
  assert.match(js, /best/);
  assert.match(js, /worst/);
  assert.match(js, /lastSeen/);
});

test("monitor and options expose history buttons", () => {
  assert.match(monitorHtml, /id="historyBtn"/);
  assert.match(optionsHtml, /id="cellHistoryBtn"/);
});
