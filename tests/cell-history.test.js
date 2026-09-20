const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CellHistory = require("../cell-history.js");

const root = path.resolve(__dirname, "..");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");

test("parses CMD 186 tagged RSRP and global cell ID", () => {
  const parsed = CellHistory.parseDiagnosticsResponse({
    success: true,
    cmd: 186,
    message: [
      "AT+TZRSRP? +TZRSRP: -104",
      "AT+TZGLBCELLID? +TZGLBCELLID: 633601"
    ]
  });

  assert.equal(parsed.rsrpDbm, -104);
  assert.equal(parsed.globalCellId, 633601);
  assert.equal(parsed.globalCellIdHex, "0x0009ab01");
  assert.equal(parsed.eNodeBId, 2475);
  assert.equal(parsed.sectorId, 1);
});

test("creates a sample with timestamp and local/ISO date time", () => {
  const sample = CellHistory.createSample({
    rsrpDbm: -104,
    globalCellId: 633601,
    globalCellIdHex: "0x0009ab01",
    eNodeBId: 2475,
    sectorId: 1
  }, 1700000000000);

  assert.equal(sample.timestamp, 1700000000000);
  assert.ok(sample.isoTime);
  assert.ok(sample.localTime);
  assert.equal(sample.globalCellId, 633601);
  assert.equal(sample.rsrpDbm, -104);
});

test("history is capped to configured maximum", () => {
  const history = [{timestamp:1},{timestamp:2},{timestamp:3}];
  const next = CellHistory.appendHistory(history, {timestamp:4}, 3);
  assert.deepEqual(next.map(x => x.timestamp), [2,3,4]);
});

test("background sends lightweight CMD 186 cell/signal request", () => {
  assert.match(background, /cmd:\s*186/);
  assert.match(background, /AT\+TZRSRP\?/);
  assert.match(background, /AT\+TZGLBCELLID\?/);
});

test("background creates a one-minute cell history alarm", () => {
  assert.match(background, /CELL_HISTORY_ALARM/);
  assert.match(background, /periodInMinutes:\s*1/);
});

test("cell history is stored only in chrome.storage.local", () => {
  assert.match(background, /CELL_HISTORY_STORAGE_KEY/);
  assert.match(background, /storage\.set\(\{/);
  assert.doesNotMatch(background, /fetch\([^)]*cellSignalHistory/);
});

test("cell history collection is skipped while paused", () => {
  const start = background.indexOf("async function saveCellSignalSample()");
  assert.notEqual(start, -1);
  const block = background.slice(start, start + 600);
  assert.match(block, /isExtensionPaused\(\)/);
});

test("cell history can be retrieved and cleared through runtime messages", () => {
  assert.match(background, /case "getCellSignalHistory"/);
  assert.match(background, /case "clearCellSignalHistory"/);
});
