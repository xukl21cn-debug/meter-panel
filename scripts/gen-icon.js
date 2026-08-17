/**
 * 生成应用图标 build/icon.png (256x256, 纯 Node 无依赖)
 * 设计: 深蓝圆角底 + 琥珀色脉冲曲线 + 青色基线, 呼应面板的仪表盘风格
 */
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const W = 256
const H = 256
const px = Buffer.alloc(W * H * 4) // RGBA

function set(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = a
}

// 背景: 深蓝圆角矩形
const RADIUS = 46
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const cx = Math.min(x, W - 1 - x)
    const cy = Math.min(y, H - 1 - y)
    let inside = true
    if (cx < RADIUS && cy < RADIUS) {
      inside = (RADIUS - cx) ** 2 + (RADIUS - cy) ** 2 <= RADIUS * RADIUS
    }
    if (inside) set(x, y, 10, 17, 32)
  }
}

// 细网格线
for (let y = 64; y < 196; y += 22) {
  for (let x = 32; x < 224; x++) set(x, y, 28, 42, 66)
}

// 琥珀色脉冲曲线
for (let x = 32; x < 224; x++) {
  const t = (x - 32) / 192
  const y = 190 - Math.round(96 * (0.5 * t + 0.42 * Math.sin(t * Math.PI * 3.2) * (1 - t) + 0.06))
  for (let dy = -2; dy <= 2; dy++) set(x, y + dy, 255, 180, 84)
}

// 青色基线
for (let x = 32; x < 224; x++) set(x, 196, 79, 195, 247)

// 顶部两个小圆点(表计指示灯)
for (let dx = -5; dx <= 5; dx++) {
  for (let dy = -5; dy <= 5; dy++) {
    if (dx * dx + dy * dy <= 25) set(64 + dx, 78 + dy, 52, 211, 153)
    if (dx * dx + dy * dy <= 25) set(192 + dx, 78 + dy, 79, 195, 247)
  }
}

// ---- PNG 编码 (zlib 内置于 Node) ----
const CRC_TABLE = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePNG(width, height, rgba) {
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const outDir = path.join(__dirname, '..', 'build')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'icon.png')
fs.writeFileSync(out, encodePNG(W, H, px))
console.log('icon generated:', out)
