// 零依赖冒烟：lib/assets 六个素材齐全、体积与 SHA256 与发布基线一致。
// 任何素材被替换/裁剪/重压都会在这里失败；重制素材后需同步更新 BASELINE。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'lib', 'assets')

const BASELINE = {
  'bg-1080.mp4': { bytes: 11071331, sha256: 'B2DC3B2263CDAC4374ACBCC8FD52C67C00376E13C244E79FFA3CB65360AFA954' },
  'bg-ambient.mp4': { bytes: 344878, sha256: '53BAE6FD21A79BEDB2DB4800AAF1604DC3351F2F4E4ABE17FDEA65B3A290A0E2' },
  'bg-poster-blur.jpg': { bytes: 6928, sha256: '3C4F99F37F8D6DC56580F682ABEB4AC51894BC2F623219DDA8D6C684E5B93796' },
  'bg-poster.jpg': { bytes: 266351, sha256: '9AF32F28D2EBCA8C97E460545A26AFD35E6965BAE207354318FECA2506103366' },
  'jarvis-boot.mp4': { bytes: 44660257, sha256: 'D24E78E481A31B37A3A65A28CC7930B432E93FDE4714FDB9885E657C217228F8' },
  'poster.jpg': { bytes: 198146, sha256: '194D9D2BD7B4CAE13E9EFF87246308633DE1CB9B29E3C26AC1C559686DF14F68' }
}

const present = (await readdir(assets)).sort()
assert.deepEqual(present, Object.keys(BASELINE).sort(), 'lib/assets should contain exactly the six published assets')

for (const [name, want] of Object.entries(BASELINE)) {
  const buf = await readFile(path.join(assets, name))
  assert.equal(buf.length, want.bytes, `${name}: size`)
  const digest = createHash('sha256').update(buf).digest('hex').toUpperCase()
  assert.equal(digest, want.sha256, `${name}: sha256`)
}

const total = Object.values(BASELINE).reduce((n, v) => n + v.bytes, 0)
console.log(`smoke-assets: PASS (${present.length} assets, ${(total / 1048576).toFixed(2)} MiB, sha256 all match)`)
