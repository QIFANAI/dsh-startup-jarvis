// 零依赖冒烟：包元数据、发布文件清单、运行时代码不含本机绝对路径。
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))

assert.equal(pkg.name, 'dsh-startup-jarvis')
assert.equal(pkg.version, '0.3.9')
assert.equal(pkg.license, 'MIT')
assert.equal(pkg.private, undefined, 'public repo: package.json must not be private')
assert.equal(pkg.type, 'module')
assert.equal(pkg.main, 'lib/index.js')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.deepEqual(pkg.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-settings'])
assert.match(pkg.repository.url, /github\.com\/QIFANAI\/dsh-startup-jarvis/)
assert.ok(pkg.files.includes('lib'), 'lib must be published')
assert.equal(pkg.scripts.test, 'node test/smoke-host.mjs && node test/smoke-assets.mjs && node test/smoke-package.mjs')

for (const file of ['cordis.patch.yml', 'README.md', 'INSTALL.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'CHANGELOG.md']) {
  await readFile(path.join(root, file))
}
const patch = await readFile(path.join(root, 'cordis.patch.yml'), 'utf8')
assert.ok(patch.includes('id: dsh-startup-jarvis'), 'bundle patch id')

// 运行时代码不允许写死作者本机路径（会泄露隐私，也说明素材路径不可移植）
const runtime = ['lib/index.js', 'lib/client.js', 'lib/splash.js', 'lib/skin.js', 'lib/splash.css', 'lib/skin.css']
for (const rel of runtime) {
  const text = await readFile(path.join(root, rel), 'utf8')
  assert.ok(!/[A-Za-z]:\\Users\\/.test(text), `${rel}: no Windows user path`)
  assert.ok(!/E:\\dshdesign/.test(text), `${rel}: no local workspace path`)
}

console.log('smoke-package: PASS (metadata, publish whitelist, no local paths)')
