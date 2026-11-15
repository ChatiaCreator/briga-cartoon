// Procedural cartoon textures drawn on canvases (no image files needed).
import * as THREE from 'three';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Seeded random so the arena looks the same for both players.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function skyTexture() {
  return canvas(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2b1055');
    gr.addColorStop(0.45, '#d7385e');
    gr.addColorStop(0.75, '#ff9a3c');
    gr.addColorStop(1, '#ffd36e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

export function groundTexture() {
  const t = canvas(2048, 512, (g, w, h) => {
    // Asphalt with grain.
    g.fillStyle = '#4b4659'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
      g.fillRect(r() * w, r() * h, 2 + r() * 5, 2 + r() * 4);
    }
    // Patched asphalt and oil stains.
    for (let i = 0; i < 9; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(30,26,40,0.35)' : 'rgba(90,84,104,0.35)';
      g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 90, 20 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill();
    }
    // Painted edge lines.
    g.fillStyle = '#ffd23f';
    g.fillRect(0, h * 0.12, w, 10);
    g.fillRect(0, h * 0.88, w, 10);
    // Spray-painted "FIGHT!" logo in the middle of the street.
    g.save();
    g.translate(w / 2, h / 2); g.scale(1, 0.62); g.rotate(-0.04);
    g.globalAlpha = 0.55;
    g.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2, rad = i % 2 ? 175 : 245;
      g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    g.closePath(); g.fillStyle = '#e8402e'; g.fill();
    g.lineWidth = 14; g.strokeStyle = '#ffd23f'; g.stroke();
    g.font = 'bold 150px Impact, Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 16; g.strokeStyle = '#1b1b1b'; g.strokeText('FIGHT!', 0, 6);
    g.fillStyle = '#fff'; g.fillText('FIGHT!', 0, 6);
    g.restore();
    // Manhole covers.
    for (const x of [w * 0.2, w * 0.82]) {
      g.save(); g.translate(x, h * 0.6); g.scale(1, 0.6);
      g.fillStyle = '#2d2a36'; g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#6c6680'; g.lineWidth = 5; g.stroke();
      g.strokeStyle = 'rgba(140,132,160,0.6)'; g.lineWidth = 3;
      for (let k = -30; k <= 30; k += 12) { g.beginPath(); g.moveTo(-36, k); g.lineTo(36, k); g.stroke(); }
      g.restore();
    }
    // Puddles reflecting the sunset.
    for (const [x, y, rx] of [[w * 0.33, h * 0.75, 70], [w * 0.7, h * 0.3, 55], [w * 0.92, h * 0.72, 60]]) {
      const gr = g.createLinearGradient(0, y - 20, 0, y + 20);
      gr.addColorStop(0, 'rgba(255,154,60,0.55)'); gr.addColorStop(1, 'rgba(215,56,94,0.45)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, rx * 0.35, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(x - rx * 0.3, y - 5, rx * 0.3, 4, 0, 0, Math.PI * 2); g.fill();
    }
    // Cracks.
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      let x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
  });
  return t;
}

export function sidewalkTexture() {
  const t = canvas(512, 128, (g, w, h) => {
    g.fillStyle = '#9d90b0'; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 600; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
      g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
    }
    g.strokeStyle = 'rgba(40,30,60,0.45)'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Street-level shop: brick upper wall with windows, shop window and door below, sign band.
export function shopTexture(seed, name, wall, sign) {
  return canvas(512, 640, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    // Bricks.
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2;
    for (let y = 0, row = 0; y < h * 0.62; y += 16, row++) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      for (let x = (row % 2) * 24; x < w; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
    }
    // Upstairs windows with curtains, some lit.
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 155, y = 70, ww = 112, wh = 130;
      const lit = r() < 0.6;
      g.fillStyle = '#1a1424'; g.fillRect(x - 8, y - 8, ww + 16, wh + 16);
      g.fillStyle = lit ? '#ffd98a' : '#2f2748'; g.fillRect(x, y, ww, wh);
      g.fillStyle = lit ? 'rgba(232,64,46,0.65)' : 'rgba(80,60,110,0.8)';
      g.fillRect(x, y, ww * 0.28, wh); g.fillRect(x + ww * 0.72, y, ww * 0.28, wh);
      g.fillStyle = '#1a1424'; g.fillRect(x + ww / 2 - 3, y, 6, wh);
      g.fillStyle = '#d9cfe6'; g.fillRect(x - 12, y + wh + 6, ww + 24, 10);
    }
    // Sign band.
    const sy = h * 0.62;
    g.fillStyle = sign; g.fillRect(0, sy, w, 70);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, sy + 62, w, 8);
    g.font = 'bold 50px Impact, Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#1b1b1b'; g.strokeText(name, w / 2, sy + 34);
    g.fillStyle = '#fff'; g.fillText(name, w / 2, sy + 34);
    // Shop window (warm light, shelves) and door.
    const fy = sy + 70, fh = h - fy;
    g.fillStyle = '#2a2236'; g.fillRect(0, fy, w, fh);
    const gr = g.createLinearGradient(0, fy, 0, h);
    gr.addColorStop(0, '#ffe7a8'); gr.addColorStop(1, '#ffb45c');
    g.fillStyle = gr; g.fillRect(24, fy + 18, 300, fh - 50);
    g.fillStyle = 'rgba(90,50,30,0.55)';
    for (let k = 0; k < 3; k++) g.fillRect(24, fy + 50 + k * 45, 300, 7);
    for (let k = 0; k < 16; k++) {
      g.fillStyle = ['#e8402e', '#2f6f8f', '#3b8c6b', '#8c3b5b', '#ffd23f'][Math.floor(r() * 5)];
      g.fillRect(34 + r() * 270, fy + 26 + Math.floor(r() * 3) * 45, 14 + r() * 16, 22);
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.moveTo(60, fy + 18); g.lineTo(110, fy + 18); g.lineTo(40, fy + fh - 32); g.lineTo(24, fy + fh - 32); g.closePath(); g.fill();
    g.strokeStyle = '#1a1424'; g.lineWidth = 10; g.strokeRect(24, fy + 18, 300, fh - 50);
    g.fillStyle = '#5a3c2a'; g.fillRect(360, fy + 14, 120, fh - 14);
    g.fillStyle = '#ffd98a'; g.fillRect(378, fy + 30, 84, 70);
    g.strokeStyle = '#1a1424'; g.lineWidth = 8; g.strokeRect(360, fy + 14, 120, fh - 14);
    g.strokeStyle = '#1a1424'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
  });
}

export function awningTexture(a, b) {
  return canvas(256, 64, (g, w, h) => {
    for (let x = 0, i = 0; x < w; x += 32, i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(x, 0, 32, h); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 10, w, 10);
  });
}

// Neon sign: glowing outlined text on transparent background.
export function neonTexture(text, color) {
  return canvas(512, 160, (g, w, h) => {
    g.font = 'bold 96px Impact, Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 30;
    g.lineWidth = 10; g.strokeStyle = color; g.strokeText(text, w / 2, h / 2);
    g.shadowBlur = 10; g.lineWidth = 4; g.strokeStyle = '#fff'; g.strokeText(text, w / 2, h / 2);
  });
}

// Far city skyline: dark silhouettes with a few lit windows.
export function skylineTexture() {
  const t = canvas(2048, 256, (g, w, h) => {
    const r = rng(21);
    for (const [col, base, amp] of [['#6b2a6e', 120, 110], ['#43204f', 70, 150]]) {
      g.fillStyle = col;
      let x = 0;
      while (x < w) {
        const bw = 40 + r() * 90, bh = base + r() * amp;
        g.fillRect(x, h - bh, bw, bh);
        if (r() < 0.25) g.fillRect(x + bw / 2 - 3, h - bh - 30, 6, 30); // antenna
        if (col === '#43204f') {
          g.fillStyle = 'rgba(255,217,138,0.7)';
          for (let k = 0; k < 6; k++) g.fillRect(x + 6 + r() * (bw - 14), h - bh + 10 + r() * (bh - 20), 5, 7);
          g.fillStyle = col;
        }
        x += bw + r() * 6;
      }
    }
  });
  return t;
}

// Retro striped sunset sun.
export function sunTexture() {
  return canvas(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.6, '#ffb347'); gr.addColorStop(1, '#ff5f6d');
    g.fillStyle = gr;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) {
      const y = h * 0.55 + i * 34, th = 6 + i * 3;
      g.fillRect(0, y, w, th);
    }
  });
}

export function cloudTexture(seed) {
  return canvas(512, 192, (g, w, h) => {
    const r = rng(seed);
    const puffs = [];
    for (let i = 0; i < 7; i++) puffs.push([80 + i * 55 + r() * 20, 120 - Math.sin((i / 6) * Math.PI) * 50 - r() * 15, 40 + Math.sin((i / 6) * Math.PI) * 30 + r() * 10]);
    g.fillStyle = '#c45486';
    for (const [x, y, rad] of puffs) { g.beginPath(); g.arc(x, y + 8, rad, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffb3a7';
    for (const [x, y, rad] of puffs) { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#c45486'; g.fillRect(40, 150, 440, 40);
    g.clearRect(0, 168, w, h);
  });
}

// Yellow and black stripes for the crowd barrier.
export function stripeTexture() {
  const t = canvas(256, 32, (g, w, h) => {
    g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1b1b';
    for (let x = -h; x < w + h; x += 40) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 20, h); g.lineTo(x + 20 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function buildingTexture(seed, base) {
  return canvas(256, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(w - 22, 0, 22, h);
    const cols = 3 + Math.floor(r() * 2), rows = 8;
    const cw = (w - 40) / cols, rh = (h - 60) / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = r() < 0.45;
        g.fillStyle = lit ? '#ffe9a3' : '#2c2540';
        g.fillRect(20 + x * cw + 6, 40 + y * rh + 8, cw - 12, rh - 16);
        g.strokeStyle = '#1a1424'; g.lineWidth = 4;
        g.strokeRect(20 + x * cw + 6, 40 + y * rh + 8, cw - 12, rh - 16);
      }
    }
    g.strokeStyle = '#1a1424'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  });
}

// Kraft-paper dog food bag ("RAÇÃO") with a cartoon dog face.
export function bagTexture() {
  return canvas(256, 320, (g, w, h) => {
    g.fillStyle = '#c8894a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a86c33'; g.fillRect(0, 0, w, 34);
    for (let x = 0; x < w; x += 16) { g.fillStyle = '#8d5626'; g.fillRect(x, 26, 8, 8); }
    g.fillStyle = '#e8402e';
    g.beginPath(); g.ellipse(w / 2, 96, 96, 46, -0.08, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 54px Impact, Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('RAÇÃO', w / 2, 98);
    // Dog face.
    const cx = w / 2, cy = 214;
    g.fillStyle = '#6b3d1c';
    g.beginPath(); g.ellipse(cx - 52, cy - 30, 22, 40, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + 52, cy - 30, 22, 40, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f5d7a8';
    g.beginPath(); g.arc(cx, cy, 52, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222';
    g.beginPath(); g.arc(cx - 18, cy - 10, 7, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 18, cy - 10, 7, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx, cy + 12, 13, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff6f91';
    g.beginPath(); g.ellipse(cx + 4, cy + 34, 9, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222'; g.font = 'bold 20px Arial, sans-serif';
    g.fillText('SABOR CARNE 15kg', w / 2, 296);
    g.strokeStyle = '#5a3412'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
}

// Comic-book impact burst with a word in the middle.
export function burstTexture(word, fill, stroke) {
  return canvas(256, 256, (g, w, h) => {
    const cx = w / 2, cy = h / 2, n = 12;
    g.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const rad = i % 2 ? 62 : 120;
      g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    g.closePath();
    g.fillStyle = fill; g.fill();
    g.lineWidth = 8; g.strokeStyle = stroke; g.stroke();
    if (word) {
      g.font = 'bold 58px Impact, Arial Black, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#1b1b1b'; g.strokeText(word, cx, cy + 2);
      g.fillStyle = '#fff'; g.fillText(word, cx, cy + 2);
    }
  });
}

export function glowTexture(color) {
  return canvas(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// Cartoon flame tongue (white-hot core, orange edge).
export function flameTexture() {
  return canvas(128, 192, (g, w, h) => {
    const shape = (sc, col) => {
      g.save(); g.translate(w / 2, h * 0.92); g.scale(sc, sc);
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(-60, -10, -50, -90, -10, -120);
      g.bezierCurveTo(-18, -80, 10, -90, 0, -170);
      g.bezierCurveTo(40, -120, 60, -60, 50, -30);
      g.bezierCurveTo(45, -8, 25, 0, 0, 0);
      g.fillStyle = col; g.fill(); g.restore();
    };
    shape(1, 'rgba(255,90,20,0.95)');
    shape(0.72, 'rgba(255,190,40,1)');
    shape(0.42, 'rgba(255,250,210,1)');
  });
}

export function shadowTexture() {
  return glowTexture('rgba(0,0,0,0.55)');
}

// Billboard ads in the background.
export function billboardTexture(kind, canImg) {
  return canvas(1024, 512, (g, w, h) => {
    if (kind === 'garra') {
      g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, w, h);
      if (canImg) {
        g.save(); g.translate(260, 256); g.rotate(-0.12);
        g.drawImage(canImg, -230, -115, 460, 230);
        g.restore();
      }
      g.font = 'bold 120px Impact, Arial Black, sans-serif'; g.fillStyle = '#7dff1a';
      g.textAlign = 'center'; g.fillText('GARRA', 760, 230);
      g.font = 'bold 44px Arial Black, Arial, sans-serif'; g.fillStyle = '#fff';
      g.fillText('ENERGIA QUE ARRANHA', 740, 310);
    } else {
      g.fillStyle = '#ffcf33'; g.fillRect(0, 0, w, h);
      g.font = 'bold 110px Impact, Arial Black, sans-serif'; g.fillStyle = '#e8402e';
      g.textAlign = 'center'; g.fillText('RAÇÃO TOP', w / 2, 200);
      g.font = 'bold 50px Arial Black, Arial, sans-serif'; g.fillStyle = '#5a3412';
      g.fillText('O CACHORRO APROVA! 🐶', w / 2, 300);
    }
    g.strokeStyle = '#1a1424'; g.lineWidth = 24; g.strokeRect(0, 0, w, h);
  });
}

export function loadImage(url) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}
