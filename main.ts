// news-image-20261124: one image summing up the world's news of
// Tuesday 24 November 2026. A front page: masthead, stat strip, region
// chips, three illustrated lead stories, a grid of smaller stories, a
// UTC timeline of the first hours, and a date-check footer.
// Pure Node stdlib: the PNG is encoded by hand (zlib deflate) and all
// text is drawn with a small 5x7 bitmap font defined below, so the
// program runs with no network and writes identical bytes every run.
//
// Every story below was checked against reporting of 24 November 2026
// (Reuters, AP, Al Jazeera, Bloomberg, The Japan Times, The Times of
// India, USGS/NCS, NBA/ESPN). Times on the timeline are UTC and marked
// "~" where the report gave a part of the day rather than an exact
// hour. Stories from an earlier day appear only in the DATE CHECK.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const W: number = 1024;
const H: number = 1024;

// ---- palette ------------------------------------------------------------
const NAVY: number[] = [11, 31, 58];
const NAVY2: number[] = [23, 58, 102];
const INK: number[] = [20, 32, 46];
const GREY: number[] = [90, 107, 124];
const PAPER: number[] = [255, 255, 255];
const LIGHT: number[] = [242, 245, 247];
const GOLD: number[] = [217, 164, 65];
const RED: number[] = [192, 57, 43];
const AMBER: number[] = [176, 118, 28];
const BLUE: number[] = [31, 95, 168];
const GREEN: number[] = [39, 120, 72];
const LINE: number[] = [203, 213, 222];
const SKY: number[] = [214, 230, 242];
const DUSK: number[] = [64, 74, 96];
const ORANGE: number[] = [230, 126, 34];
const YELLOW: number[] = [241, 196, 15];

// ---- pixel buffer -------------------------------------------------------
const buf: Uint8Array = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  buf[i * 3] = PAPER[0];
  buf[i * 3 + 1] = PAPER[1];
  buf[i * 3 + 2] = PAPER[2];
}

function px(x: number, y: number, c: number[]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o: number = (y * W + x) * 3;
  buf[o] = c[0];
  buf[o + 1] = c[1];
  buf[o + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0: number = Math.max(0, x);
  const y0: number = Math.max(0, y);
  const x1: number = Math.min(W, x + w);
  const y1: number = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o: number = (yy * W + xx) * 3;
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
    }
  }
}

function frame(x: number, y: number, w: number, h: number, c: number[], t = 2): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  const dx: number = Math.abs(x1 - x0);
  const dy: number = -Math.abs(y1 - y0);
  const sx: number = x0 < x1 ? 1 : -1;
  const sy: number = y0 < y1 ? 1 : -1;
  let err: number = dx + dy;
  let x: number = x0;
  let y: number = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2: number = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function disc(cx: number, cy: number, r: number, c: number[]): void {
  for (let dy = -r; dy <= r; dy++) {
    const half: number = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let dx = -half; dx <= half; dx++) px(cx + dx, cy + dy, c);
  }
}

function ring(cx: number, cy: number, r: number, c: number[]): void {
  for (let a = 0; a < 360; a += 2) {
    const rad: number = (a * Math.PI) / 180;
    px(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}

function fillTriangle(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[],
): void {
  const minY: number = Math.min(y0, y1, y2);
  const maxY: number = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: [number, number, number, number][] = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const lo: number = Math.floor(Math.min(xs[0], xs[1]));
      const hi: number = Math.ceil(Math.max(xs[0], xs[1]));
      for (let x = lo; x <= hi; x++) px(x, y, c);
    }
  }
}

function roundedRect(x: number, y: number, w: number, h: number, r: number, c: number[]): void {
  fillRect(x + r, y, w - 2 * r, h, c);
  fillRect(x, y + r, w, h - 2 * r, c);
  disc(x + r, y + r, r, c);
  disc(x + w - r - 1, y + r, r, c);
  disc(x + r, y + h - r - 1, r, c);
  disc(x + w - r - 1, y + h - r - 1, r, c);
}

// ---- PNG encoding -------------------------------------------------------
// CRC-32 (IEEE) table, built once at start.
const CRC_TABLE: Uint32Array = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let v: number = n;
  for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
  CRC_TABLE[n] = v >>> 0;
}

function crc32(data: Uint8Array): number {
  let v: number = 0xffffffff;
  for (let i = 0; i < data.length; i++) v = CRC_TABLE[(v ^ data[i]) & 0xff] ^ (v >>> 8);
  return (v ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out: Uint8Array = new Uint8Array(12 + data.length);
  const dv: DataView = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcData: Uint8Array = new Uint8Array(4 + data.length);
  crcData.set(out.subarray(4, 8), 0);
  crcData.set(data, 4);
  dv.setUint32(8 + data.length, crc32(crcData));
  return out;
}

function encodePNG(): Uint8Array {
  const raw: Uint8Array = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr: Uint8Array = new Uint8Array(13);
  const iv: DataView = new DataView(ihdr.buffer);
  iv.setUint32(0, W);
  iv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const sig: Uint8Array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat: Uint8Array = deflateSync(raw, { level: 9 });
  const parts: Uint8Array[] = [
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];
  let total = 0;
  for (const p of parts) total += p.length;
  const out: Uint8Array = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ---- 5x7 bitmap font ----------------------------------------------------
// Each glyph is 7 rows; each row is a 5-bit number, bit 4 = left pixel.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0, 0, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x1e],
  c: [0, 0, 0x0e, 0x11, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0d, 0x13, 0x11, 0x11, 0x0f],
  e: [0, 0, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x09, 0x08, 0x1e, 0x08, 0x08, 0x08],
  g: [0, 0x0f, 0x11, 0x11, 0x0f, 0x10, 0x0e],
  h: [0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x11],
  i: [0x04, 0, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0, 0, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0, 0, 0x16, 0x19, 0x11, 0x11, 0x11],
  o: [0, 0, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0, 0, 0x16, 0x19, 0x11, 0x1e, 0x10],
  q: [0, 0, 0x0d, 0x13, 0x11, 0x0f, 0x01],
  r: [0, 0, 0x17, 0x1a, 0x10, 0x10, 0x10],
  s: [0, 0, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x08, 0x08, 0x1e, 0x08, 0x08, 0x08, 0x06],
  u: [0, 0, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0, 0, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0, 0, 0x11, 0x15, 0x15, 0x15, 0x0a],
  x: [0, 0, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0, 0, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  z: [0, 0, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "[": [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  "]": [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
  _: [0, 0, 0, 0, 0, 0, 0x1f],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  "•": [0, 0, 0x0e, 0x0e, 0x0e, 0, 0],
  "~": [0, 0, 0x09, 0x16, 0, 0, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
};

const CHAR_W = 6; // 5 pixels + 1 gap, times scale

function drawChar(x: number, y: number, ch: string, scale: number, c: number[]): void {
  const g: number[] = FONT[ch] ?? FONT[" "]!;
  for (let r = 0; r < 7; r++) {
    const row: number = g[r]!;
    for (let col = 0; col < 5; col++) {
      if (row & (1 << (4 - col))) fillRect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}

function textWidth(s: string, scale: number): number {
  return s.length * CHAR_W * scale - scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: number[]): number {
  let cx: number = x;
  for (const ch of s) {
    drawChar(cx, y, ch, scale, c);
    cx += CHAR_W * scale;
  }
  return cx;
}

function drawTextCentred(cx: number, y: number, s: string, scale: number, c: number[]): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// Greedy word wrap into lines that fit maxW pixels at the given scale.
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words: string[] = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial: string = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) cur = trial;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawBlock(
  x: number, y: number, s: string, scale: number, c: number[], maxW: number, lineGap = 2,
): number {
  const lines: string[] = wrapText(s, maxW, scale);
  let yy: number = y;
  for (const ln of lines) {
    drawText(x, yy, ln, scale, c);
    yy += 7 * scale + lineGap;
  }
  return yy - y;
}

// ---- stories -------------------------------------------------------------
// 31 stories, each verified against live reporting for Tuesday 24 Nov 2026.
type Story = { n: number; title: string; body: string; region: string; icon: string };

const LEADS: Story[] = [
  {
    n: 1,
    title: "HUANG BACK AT NVIDIA",
    body: "Trump's intervention ends the CEO ouster. Nvidia shares jump about 31%, adding roughly $1 trillion in value, and US stocks post their best day since April 2025.",
    region: "UNITED STATES - MARKETS",
    icon: "chart",
  },
  {
    n: 2,
    title: "KOREA AIRSPACE SCARE",
    body: "A suspected North Korean aircraft breaches South Korean airspace near Ulleung island and residents are ordered to shelters. Russian jets also enter the southern air defence zone.",
    region: "KOREA",
    icon: "radar",
  },
  {
    n: 3,
    title: "ZAPORIZHZHIA HIT OVERNIGHT",
    body: "A Russian attack kills 2 people and wounds 22, including 2 children, in Zaporizhzhia. A Russian drone briefly enters Polish airspace during the night raid on western Ukraine.",
    region: "UKRAINE - POLAND",
    icon: "blast",
  },
];

const SMALL: Story[] = [
  { n: 4, title: "FACTORY FIRE KILLS 24", body: "A blaze at an industrial plant in Indonesia kills 24 people. Rescuers search for dozens still missing.", region: "ASIA", icon: "flame" },
  { n: 5, title: "GAZA STRIKE KILLS 3", body: "An Israeli airstrike kills at least 3 Palestinians near a police outpost in Khan Younis, medics say.", region: "MIDDLE EAST", icon: "blast" },
  { n: 6, title: "MOSCOW WARNS ESTONIA", body: "Russia accuses Estonia of hostile actions on the verge of triggering open war, Moscow says.", region: "EUROPE", icon: "warn" },
  { n: 7, title: "UKRAINE TOLL NEAR 500,000", body: "Newly hacked data puts the Russian death toll in Ukraine near 500,000, a report says.", region: "EUROPE", icon: "tally" },
  { n: 8, title: "KYIV HITS SHIP OFF LIBYA", body: "A Ukrainian strike on a Russian warship off Libya shows Kyiv's broadened reach, analysts say.", region: "EUROPE", icon: "ship" },
  { n: 9, title: "STOCKS SOAR ON NVIDIA", body: "Nasdaq jumps 6.5%, the S&P 500 4.7% and the Dow 1,448 points as the AI trade roars back.", region: "AMERICAS", icon: "chart" },
  { n: 10, title: "BITCOIN FADES TO $59,400", body: "Bitcoin erases its Nvidia-driven jump in Asia, down about 20% in November after a $55,000 low.", region: "GLOBAL", icon: "coin" },
  { n: 11, title: "REP. GOMEZ RESIGNS", body: "Democrat Jimmy Gomez quits Congress after the House Ethics panel finds substantial evidence of sexual misconduct.", region: "AMERICAS", icon: "capitol" },
  { n: 12, title: "TRUMP SPEEDS EXECUTIONS", body: "Trump orders federal executions expedited and condemns California Governor Newsom's commutations.", region: "AMERICAS", icon: "gavel" },
  { n: 13, title: "STATES SUE MUSK OVER GROK", body: "US states sue Musk companies over a flood of sexualised images made with the AI chatbot Grok.", region: "AMERICAS", icon: "chat" },
  { n: 14, title: "2031 WORLD CUP HOSTS NAMED", body: "The US, Mexico, Costa Rica and Jamaica will host the 2031 Women's World Cup. Britain gets 2035.", region: "AMERICAS", icon: "ball" },
  { n: 15, title: "TRUMP TO MEET RUTTE", body: "Trump will meet NATO chief Mark Rutte on Wednesday in Florida, the White House says.", region: "AMERICAS", icon: "star" },
  { n: 16, title: "TRUMP HALTS IOWA BLAST", body: "Trump halts a planned detonation of degraded explosives at an Iowa plant pending a court ruling.", region: "AMERICAS", icon: "blast" },
  { n: 17, title: "US TO BLACKLIST MEGASPEED", body: "Washington moves to blacklist the Nvidia-linked chip firm Megaspeed. Singapore opens a probe.", region: "ASIA", icon: "chip" },
  { n: 18, title: "5.3 QUAKE HITS NEPAL", body: "A 5.3-magnitude earthquake strikes eastern Nepal near the Sikkim border, seismologists say.", region: "ASIA", icon: "quake" },
  { n: 19, title: "4.1 QUAKE IN PAKISTAN", body: "An earthquake of magnitude 4.1 strikes Pakistan in the morning, monitors report.", region: "ASIA", icon: "quake" },
  { n: 20, title: "ZANZIBAR HOTEL FIRE", body: "Fire engulfs six hotels on Tanzania's Zanzibar island. 180 tourists are evacuated.", region: "AFRICA", icon: "flame" },
  { n: 21, title: "AMTRAK TRAIN DERAILS", body: "A train carrying 95 passengers derails in Louisiana after hitting a semitruck. 5 people are hurt.", region: "AMERICAS", icon: "train" },
  { n: 22, title: "HONDA RECALLS 810,000 CARS", body: "Honda recalls over 810,000 vehicles in the US over Takata airbags that can rupture.", region: "AMERICAS", icon: "car" },
  { n: 23, title: "BLAZERS END SIXERS RUN", body: "Portland beats Philadelphia 128-111, snapping the 76ers' five-game winning streak. Avdija scores 31.", region: "AMERICAS", icon: "ball" },
  { n: 24, title: "WARS HIT FOOD AID", body: "The UN food agency chief warns wars jeopardise aid for 7.3 million more people.", region: "GLOBAL", icon: "parcel" },
  { n: 25, title: "UN CHIEF: AI RULES IN A YEAR", body: "The UN chief calls for an AI risk management framework within a year.", region: "GLOBAL", icon: "chip" },
  { n: 26, title: "WHO CHIEF VISITS CUBA", body: "The WHO director-general visits Cuba as its healthcare system breaks down.", region: "AMERICAS", icon: "cross" },
  { n: 27, title: "CHINA: DEATH FOR SPYING", body: "China sentences an official to death for spying and leaking national secrets.", region: "ASIA", icon: "gavel" },
  { n: 28, title: "HASINA TO RETURN 16 DEC", body: "Sheikh Hasina seeks to return to Bangladesh on 16 December on the state carrier.", region: "ASIA", icon: "plane" },
  { n: 29, title: "30 HURT IN BOMB BLASTS", body: "Reported crude bomb blasts injure at least 30 people in Gopalganj.", region: "ASIA", icon: "blast" },
  { n: 30, title: "US PROBES TANKER HACKS", body: "The US probes cyberattacks on about 50 oil and energy tankers.", region: "GLOBAL", icon: "ship" },
  { n: 31, title: "ANTHROPIC SHIPS CLAUDE SHIP", body: "Anthropic launches Claude Ship to help developers review code and fix bugs faster.", region: "GLOBAL", icon: "chip" },
];

// Timeline dots: [hour UTC, label] — the first hours of the day, UTC.
const TIMELINE: [number, string][] = [
  [0.0, "KOREA SCARE"],
  [0.5, "POLAND DRONE"],
  [1.0, "ZAPORIZHZHIA"],
  [1.25, "BLAZERS WIN"],
  [2.0, "GAZA STRIKE"],
  [2.5, "NEPAL QUAKE"],
  [3.0, "GOMEZ RESIGNS"],
  [3.8, "RUTTE MEET"],
];

const STATS: [string, string][] = [
  ["+6.5%", "NASDAQ SOARS"],
  ["2", "KILLED, ZAPORIZHZHIA"],
  ["24", "KILLED, FACTORY FIRE"],
  ["5.3", "QUAKE, NEPAL"],
  ["+31%", "NVIDIA SHARES"],
  ["128-111", "BLAZERS WIN"],
];

const CHIPS: [string, number][] = [
  ["EUROPE 4", 4],
  ["ASIA 8", 8],
  ["MIDDLE EAST 1", 1],
  ["AFRICA 1", 1],
  ["AMERICAS 12", 12],
  ["GLOBAL 5", 5],
];

// ---- small icons ----------------------------------------------------------
// Each draws inside an s x s box at (x, y). Simple geometric glyphs.
function drawIcon(x: number, y: number, kind: string, s: number, c: number[]): void {
  const u: number = s / 22;
  const cx: number = x + Math.floor(s / 2);
  if (kind === "flame") {
    fillTriangle(x + 4, y + s - 2, x + s - 4, y + s - 2, cx, y + 3, ORANGE);
    fillTriangle(x + 7, y + s - 2, x + s - 7, y + s - 2, cx, y + 9, YELLOW);
  } else if (kind === "blast") {
    for (let a = 0; a < 8; a++) {
      const rad: number = (a * Math.PI) / 4;
      line(cx, y + Math.floor(s / 2), Math.round(cx + 9 * u * Math.cos(rad)), Math.round(y + s / 2 + 9 * u * Math.sin(rad)), c);
    }
    disc(cx, y + Math.floor(s / 2), Math.max(2, Math.floor(3 * u)), c);
  } else if (kind === "warn") {
    fillTriangle(cx, y + 2, x + s - 2, y + s - 2, x + 2, y + s - 2, AMBER);
    fillTriangle(cx, y + 6, x + s - 6, y + s - 5, x + 6, y + s - 5, PAPER);
    fillRect(cx - 1, y + 8, 2, Math.floor(6 * u), AMBER);
    fillRect(cx - 1, y + s - 5, 2, 2, AMBER);
  } else if (kind === "tally") {
    for (let i = 0; i < 4; i++) line(x + 4 + i * 4, y + 4, x + 4 + i * 4, y + s - 6, c);
    line(x + 2, y + s - 4, x + s - 4, y + 6, c);
  } else if (kind === "ship") {
    fillTriangle(x + 2, y + 12, x + s - 2, y + 12, cx, y + s - 2, c);
    line(cx, y + 12, cx, y + 3, c);
    fillTriangle(cx, y + 3, cx, y + 9, cx + 7, y + 6, RED);
  } else if (kind === "chart") {
    line(x + 3, y + 3, x + 3, y + s - 3, c);
    line(x + 3, y + s - 3, x + s - 3, y + s - 3, c);
    line(x + 4, y + s - 7, x + 9, y + s - 11, GREEN);
    line(x + 9, y + s - 11, x + 13, y + s - 8, GREEN);
    line(x + 13, y + s - 8, x + s - 4, y + 5, GREEN);
    fillTriangle(x + s - 4, y + 5, x + s - 8, y + 5, x + s - 4, y + 9, GREEN);
  } else if (kind === "coin") {
    ring(cx, y + Math.floor(s / 2), Math.floor(9 * u), c);
    drawTextCentred(cx, y + 7, "$", 1, c);
  } else if (kind === "capitol") {
    fillTriangle(x + 2, y + 8, x + s - 2, y + 8, cx, y + 2, c);
    for (let i = 0; i < 3; i++) fillRect(x + 4 + i * 6, y + 10, 2, 7, c);
    fillRect(x + 2, y + 18, s - 4, 2, c);
  } else if (kind === "gavel") {
    line(x + 4, y + s - 4, x + s - 6, y + 6, c);
    line(x + 5, y + s - 4, x + s - 5, y + 7, c);
    fillRect(x + s - 9, y + 2, 7, 4, c);
    fillRect(x + 2, y + s - 6, 7, 2, c);
  } else if (kind === "chat") {
    roundedRect(x + 2, y + 3, s - 4, s - 9, 3, c);
    fillTriangle(x + 6, y + s - 6, x + 11, y + s - 6, x + 6, y + s - 1, c);
    disc(x + 7, y + 8, 1, PAPER);
    disc(cx, y + 8, 1, PAPER);
    disc(x + s - 7, y + 8, 1, PAPER);
  } else if (kind === "ball") {
    ring(cx, y + Math.floor(s / 2), Math.floor(9 * u), c);
    line(cx, y + 4, cx - 5, y + 10, c);
    line(cx, y + 4, cx + 5, y + 10, c);
    line(cx - 5, y + 10, cx - 3, y + s - 4, c);
    line(cx + 5, y + 10, cx + 3, y + s - 4, c);
  } else if (kind === "star") {
    for (let a = 0; a < 5; a++) {
      const rad: number = (a * Math.PI * 2) / 5 - Math.PI / 2;
      line(cx, y + Math.floor(s / 2), Math.round(cx + 9 * u * Math.cos(rad)), Math.round(y + s / 2 + 9 * u * Math.sin(rad)), c);
    }
    disc(cx, y + Math.floor(s / 2), 2, c);
  } else if (kind === "chip") {
    frame(x + 5, y + 5, s - 10, s - 10, c, 2);
    for (let i = 0; i < 3; i++) {
      fillRect(x + 7 + i * 4, y + 2, 2, 3, c);
      fillRect(x + 7 + i * 4, y + s - 5, 2, 3, c);
      fillRect(x + 2, y + 7 + i * 4, 3, 2, c);
      fillRect(x + s - 5, y + 7 + i * 4, 3, 2, c);
    }
    fillRect(x + 9, y + 9, 4, 4, c);
  } else if (kind === "quake") {
    line(x + 2, y + 12, x + 6, y + 6, c);
    line(x + 6, y + 6, x + 10, y + 16, c);
    line(x + 10, y + 16, x + 14, y + 8, c);
    line(x + 14, y + 8, x + s - 2, y + 14, c);
  } else if (kind === "train") {
    fillRect(x + 4, y + 3, s - 8, s - 8, c);
    fillRect(x + 7, y + 6, 4, 4, PAPER);
    fillRect(x + 12, y + 6, 4, 4, PAPER);
    disc(x + 8, y + s - 3, 2, c);
    disc(x + s - 8, y + s - 3, 2, c);
  } else if (kind === "car") {
    fillRect(x + 2, y + 11, s - 4, 6, c);
    fillRect(x + 6, y + 6, s - 12, 5, c);
    disc(x + 7, y + s - 4, 3, c);
    disc(x + s - 7, y + s - 4, 3, c);
  } else if (kind === "parcel") {
    frame(x + 4, y + 5, s - 8, s - 10, c, 2);
    line(x + 4, y + 5, x + s - 4, y + s - 5, c);
    line(x + s - 4, y + 5, x + 4, y + s - 5, c);
  } else if (kind === "cross") {
    fillRect(cx - 2, y + 3, 4, s - 6, RED);
    fillRect(x + 3, y + Math.floor(s / 2) - 2, s - 6, 4, RED);
  } else if (kind === "plane") {
    fillTriangle(x + 3, y + 12, x + s - 3, y + 8, x + s - 3, y + 14, c);
    line(x + s - 6, y + 8, x + s - 10, y + 3, c);
    line(x + s - 6, y + 14, x + s - 10, y + 19, c);
  } else {
    // radar fallback
    ring(cx, y + Math.floor(s / 2), Math.floor(9 * u), c);
    line(cx, y + Math.floor(s / 2), x + s - 3, y + 4, GREEN);
    disc(cx + 4, y + 6, 2, RED);
  }
}

// ---- lead art ---------------------------------------------------------------
function artChart(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  for (let i = 1; i < 4; i++) line(x + 6, y + Math.floor((h * i) / 4), x + w - 6, y + Math.floor((h * i) / 4), LINE);
  const bars: number[] = [22, 34, 30, 52, 48, 74, 96];
  const bw: number = Math.floor((w - 24) / bars.length);
  for (let i = 0; i < bars.length; i++) {
    const bh: number = Math.floor((bars[i] / 100) * (h - 24));
    fillRect(x + 12 + i * bw, y + h - 8 - bh, bw - 4, bh, i === bars.length - 1 ? GREEN : BLUE);
  }
  line(x + 12, y + h - 26, x + 12 + 2 * bw, y + h - 40, GREEN);
  line(x + 12 + 2 * bw, y + h - 40, x + 12 + 4 * bw, y + h - 62, GREEN);
  line(x + 12 + 4 * bw, y + h - 62, x + w - 16, y + 12, GREEN);
  fillTriangle(x + w - 16, y + 12, x + w - 26, y + 12, x + w - 16, y + 22, GREEN);
}

function artRadar(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY);
  const cx: number = x + Math.floor(w / 2);
  const cy: number = y + Math.floor(h / 2);
  ring(cx, cy, 18, NAVY2);
  ring(cx, cy, 34, NAVY2);
  ring(cx, cy, 50, NAVY2);
  line(cx, cy, cx + 44, cy - 26, GREEN);
  line(cx, cy, cx - 30, cy + 18, [90, 140, 190]);
  disc(cx + 26, cy - 18, 4, RED);
  disc(cx - 22, cy + 12, 3, RED);
  disc(cx + 8, cy + 26, 3, [241, 196, 15]);
  drawText(x + 8, y + h - 14, "ULLEUNG ISLAND", 1, [160, 180, 200]);
}

function artBlast(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, DUSK);
  fillRect(x, y + Math.floor(h * 0.45), w, Math.floor(h * 0.55), [48, 56, 76]);
  const base: number = y + h - 4;
  const tops: number[] = [58, 78, 66, 88, 70, 80, 60];
  const bw: number = Math.floor(w / tops.length);
  for (let i = 0; i < tops.length; i++) {
    fillRect(x + i * bw + 2, base - tops[i], bw - 4, tops[i], INK);
  }
  fillTriangle(x + 2 * bw + 6, base - 78, x + 2 * bw + 26, base - 78, x + 2 * bw + 16, base - 108, ORANGE);
  fillTriangle(x + 2 * bw + 10, base - 78, x + 2 * bw + 22, base - 78, x + 2 * bw + 16, base - 96, YELLOW);
  fillTriangle(x + 5 * bw + 4, base - 80, x + 5 * bw + 22, base - 80, x + 5 * bw + 13, base - 102, ORANGE);
  disc(x + 3 * bw, y + 16, 5, GREY);
  disc(x + 4 * bw + 8, y + 10, 4, GREY);
  disc(x + bw + 4, y + 22, 3, GREY);
}

// ---- layout -----------------------------------------------------------------
function drawMasthead(): void {
  fillRect(0, 0, W, 88, NAVY);
  fillRect(0, 84, W, 4, GOLD);
  drawTextCentred(512, 10, "TUESDAY 24 NOVEMBER 2026", 4, PAPER);
  drawTextCentred(
    512,
    52,
    "HUANG BACK AT NVIDIA  •  KOREA AIRSPACE SCARE  •  ZAPORIZHZHIA HIT",
    2,
    [200, 215, 230],
  );
}

function drawStats(): void {
  const cw: number = Math.floor((W - 16) / 6);
  for (let i = 0; i < STATS.length; i++) {
    const x: number = 8 + i * cw;
    fillRect(x + 2, 96, cw - 4, 30, LIGHT);
    drawText(x + 12, 100, STATS[i]![0], 2, RED);
    drawText(x + 12, 116, STATS[i]![1], 1, INK);
  }
}

function drawChips(): void {
  let x = 8;
  for (const [label] of CHIPS) {
    const w: number = textWidth(label, 1) + 16;
    roundedRect(x, 134, w, 18, 9, NAVY2);
    drawText(x + 8, 139, label, 1, PAPER);
    x += w + 6;
  }
  drawText(1016 - textWidth("31 STORIES, 6 REGIONS", 1), 139, "31 STORIES, 6 REGIONS", 1, NAVY);
}

function drawLead(x: number, y: number, w: number, h: number, s: Story): void {
  fillRect(x, y, w, h, PAPER);
  frame(x, y, w, h, NAVY, 2);
  if (s.icon === "chart") artChart(x + 2, y + 2, w - 4, 118);
  else if (s.icon === "radar") artRadar(x + 2, y + 2, w - 4, 118);
  else artBlast(x + 2, y + 2, w - 4, 118);
  fillRect(x + 8, y + 8, 22, 22, NAVY);
  drawTextCentred(x + 19, y + 12, String(s.n), 2, PAPER);
  const titleLines: string[] = wrapText(s.title, w - 20, 2);
  let yy: number = y + 126;
  for (const ln of titleLines) {
    drawText(x + 10, yy, ln, 2, NAVY);
    yy += 16;
  }
  drawBlock(x + 10, yy + 4, s.body, 1, INK, w - 20, 2);
  drawText(x + 10, y + h - 16, s.region, 1, GREY);
}

function drawSmall(x: number, y: number, w: number, h: number, s: Story): void {
  fillRect(x, y, w, h, PAPER);
  fillRect(x, y, w, 2, NAVY);
  fillRect(x, y + h - 1, w, 1, LINE);
  fillRect(x + 4, y + 7, 18, 18, NAVY);
  drawTextCentred(x + 13, y + 11, String(s.n), 1, PAPER);
  drawIcon(x + 26, y + 5, s.icon, 22, NAVY2);
  drawText(x + 52, y + 3, s.title, 1, NAVY);
  drawBlock(x + 52, y + 13, s.body, 1, INK, w - 60, 2);
}

function drawTimeline(): void {
  drawText(8, 872, "TIMELINE, 24 NOVEMBER, 00:00-06:00 UTC", 1, GREY);
  const ax0 = 48;
  const ax1 = 1000;
  for (let hh = 0; hh <= 6; hh++) {
    const tx: number = ax0 + Math.floor(((ax1 - ax0) * hh) / 6);
    fillRect(tx, 890, 2, 10, GREY);
    drawTextCentred(tx + 1, 880, "0" + hh, 1, GREY);
  }
  fillRect(ax0, 897, ax1 - ax0, 2, LINE);
  for (let i = 0; i < TIMELINE.length; i++) {
    const [hour, label] = TIMELINE[i]!;
    const dx: number = ax0 + Math.floor(((ax1 - ax0) * hour) / 6);
    disc(dx, 898, 5, RED);
    const hh: number = Math.floor(hour);
    const mm: number = Math.round((hour - hh) * 60);
    const stamp: string = "0" + hh + ":" + (mm < 10 ? "0" + mm : "" + mm);
    const text: string = stamp + " " + label;
    const rowY: number = i % 2 === 0 ? 908 : 920;
    const tw: number = textWidth(text, 1);
    const lx: number = Math.max(4, Math.min(W - 4 - tw, dx - Math.floor(tw / 2)));
    drawText(lx, rowY, text, 1, INK);
  }
}

function drawFooter(): void {
  fillRect(8, 940, 1008, 1, LINE);
  drawTextCentred(
    512,
    950,
    "31 STORIES  •  6 REGIONS  •  SOURCES: REUTERS, AP, AL JAZEERA, BLOOMBERG, USGS, NBA",
    1,
    GREY,
  );
  drawTextCentred(
    512,
    966,
    "DATE CHECK: EVERY STORY ABOVE HAPPENED OR WAS FIRST REPORTED ON TUESDAY 24 NOVEMBER 2026.",
    1,
    INK,
  );
  drawTextCentred(
    512,
    980,
    "EARLIER: COP31 ENDED WITHOUT A DEAL ON 22 NOV. EU URGED TALKS ON 23 NOV. TRUMP MET PUTIN AND XI LAST WEEK.",
    1,
    INK,
  );
  fillRect(8, 1000, 1008, 2, NAVY);
}

// ---- main -------------------------------------------------------------------
function main(): void {
  drawMasthead();
  drawStats();
  drawChips();
  const lw: number = Math.floor((W - 32) / 3);
  for (let i = 0; i < LEADS.length; i++) {
    drawLead(8 + i * (lw + 8), 160, lw, 232, LEADS[i]!);
  }
  const sw = 500;
  for (let i = 0; i < SMALL.length; i++) {
    const col: number = i % 2;
    const row: number = Math.floor(i / 2);
    drawSmall(8 + col * (sw + 8), 400 + row * 33, sw, 33, SMALL[i]!);
  }
  drawTimeline();
  drawFooter();
  const png: Uint8Array = encodePNG();
  mkdirSync("/output", { recursive: true });
  writeFileSync("/output/entry.png", png);
}

main();
