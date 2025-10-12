import { describe, it, expect } from 'vitest'
import { buildNoteGraph } from '../src/graph'
import {
  findOrphanedNotes,
  findMostLinkedNotes,
  findMostReferencedNotes,
  calculateCentrality,
  getConnectedComponents,
  getGraphStatistics,
  findHubs,
  findAuthorities,
  getNeighborhood
} from '../src/graphAnalysis'
import { ParsedNote, Slug } from '../src/types'

describe('graphAnalysis', () => {
  const createNote = (slug: string, linksTo: string[] = [], title?: string): ParsedNote => ({
    slug: slug as Slug,
    html: '',
    metadata: title ? { title } : {},
    linksTo
  })

  describe('findOrphanedNotes', () => {
    it('should find notes with no connections', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', ['a']),
        createNote('orphan1', []),
        createNote('orphan2', [])
      ]

      const graph = buildNoteGraph(notes)
      const orphans = findOrphanedNotes(graph)

      expect(orphans.sort()).toEqual(['orphan1', 'orphan2'])
    })
  })

  describe('findMostLinkedNotes', () => {
    it('should return notes sorted by total link count', () => {
      const notes: ParsedNote[] = [
        createNote('popular', [], 'Popular'),
        createNote('a', ['popular'], 'A'),
        createNote('b', ['popular', 'a'], 'B'),
        createNote('c', ['popular', 'a', 'b'], 'C'),
        createNote('isolated', [], 'Isolated')
      ]

      const graph = buildNoteGraph(notes)
      const mostLinked = findMostLinkedNotes(graph, 3)

      expect(mostLinked[0].id).toBe('popular')
      expect(mostLinked[0].linkCount).toBe(3) // 3 backlinks
      expect(mostLinked[1].id).toBe('a')
      expect(mostLinked[1].linkCount).toBe(3) // 1 forward + 2 back
      expect(mostLinked[2].id).toBe('b')
      expect(mostLinked[2].linkCount).toBe(3) // 2 forward + 1 back
    })

    it('should limit results based on parameter', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c']),
        createNote('b', ['c']),
        createNote('c', []),
        createNote('d', [])
      ]

      const graph = buildNoteGraph(notes)
      const top2 = findMostLinkedNotes(graph, 2)

      expect(top2.length).toBe(2)
    })
  })

  describe('findMostReferencedNotes', () => {
    it('should return notes sorted by backlink count', () => {
      const notes: ParsedNote[] = [
        createNote('target', []),
        createNote('a', ['target']),
        createNote('b', ['target']),
        createNote('c', ['target', 'other']),
        createNote('other', [])
      ]

      const graph = buildNoteGraph(notes)
      const mostReferenced = findMostReferencedNotes(graph, 2)

      expect(mostReferenced[0].id).toBe('target')
      expect(mostReferenced[0].backlinkCount).toBe(3)
      expect(mostReferenced[1].id).toBe('other')
      expect(mostReferenced[1].backlinkCount).toBe(1)
    })
  })

  describe('calculateCentrality', () => {
    it('should calculate degree centrality correctly', () => {
      const notes: ParsedNote[] = [
        createNote('central', ['a', 'b']),
        createNote('a', ['central']),
        createNote('b', ['central']),
        createNote('isolated', [])
      ]

      const graph = buildNoteGraph(notes)
      const centrality = calculateCentrality(graph)

      // Central node has 4 connections (2 forward, 2 back) out of 3 possible
      // Since 4/3 > 1, it should be capped at 1
      expect(centrality.get('central')).toBe(1)
      
      // A and B each have 2 connections out of 3 possible
      expect(centrality.get('a')).toBeCloseTo(2/3, 2)
      expect(centrality.get('b')).toBeCloseTo(2/3, 2)
      
      // Isolated has 0 connections
      expect(centrality.get('isolated')).toBe(0)
    })

    it('should handle single node graph', () => {
      const notes: ParsedNote[] = [createNote('single', [])]
      const graph = buildNoteGraph(notes)
      const centrality = calculateCentrality(graph)

      expect(centrality.get('single')).toBe(0)
    })
  })

  describe('getConnectedComponents', () => {
    it('should find separate components', () => {
      const notes: ParsedNote[] = [
        // Component 1
        createNote('a', ['b']),
        createNote('b', ['c']),
        createNote('c', ['a']),
        // Component 2
        createNote('d', ['e']),
        createNote('e', []),
        // Component 3 (isolated)
        createNote('f', [])
      ]

      const graph = buildNoteGraph(notes)
      const components = getConnectedComponents(graph)

      expect(components.length).toBe(3)
      expect(components[0].sort()).toEqual(['a', 'b', 'c'])
      expect(components[1].sort()).toEqual(['d', 'e'])
      expect(components[2]).toEqual(['f'])
    })

    it('should treat links as undirected for component detection', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', []),
        createNote('c', ['b'])
      ]

      const graph = buildNoteGraph(notes)
      const components = getConnectedComponents(graph)

      // All nodes should be in same component despite directed links
      expect(components.length).toBe(1)
      expect(components[0].sort()).toEqual(['a', 'b', 'c'])
    })
  })

  describe('getGraphStatistics', () => {
    it('should calculate comprehensive statistics', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c']),
        createNote('b', ['c']),
        createNote('c', []),
        createNote('orphan', [])
      ]

      const graph = buildNoteGraph(notes)
      const stats = getGraphStatistics(graph)

      expect(stats.nodeCount).toBe(4)
      expect(stats.edgeCount).toBe(3)
      expect(stats.orphanCount).toBe(1)
      expect(stats.averageConnections).toBe(1.5) // (2+2+2+0)/4
      expect(stats.maxConnections).toBe(2)
      expect(stats.componentCount).toBe(2)
      expect(stats.largestComponentSize).toBe(3)
      expect(stats.density).toBeCloseTo(3/12, 2) // 3 edges / (4*3) possible
    })

    it('should handle empty graph', () => {
      const graph = buildNoteGraph([])
      const stats = getGraphStatistics(graph)

      expect(stats.nodeCount).toBe(0)
      expect(stats.edgeCount).toBe(0)
      expect(stats.averageConnections).toBe(0)
      expect(stats.density).toBe(0)
    })
  })

  describe('findHubs', () => {
    it('should find notes with many outgoing links', () => {
      const notes: ParsedNote[] = [
        createNote('hub1', ['a', 'b', 'c', 'd', 'e']),
        createNote('hub2', ['a', 'b', 'c']),
        createNote('normal', ['a']),
        createNote('a', []),
        createNote('b', []),
        createNote('c', []),
        createNote('d', []),
        createNote('e', [])
      ]

      const graph = buildNoteGraph(notes)
      const hubs = findHubs(graph, 3)

      expect(hubs.length).toBe(2)
      expect(hubs[0].id).toBe('hub1')
      expect(hubs[0].forwardLinkCount).toBe(5)
      expect(hubs[1].id).toBe('hub2')
      expect(hubs[1].forwardLinkCount).toBe(3)
    })
  })

  describe('findAuthorities', () => {
    it('should find notes with many incoming links', () => {
      const notes: ParsedNote[] = [
        createNote('authority', []),
        createNote('a', ['authority']),
        createNote('b', ['authority']),
        createNote('c', ['authority']),
        createNote('d', ['authority']),
        createNote('e', ['authority'])
      ]

      const graph = buildNoteGraph(notes)
      const authorities = findAuthorities(graph, 5)

      expect(authorities.length).toBe(1)
      expect(authorities[0].id).toBe('authority')
      expect(authorities[0].backlinkCount).toBe(5)
    })
  })

  describe('getNeighborhood', () => {
    it('should find direct neighbors', () => {
      const notes: ParsedNote[] = [
        createNote('center', ['a', 'b']),
        createNote('a', ['c']),
        createNote('b', []),
        createNote('c', ['center']),
        createNote('d', ['center'])
      ]

      const graph = buildNoteGraph(notes)
      const neighbors = getNeighborhood('center', graph, 1)

      expect(Array.from(neighbors).sort()).toEqual(['a', 'b', 'c', 'd'])
    })

    it('should find multi-hop neighbors', () => {
      const notes: ParsedNote[] = [
        createNote('start', ['a']),
        createNote('a', ['b']),
        createNote('b', ['c']),
        createNote('c', []),
        createNote('d', ['start'])
      ]

      const graph = buildNoteGraph(notes)
      
      const depth1 = getNeighborhood('start', graph, 1)
      expect(Array.from(depth1).sort()).toEqual(['a', 'd'])
      
      const depth2 = getNeighborhood('start', graph, 2)
      expect(Array.from(depth2).sort()).toEqual(['a', 'b', 'd'])
      
      const depth3 = getNeighborhood('start', graph, 3)
      expect(Array.from(depth3).sort()).toEqual(['a', 'b', 'c', 'd'])
    })

    it('should handle non-existent node', () => {
      const graph = buildNoteGraph([createNote('a', [])])
      const neighbors = getNeighborhood('non-existent', graph)

      expect(neighbors.size).toBe(0)
    })
  })
})
