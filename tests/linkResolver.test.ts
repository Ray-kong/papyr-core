import { describe, it, expect } from 'vitest'
import { 
  resolveLinks, 
  findOrphanedLinks, 
  createLinkMaps,
  validateLinks,
  getReachableNotes
} from '../src/linkResolver'
import { ParsedNote, Slug } from '../src/types'

describe('linkResolver', () => {
  const createNote = (slug: string, linksTo: string[] = []): ParsedNote => ({
    slug: slug as Slug,
    html: '',
    metadata: {},
    linksTo
  })

  describe('resolveLinks', () => {
    it('should enrich notes with backlinks', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c']),
        createNote('b', ['c']),
        createNote('c', ['a'])
      ]

      const resolved = resolveLinks(notes)

      expect(resolved.get('a')!.backlinks).toEqual(['c'])
      expect(resolved.get('b')!.backlinks).toEqual(['a'])
      expect(resolved.get('c')!.backlinks).toEqual(['a', 'b'])
    })

    it('should handle notes with no backlinks', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', [])
      ]

      const resolved = resolveLinks(notes)

      expect(resolved.get('a')!.backlinks).toEqual([])
      expect(resolved.get('b')!.backlinks).toEqual(['a'])
    })

    it('should preserve all original note properties', () => {
      const notes: ParsedNote[] = [{
        slug: 'test' as Slug,
        html: '<p>Test</p>',
        metadata: { title: 'Test Note' },
        linksTo: ['other'],
        raw: '# Test',
        excerpt: 'Test excerpt'
      }]

      const resolved = resolveLinks(notes)
      const note = resolved.get('test')!

      expect(note.slug).toBe('test')
      expect(note.html).toBe('<p>Test</p>')
      expect(note.metadata).toEqual({ title: 'Test Note' })
      expect(note.linksTo).toEqual(['other'])
      expect(note.raw).toBe('# Test')
      expect(note.excerpt).toBe('Test excerpt')
    })
  })

  describe('findOrphanedLinks', () => {
    it('should find links to non-existent notes', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'non-existent']),
        createNote('b', ['c', 'missing']),
        createNote('c', [])
      ]

      const orphaned = findOrphanedLinks(notes)

      expect(orphaned.get('a')).toEqual(['non-existent'])
      expect(orphaned.get('b')).toEqual(['missing'])
      expect(orphaned.has('c')).toBe(false)
    })

    it('should return empty map when no orphaned links', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', ['a'])
      ]

      const orphaned = findOrphanedLinks(notes)

      expect(orphaned.size).toBe(0)
    })
  })

  describe('createLinkMaps', () => {
    it('should create forward and backward link maps', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c']),
        createNote('b', ['c']),
        createNote('c', [])
      ]

      const { forward, backward } = createLinkMaps(notes)

      // Check forward links
      expect(Array.from(forward.get('a')!)).toEqual(['b', 'c'])
      expect(Array.from(forward.get('b')!)).toEqual(['c'])
      expect(Array.from(forward.get('c')!)).toEqual([])

      // Check backward links
      expect(Array.from(backward.get('a')!)).toEqual([])
      expect(Array.from(backward.get('b')!)).toEqual(['a'])
      expect(Array.from(backward.get('c')!)).toEqual(['a', 'b'])
    })

    it('should handle duplicate links', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'b', 'c', 'b'])
      ]

      const { forward } = createLinkMaps(notes)

      // Set should deduplicate
      expect(Array.from(forward.get('a')!).sort()).toEqual(['b', 'c'])
    })
  })

  describe('validateLinks', () => {
    it('should provide comprehensive link statistics', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c', 'non-existent', 'b']), // has duplicate
        createNote('b', ['a', 'b']), // has self-link
        createNote('c', [])
      ]

      const stats = validateLinks(notes)

      expect(stats.totalLinks).toBe(6)
      expect(stats.validLinks).toBe(3) // a->b, a->c, b->a
      expect(stats.orphanedLinks).toBe(1) // a->non-existent
      expect(stats.selfLinks).toBe(1) // b->b
      expect(stats.duplicateLinks).toBe(1) // second b in note a

      // Check per-note stats
      const statsA = stats.linksByNote.get('a')!
      expect(statsA.valid).toBe(2)
      expect(statsA.orphaned).toBe(1)
      expect(statsA.duplicate).toBe(1)

      const statsB = stats.linksByNote.get('b')!
      expect(statsB.valid).toBe(1)
      expect(statsB.self).toBe(1)
    })

    it('should handle empty link arrays', () => {
      const notes: ParsedNote[] = [
        createNote('a', []),
        createNote('b', [])
      ]

      const stats = validateLinks(notes)

      expect(stats.totalLinks).toBe(0)
      expect(stats.validLinks).toBe(0)
      expect(stats.orphanedLinks).toBe(0)
    })
  })

  describe('getReachableNotes', () => {
    it('should find all reachable notes from start', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b', 'c']),
        createNote('b', ['d']),
        createNote('c', ['d']),
        createNote('d', ['e']),
        createNote('e', []),
        createNote('isolated', [])
      ]

      const reachable = getReachableNotes('a', notes)

      expect(reachable.has('a')).toBe(true)
      expect(reachable.has('b')).toBe(true)
      expect(reachable.has('c')).toBe(true)
      expect(reachable.has('d')).toBe(true)
      expect(reachable.has('e')).toBe(true)
      expect(reachable.has('isolated')).toBe(false)
    })

    it('should respect max depth', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', ['c']),
        createNote('c', ['d']),
        createNote('d', [])
      ]

      const depth1 = getReachableNotes('a', notes, 1)
      expect(Array.from(depth1).sort()).toEqual(['a', 'b'])

      const depth2 = getReachableNotes('a', notes, 2)
      expect(Array.from(depth2).sort()).toEqual(['a', 'b', 'c'])

      const depth3 = getReachableNotes('a', notes, 3)
      expect(Array.from(depth3).sort()).toEqual(['a', 'b', 'c', 'd'])
    })

    it('should handle cycles', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', ['c']),
        createNote('c', ['a'])
      ]

      const reachable = getReachableNotes('a', notes)

      expect(reachable.size).toBe(3)
      expect(Array.from(reachable).sort()).toEqual(['a', 'b', 'c'])
    })

    it('should return empty set for non-existent start', () => {
      const notes: ParsedNote[] = [
        createNote('a', ['b']),
        createNote('b', [])
      ]

      const reachable = getReachableNotes('non-existent', notes)

      expect(reachable.size).toBe(0)
    })
  })
})
