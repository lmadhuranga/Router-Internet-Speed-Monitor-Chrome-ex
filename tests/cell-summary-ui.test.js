const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "monitor.html"), "utf8");
const js = fs.readFileSync(path.join(root, "monitor.js"), "utf8");

test("live monitor contains current cell signal summary fields", () => {
  assert.match(html, /Current Cell & Signal/);
  assert.match(html, /id="currentCellId"/);
  assert.match(html, /id="currentCellSignal"/);
  assert.match(html, /id="cellSignalSentence"/);
  assert.match(html, /id="cellSignalTime"/);
});

test("summary reads the latest locally stored history sample", () => {
  assert.match(js, /type:"getCellSignalHistory"/);
  assert.match(js, /limit:1/);
});

test("summary maps cell ID to RSRP in readable text", () => {
  assert.match(js, /Cell ID \$\{cellId\} is currently mapped to a signal strength of \$\{rsrp\} dBm/);
});

test("summary displays sample date and time", () => {
  assert.match(js, /Recorded \$\{formatSampleTime\(sample\)\}/);
});

test("summary refresh loop is local-only and does not collect a new sample", () => {
  const start = js.indexOf("const cellSummaryLoop=async()=>");
  assert.notEqual(start, -1);
  const block = js.slice(start, start + 250);
  assert.match(block, /loadCellSignalSummary/);
  assert.doesNotMatch(block, /collectCellSignalSample/);
});
