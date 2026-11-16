import { describe, expect, it } from 'vitest'
import { importCsv } from '../../src/sync/importCsv'

describe('CSV import', () => {
  it('parses Bitwarden-like CSV and detects duplicates', () => {
    const csv = `name,login_username,login_password,login_uri,notes\nGitHub,alice,secret,https://github.com,\n`
    const p = importCsv(csv, [{ title: 'GitHub', username: 'alice', url: 'https://github.com' }])
    expect(p.detectedFormat).toMatch(/Bitwarden/)
    expect(p.records[0]?.duplicateOf).toBeTruthy()
    expect(p.records[0]?.selected).toBe(false)
  })

  it('maps generic columns and removes unsafe URLs', () => {
    const csv = `title,username,password,url\nSite,u,p,javascript:alert(1)\n`
    const p = importCsv(csv)
    expect(p.records[0]?.url).toBe('')
    expect(p.records[0]?.errors.join(' ')).toMatch(/Unsafe/)
  })
})
