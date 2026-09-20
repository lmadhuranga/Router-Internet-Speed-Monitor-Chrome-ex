function playBell(kind) {
  const AudioCtx = self.AudioContext || self.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const now = ctx.currentTime;

  // Short two-part chime, played once.
  const frequencies = kind === "connected"
    ? [880, 1174.66]
    : [523.25, 392.00];

  frequencies.forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, now);

    const start = now + (index * 0.11);
    const end = start + 0.42;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(end + 0.02);
  });

  setTimeout(() => ctx.close().catch(() => {}), 900);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "playConnectionBell") {
    playBell(message.kind === "connected" ? "connected" : "disconnected");
  }
});
