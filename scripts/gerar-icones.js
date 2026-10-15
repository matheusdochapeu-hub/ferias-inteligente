#!/usr/bin/env node
/* ============================================================================
 * GERADOR DE ÍCONES PWA (PNG) — sem dependências externas
 * -----------------------------------------------------------------------------
 * O ambiente não tem ImageMagick/rsvg/sharp e o npm está bloqueado, então
 * geramos os PNG do zero: desenhamos o ícone num buffer RGBA e serializamos
 * um PNG válido usando apenas `zlib` (embutido no Node).
 *
 * O desenho é a "praia" do app: céu/mar em gradiente azul (tema #1565c0 /
 * #0d47a1), faixa de areia dourada embaixo, um sol e uma sombrinha — casando
 * com o emoji 🏖️ do cabeçalho. Mantém margem de segurança para o recorte
 * "maskable" (ícone circular de alguns launchers Android).
 *
 * Uso:  node scripts/gerar-icones.js
 * Gera: icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png
 * ===========================================================================*/
"use strict";
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ---- helpers de cor / desenho ------------------------------------------------
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

/* Desenha o ícone num buffer RGBA de lado `S`. `pad` é a margem de segurança
 * (fração do lado) usada na versão maskable, onde o conteúdo precisa caber num
 * círculo central. Retorna um Buffer de S*S*4 bytes. */
function desenhar(S, pad) {
  const buf = Buffer.alloc(S * S * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    // alpha-composite simples sobre o que já existe
    const af = a / 255, ab = buf[i + 3] / 255, ao = af + ab * (1 - af);
    if (ao === 0) return;
    buf[i]   = Math.round((r * af + buf[i]   * ab * (1 - af)) / ao);
    buf[i+1] = Math.round((g * af + buf[i+1] * ab * (1 - af)) / ao);
    buf[i+2] = Math.round((b * af + buf[i+2] * ab * (1 - af)) / ao);
    buf[i+3] = Math.round(ao * 255);
  };

  // área útil (deixa `pad` de margem para o recorte maskable)
  const m = Math.round(S * pad);
  const x0 = m, y0 = m, side = S - 2 * m;

  // cantos arredondados do "cartão" de fundo (raio ~22% do lado)
  const radius = side * 0.22;
  const dentro = (px, py) => {
    const lx = px - x0, ly = py - y0;
    if (lx < 0 || ly < 0 || lx >= side || ly >= side) return false;
    // cantos
    const rx = Math.min(lx, side - 1 - lx);
    const ry = Math.min(ly, side - 1 - ly);
    if (rx < radius && ry < radius) {
      const dx = radius - rx, dy = radius - ry;
      return dx * dx + dy * dy <= radius * radius;
    }
    return true;
  };

  const CEU_TOPO = [0x42, 0x9b, 0xf5];   // azul claro (céu)
  const MAR      = [0x0d, 0x47, 0xa1];   // azul escuro (tema)
  const AREIA_T  = [0xff, 0xe0, 0x9a];   // areia clara
  const AREIA_B  = [0xf5, 0xc3, 0x6b];   // areia dourada
  const linhaAreia = y0 + side * 0.72;   // onde começa a areia

  // 1) fundo: gradiente céu->mar; areia na faixa de baixo
  for (let y = y0; y < y0 + side; y++) {
    for (let x = x0; x < x0 + side; x++) {
      if (!dentro(x, y)) continue;
      if (y < linhaAreia) {
        const t = (y - y0) / (linhaAreia - y0);
        const c = mix(CEU_TOPO, MAR, t);
        set(x, y, c[0], c[1], c[2], 255);
      } else {
        const t = (y - linhaAreia) / (y0 + side - linhaAreia);
        const c = mix(AREIA_T, AREIA_B, t);
        set(x, y, c[0], c[1], c[2], 255);
      }
    }
  }

  // 2) sol (círculo amarelo com leve halo), canto superior direito
  const solX = x0 + side * 0.72, solY = y0 + side * 0.28, solR = side * 0.12;
  for (let y = Math.floor(solY - solR * 2); y <= solY + solR * 2; y++) {
    for (let x = Math.floor(solX - solR * 2); x <= solX + solR * 2; x++) {
      if (!dentro(x, y)) continue;
      const d = Math.hypot(x - solX, y - solY);
      if (d <= solR) set(x, y, 0xff, 0xd5, 0x4f, 255);
      else if (d <= solR * 1.6) {
        const a = Math.round(120 * (1 - (d - solR) / (solR * 0.6)));
        if (a > 0) set(x, y, 0xff, 0xe2, 0x8a, a);
      }
    }
  }

  // 3) sombrinha de praia (meio-círculo) com haste
  const guX = x0 + side * 0.40, guY = y0 + side * 0.56, guR = side * 0.26;
  // haste
  for (let y = guY; y < linhaAreia + side * 0.06; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.round(guX + (y - guY) * 0.06) + dx; // leve inclinação
      set(xx, Math.round(y), 0x5d, 0x40, 0x37, 255);
    }
  }
  // cúpula (semicírculo superior) em gomos vermelho/branco
  for (let y = Math.floor(guY - guR); y <= guY; y++) {
    for (let x = Math.floor(guX - guR); x <= guX + guR; x++) {
      if (!dentro(x, y)) continue;
      const d = Math.hypot(x - guX, y - guY);
      if (d <= guR && y <= guY) {
        const ang = Math.atan2(y - guY, x - guX); // -PI..0 no semicírculo de cima
        const gomo = Math.floor(((ang + Math.PI) / Math.PI) * 6) % 2;
        const c = gomo === 0 ? [0xe5, 0x3935] : null;
        if (c) set(x, y, 0xe5, 0x39, 0x35, 255);
        else set(x, y, 0xff, 0xff, 0xff, 255);
      }
    }
  }
  // ponta da sombrinha
  for (let y = Math.floor(guY - guR - side * 0.03); y < guY - guR + 2; y++) {
    set(Math.round(guX), y, 0x5d, 0x40, 0x37, 255);
  }

  return buf;
}

// ---- serialização PNG (RGBA, sem filtro) -------------------------------------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function toPNG(S, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // scanlines com byte de filtro 0
  const raw = Buffer.alloc(S * (S * 4 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0;
    rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- gera os arquivos --------------------------------------------------------
const outDir = path.join(__dirname, "..", "icons");
fs.mkdirSync(outDir, { recursive: true });
const alvos = [
  { nome: "icon-192.png", S: 192, pad: 0.0 },
  { nome: "icon-512.png", S: 512, pad: 0.0 },
  // maskable: conteúdo recuado para sobreviver ao recorte circular
  { nome: "icon-maskable-512.png", S: 512, pad: 0.12 },
];
for (const a of alvos) {
  const png = toPNG(a.S, desenhar(a.S, a.pad));
  fs.writeFileSync(path.join(outDir, a.nome), png);
  console.log(`gerado icons/${a.nome} (${a.S}x${a.S}, ${png.length} bytes)`);
}
