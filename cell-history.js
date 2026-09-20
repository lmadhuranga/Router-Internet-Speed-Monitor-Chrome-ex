(function(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RouterCellHistory = api;
})(typeof self !== "undefined" ? self : globalThis, function(){
  const MAX_HISTORY_ENTRIES = 43200; // 30 days at one sample per minute.

  function numericValue(value){
    if (value === null || value === undefined) return null;
    const match = String(value).match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
  }

  function flattenResponse(value, output = []){
    if (value === null || value === undefined) return output;
    if (typeof value === "string" || typeof value === "number") {
      output.push(String(value));
      return output;
    }
    if (Array.isArray(value)) {
      for (const item of value) flattenResponse(item, output);
      return output;
    }
    if (typeof value === "object") {
      for (const item of Object.values(value)) flattenResponse(item, output);
    }
    return output;
  }

  function findTaggedNumber(text, tags){
    const source = String(text || "");
    for (const tag of tags) {
      const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`${escaped}\\s*[:=,]?\\s*(-?\\d+(?:\\.\\d+)?)`, "i"),
        new RegExp(`\\+${escaped}\\s*[:=,]?\\s*(-?\\d+(?:\\.\\d+)?)`, "i")
      ];
      for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match) return Number(match[1]);
      }
    }
    return null;
  }

  function parseDiagnosticsResponse(data){
    if (!data || typeof data !== "object") {
      throw new Error("Invalid CMD 186 response");
    }
    if (data.success === false) {
      throw new Error(data.message || "CMD 186 diagnostics failed");
    }

    const flattened = flattenResponse(data).join("\n");

    let rsrp = findTaggedNumber(flattened, ["TZRSRP", "RSRP"]);
    let globalCellId = findTaggedNumber(flattened, ["TZGLBCELLID", "GLBCELLID", "GLOBALCELLID"]);

    // Firmware responses may expose command results as arrays where tags and values
    // are separated. Fall back to nearby numeric values.
    const lines = flattenResponse(data);
    for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i]);

      if (rsrp === null && /TZRSRP|RSRP/i.test(line)) {
        rsrp = numericValue(line);
        if (rsrp === null && i + 1 < lines.length) rsrp = numericValue(lines[i + 1]);
      }

      if (globalCellId === null && /TZGLBCELLID|GLBCELLID|GLOBALCELLID/i.test(line)) {
        globalCellId = numericValue(line);
        if (globalCellId === null && i + 1 < lines.length) globalCellId = numericValue(lines[i + 1]);
      }
    }

    if (rsrp === null) throw new Error("CMD 186 response did not contain RSRP");
    if (globalCellId === null) throw new Error("CMD 186 response did not contain Global Cell ID");

    const normalizedRsrp = rsrp > 0 ? -Math.abs(rsrp) : rsrp;
    const cellId = Math.trunc(globalCellId);

    return {
      globalCellId: cellId,
      globalCellIdHex: `0x${cellId.toString(16).padStart(8, "0")}`,
      eNodeBId: cellId >> 8,
      sectorId: cellId & 255,
      rsrpDbm: normalizedRsrp
    };
  }

  function createSample(parsed, timestamp = Date.now()){
    const ts = Number(timestamp);
    const date = new Date(ts);
    return {
      timestamp: ts,
      isoTime: date.toISOString(),
      localTime: date.toLocaleString(),
      globalCellId: parsed.globalCellId,
      globalCellIdHex: parsed.globalCellIdHex,
      eNodeBId: parsed.eNodeBId,
      sectorId: parsed.sectorId,
      rsrpDbm: parsed.rsrpDbm
    };
  }

  function appendHistory(history, sample, maxEntries = MAX_HISTORY_ENTRIES){
    const source = Array.isArray(history) ? history : [];
    const next = [...source, sample];
    const max = Math.max(1, Number(maxEntries) || MAX_HISTORY_ENTRIES);
    return next.length > max ? next.slice(next.length - max) : next;
  }

  return {
    MAX_HISTORY_ENTRIES,
    numericValue,
    flattenResponse,
    parseDiagnosticsResponse,
    createSample,
    appendHistory
  };
});
