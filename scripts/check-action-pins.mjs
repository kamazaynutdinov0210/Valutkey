import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = '.github/workflows'
const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
if (files.length === 0) {
  console.error(`No workflow files found in ${dir}`)
  process.exit(1)
}

let bad = 0
for (const file of files) {
  const text = readFileSync(join(dir, file), 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*-?\s*uses:\s*(\S+)/)
    if (!match) continue
    const ref = match[1]
    if (ref.startsWith('./')) continue // local composite action
    const at = ref.lastIndexOf('@')
    const sha = at >= 0 ? ref.slice(at + 1) : ''
    if (!/^[0-9a-f]{40}$/.test(sha)) {
      console.error(`${file}: unpinned action reference "${ref}" (expected @<40-hex sha>)`)
      bad += 1
    }
  }
}

if (bad > 0) {
  console.error(`${bad} unpinned action reference(s) found`)
  process.exit(1)
}
console.log(`All ${files.length} workflow file(s) reference actions by 40-hex commit SHA.`)