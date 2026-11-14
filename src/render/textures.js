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
  const t = canvas(1024, 256, (g, w, h) => {
    g.fillStyle = '#4a4458'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      g.fillRect(r() * w, r() * h, 2 + r() * 4, 2 + r() * 3);
    }
    // Painted fight lines.
    g.fillStyle = '#ffd23f';
    g.fillRect(0, h * 0.18, w, 6);
    g.fillRect(0, h * 0.82, w, 6);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(w / 2 - 4, h * 0.18, 8, h * 0.64);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 8;
    g.beginPath(); g.ellipse(w / 2, h / 2, 90, 60, 0, 0, Math.PI * 2); g.stroke();
    // Cracks.
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      let x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
  });
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
