import { describe, expect, it } from 'vitest'

import { splitCommandArgs } from '../src/cli.ts'

describe('splitCommandArgs', () => {
  it('returns undefined when no command is present', () => {
    expect(splitCommandArgs(['--cwd', '/tmp'])).toBeUndefined()
    expect(splitCommandArgs([])).toBeUndefined()
  })

  it('splits a build command with a passthrough command', () => {
    expect(splitCommandArgs(['build', 'node', 'dist/index.mjs'])).toEqual({
      kind: 'build',
      head: [],
      passthrough: ['node', 'dist/index.mjs'],
      watchMode: false,
    })
  })

  it('splits options before the build command into head', () => {
    expect(splitCommandArgs(['--cwd', '/tmp', 'build', 'tsx', 'src/index.ts'])).toEqual({
      kind: 'build',
      head: ['--cwd', '/tmp'],
      passthrough: ['tsx', 'src/index.ts'],
      watchMode: false,
    })
  })

  it('peels monocon options placed after the build command into head', () => {
    expect(
      splitCommandArgs(['build', '--cwd', '/tmp', '--config', 'x.ts', 'node', 'a.js']),
    ).toEqual({
      kind: 'build',
      head: ['--cwd', '/tmp', '--config', 'x.ts'],
      passthrough: ['node', 'a.js'],
      watchMode: false,
    })
  })

  it('supports --cwd=value form after the command', () => {
    expect(splitCommandArgs(['build', '--cwd=/tmp', 'node', 'a.js'])).toEqual({
      kind: 'build',
      head: ['--cwd=/tmp'],
      passthrough: ['node', 'a.js'],
      watchMode: false,
    })
  })

  it('leaves unknown flags in passthrough for the child command', () => {
    expect(splitCommandArgs(['build', 'node', 'a.js', '--flag'])).toEqual({
      kind: 'build',
      head: [],
      passthrough: ['node', 'a.js', '--flag'],
      watchMode: false,
    })
  })

  it('splits a gen command with a passthrough command', () => {
    expect(splitCommandArgs(['gen', 'tsx', 'watch', 'src/index.ts'])).toEqual({
      kind: 'gen',
      head: [],
      passthrough: ['tsx', 'watch', 'src/index.ts'],
      watchMode: false,
    })
  })

  it('detects --watch after the gen command and strips it from passthrough', () => {
    expect(splitCommandArgs(['gen', '--watch', 'tsx', 'src/index.ts'])).toEqual({
      kind: 'gen',
      head: [],
      passthrough: ['tsx', 'src/index.ts'],
      watchMode: true,
    })
  })

  it('detects --watch before the gen command and strips it from head', () => {
    expect(splitCommandArgs(['--watch', 'gen', 'tsx', 'src/index.ts'])).toEqual({
      kind: 'gen',
      head: [],
      passthrough: ['tsx', 'src/index.ts'],
      watchMode: true,
    })
  })

  it('uses the first occurring command when both appear in passthrough', () => {
    expect(splitCommandArgs(['gen', 'npm', 'run', 'build'])).toEqual({
      kind: 'gen',
      head: [],
      passthrough: ['npm', 'run', 'build'],
      watchMode: false,
    })
  })
})
