const AudioCtx = typeof AudioContext !== "undefined" ? AudioContext : (window as any).webkitAudioContext;

let ctx: AudioContext | null = null;
const getCtx = () => {
  if (!ctx) ctx = new AudioCtx();
  return ctx;
};

const playTone = (freq: number, duration: number, type: OscillatorType = "sine", vol = 0.3) => {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
};

export const playBetSound = () => {
  playTone(800, 0.08, "square", 0.15);
  setTimeout(() => playTone(1200, 0.06, "square", 0.1), 50);
};

export const playSpinSound = () => {
  let i = 0;
  const id = setInterval(() => {
    playTone(300 + (i % 8) * 80, 0.05, "triangle", 0.12);
    i++;
    if (i > 30) clearInterval(id);
  }, 120);
  return id;
};

export const playWinSound = () => {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => setTimeout(() => playTone(n, 0.25, "sine", 0.25), i * 120));
};

export const playLoseSound = () => {
  playTone(300, 0.3, "sawtooth", 0.15);
  setTimeout(() => playTone(200, 0.4, "sawtooth", 0.12), 200);
};

export const playClickSound = () => {
  // Short, crisp casino-style UI click
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.06);
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.06);
};

export const playCountdownBeep = () => {
  playTone(600, 0.1, "sine", 0.2);
};

export const playResultReveal = () => {
  playTone(880, 0.15, "sine", 0.2);
  setTimeout(() => playTone(1100, 0.2, "sine", 0.25), 100);
};

// Background music - casino/game looping melody
let bgOscs: OscillatorNode[] = [];
let bgGain: GainNode | null = null;
let bgPlaying = false;

export const startBgMusic = () => {
  if (bgPlaying) return;
  const c = getCtx();
  bgGain = c.createGain();
  bgGain.gain.value = 0.06;
  bgGain.connect(c.destination);

  const melody = [
    262, 330, 392, 330, 349, 294, 262, 294,
    330, 392, 440, 392, 349, 330, 294, 262,
  ];
  const noteLen = 0.4;

  const playLoop = () => {
    if (!bgPlaying || !bgGain) return;
    const c = getCtx();
    melody.forEach((freq, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.value = 0.06;
      g.gain.setValueAtTime(0.06, c.currentTime + i * noteLen);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (i + 1) * noteLen - 0.02);
      osc.connect(g).connect(bgGain!);
      osc.start(c.currentTime + i * noteLen);
      osc.stop(c.currentTime + (i + 1) * noteLen);
      bgOscs.push(osc);
    });
    // Loop after full melody
    setTimeout(() => {
      bgOscs = [];
      playLoop();
    }, melody.length * noteLen * 1000);
  };

  bgPlaying = true;
  playLoop();
};

export const stopBgMusic = () => {
  bgPlaying = false;
  bgOscs.forEach(o => { try { o.stop(); } catch {} });
  bgOscs = [];
  if (bgGain) { bgGain.disconnect(); bgGain = null; }
};

export const isBgMusicPlaying = () => bgPlaying;
