import { describe, it, expect } from 'vitest'
import { buildNoteGraph, getBacklinks, getConnections, findShortestPath } from '../src/graph'
import { ParsedNote, Slug } from '../src/types'

describe('buildNoteGraph', () => {
  const createNote = (slug: string, linksTo: string[] = [], title?: string): ParsedNote => ({
    slug: slug as Slug,
    html: '',
    metadata: title ? { title } : {},
    linksTo
  })

  describe('Basic graph building', () => {
    it('should build a simple graph with forward links', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c'], 'Note A'),
        createNote('b', ['c'], 'Note B'),
        createNote('c', [], 'Note C')
      ]

      const graph = buildNoteGraph(notes)

      expect(graph.nodes.size).toBe(3)
      expect(graph.edges.length).toBe(3) // a->b, a->c, b->c
      expect(graph.orphans.size).toBe(0)
    })

    it('should track backlinks correctly', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c']),
        createNote('b', ['c']),
        createNote('c', [])
      ]

      const graph = buildNoteGraph(notes)

      expect(Array.from(graph.backlinks.get('a')!)).toEqual([])
      expect(Array.from(graph.backlinks.get('b')!)).toEqual(['a'])
      expect(Array.from(graph.backlinks.get('c')!)).toEqual(['a', 'b'])
    })

    it('should identify orphaned notes', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', ['c']),
        createNote('c', []),
        createNote('orphan', [])
      ]

      const graph = buildNoteGraph(notes)

      expect(graph.orphans.has('orphan')).toBe(true)
      expect(graph.orphans.size).toBe(1)
    })

    it('should handle self-links', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['a', 'b']),
        createNote('b', [])
      ]

      const graph = buildNoteGraph(notes)

      expect(graph.edges.some(e => e.source === 'a' && e.target === 'a')).toBe(true)
      expect(graph.backlinks.get('a')!.has('a')).toBe(true)
    })

    it('should ignore links to non-existent notes', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'non-existent']),
        createNote('b', [])
      ]

      const graph = buildNoteGraph(notes)

      expect(graph.edges.length).toBe(1) // Only a->b
      expect(graph.edges[0]).toEqual({ source: 'a', target: 'b' })
    })
  })

  describe('Graph options', () => {
    it('should exclude orphans when includeOrphans is false', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', []),
        createNote('orphan', [])
      ]

      const graph = buildNoteGraph(notes, { includeOrphans: false })

      expect(graph.nodes.has('orphan')).toBe(false)
      expect(graph.nodes.size).toBe(2)
    })

    it('should create bidirectional edges when enabled', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', [])
      ]

      const graph = buildNoteGraph(notes, { bidirectional: true })

      expect(graph.edges.length).toBe(2)
      expect(graph.edges).toContainEqual({ source: 'a', target: 'b' })
      expect(graph.edges).toContainEqual({ source: 'b', target: 'a' })
    })

    it('should filter nodes by minimum connections', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c', 'd']), // 3 forward links
        createNote('b', ['c']), // 1 forward + 1 back = 2 total
        createNote('c', []), // 0 forward + 2 back = 2 total
        createNote('d', []) // 0 forward + 1 back = 1 total
      ]

      const graph = buildNoteGraph(notes, { minimumConnections: 2 })

      expect(graph.nodes.has('a')).toBe(true)
      expect(graph.nodes.has('b')).toBe(true)
      expect(graph.nodes.has('c')).toBe(true)
      expect(graph.nodes.has('d')).toBe(false)
    })

    it('should recompute backlinks and counts after filtering nodes', () => {
      const notes: ParsedNote[] = [
        createNote('a', []),
        createNote('b', ['a']),
        createNote('c', ['a'])
      ]

      const graph = buildNoteGraph(notes, { minimumConnections: 2 })

      expect(graph.nodes.has('b')).toBe(false)
      expect(graph.nodes.has('c')).toBe(false)
      expect(graph.backlinks.has('b')).toBe(false)
      expect(getBacklinks('a', graph)).toEqual([])

      const nodeA = graph.nodes.get('a')!
      expect(nodeA.backlinkCount).toBe(0)
      expect(nodeA.forwardLinkCount).toBe(0)
      expect(nodeA.linkCount).toBe(0)

      expect(graph.edges.length).toBe(0)
      expect(graph.orphans.has('a')).toBe(true)
    })
  })

  describe('Node statistics', () => {
    it('should calculate link counts correctly', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c']),
        createNote('b', ['a']),
        createNote('c', [])
      ]

      const graph = buildNoteGraph(notes)

      const nodeA = graph.nodes.get('a')!
      expect(nodeA.forwardLinkCount).toBe(2)
      expect(nodeA.backlinkCount).toBe(1)
      expect(nodeA.linkCount).toBe(3)

      const nodeC = graph.nodes.get('c')!
      expect(nodeC.forwardLinkCount).toBe(0)
      expect(nodeC.backlinkCount).toBe(1)
      expect(nodeC.linkCount).toBe(1)
    })
  })
})

describe('getBacklinks', () => {
  const createNote = (slug: string, linksTo: string[] = []): ParsedNote => ({
    slug: slug as Slug,
    html: '',
    metadata: {},
    linksTo
  })

  it('should return correct backlinks for a note', () => {
    const notes: ParsedNote[] = [
      createNote('a', ['c']),
      createNote('b', ['c']),
      createNote('c', ['d']),
      createNote('d', [])
    ]

    const graph = buildNoteGraph(notes)

    expect(getBacklinks('c', graph)).toEqual(['a', 'b'])
    expect(getBacklinks('a', graph)).toEqual([])
    expect(getBacklinks('non-existent', graph)).toEqual([])
  })
})

describe('getConnections', () => {
  const createNote = (slug: string, linksTo: string[] = []): ParsedNote => ({
    slug: slug as Slug,
    html: '',
    metadata: {},
    linksTo
  })

  it('should return forward and backward connections', () => {
    const notes: ParsedNote[] = [
      createNote('a', ['b', 'c']),
      createNote('b', ['c']),
      createNote('c', ['a']),
      createNote('d', ['a'])
    ]

    const graph = buildNoteGraph(notes)
    const connections = getConnections('a', graph)

    expect(connections.forward).toEqual(['b', 'c'])
    expect(connections.backward).toEqual(['c', 'd'])
  })

  it('should return empty arrays for non-existent note', () => {
    const notes: ParsedNote[] = [createNote('a', [])]
    const graph = buildNoteGraph(notes)
    const connections = getConnections('non-existent', graph)

    expect(connections.forward).toEqual([])
    expect(connections.backward).toEqual([])
  })
})

describe('findShortestPath', () => {
  const createNote = (slug: string, linksTo: string[] = []): ParsedNote => ({
    slug: slug as Slug,
    html: '',
    metadata: {},
    linksTo
  })

  it('should find shortest path between connected notes', () => {
    const notes: ParsedNote[] = [
      createNote('a', ['b', 'c']),
      createNote('b', ['d']),
      createNote('c', ['d']),
      createNote('d', ['e']),
      createNote('e', [])
    ]

    const graph = buildNoteGraph(notes)

    const path = findShortestPath('a', 'e', graph)
    expect(path).toEqual(['a', 'b', 'd', 'e'])
  })

  it('should return null for disconnected notes', () => {
    const notes: ParsedNote[] = [
      createNote('a', ['b']),
      createNote('b', []),
      createNote('c', ['d']),
      createNote('d', [])
    ]

    const graph = buildNoteGraph(notes)

    expect(findShortestPath('a', 'c', graph)).toBe(null)
  })

  it('should handle self-path', () => {
    const notes: ParsedNote[] = [createNote('a', [])]
    const graph = buildNoteGraph(notes)

    expect(findShortestPath('a', 'a', graph)).toEqual(['a'])
  })

  it('should return null for non-existent notes', () => {
    const notes: ParsedNote[] = [createNote('a', [])]
    const graph = buildNoteGraph(notes)

    expect(findShortestPath('a', 'non-existent', graph)).toBe(null)
    expect(findShortestPath('non-existent', 'a', graph)).toBe(null)
  })

  it('should find path in cyclic graph', () => {
    const notes: ParsedNote[] = [
      createNote('a', ['b']),
      createNote('b', ['c']),
      createNote('c', ['a', 'd']),
      createNote('d', [])
    ]

    const graph = buildNoteGraph(notes)

    const path = findShortestPath('a', 'd', graph)
    expect(path).toEqual(['a', 'b', 'c', 'd'])
  })
})
