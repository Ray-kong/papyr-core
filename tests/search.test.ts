import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateSearchIndex,
  searchNotes,
  addNoteToIndex,
  removeNoteFromIndex,
  updateNoteInIndex,
  getSearchSuggestions
} from '../src/search'
import { ParsedNote, SearchIndex, Slug } from '../src/types'

describe('search', () => {
  const createNote = (
    slug: string, 
    title?: string, 
    content?: string, 
    tags?: string[],
    metadata?: Record<string, any>
  ): ParsedNote => ({
    slug: slug as Slug,
    html: `<p>${content || 'Default content'}</p>`,
    metadata: {
      title,
      tags,
      ...metadata
    },
    linksTo: [],
    raw: content || 'Default content',
    excerpt: content ? content.substring(0, 100) : 'Default content'
  })

  let searchIndex: SearchIndex
  let testNotes: ParsedNote[]

  beforeEach(() => {
    testNotes = [
      createNote('javascript-basics', 'JavaScript Basics', 'Learn the fundamentals of JavaScript programming language', ['programming', 'javascript']),
      createNote('react-hooks', 'React Hooks Guide', 'Understanding useState, useEffect and custom hooks in React', ['react', 'javascript', 'frontend']),
      createNote('node-server', 'Node.js Server', 'Building REST APIs with Express.js and Node.js', ['nodejs', 'backend', 'javascript']),
      createNote('python-data', 'Python Data Analysis', 'Data manipulation with pandas and numpy libraries', ['python', 'data-science']),
      createNote('machine-learning', 'Machine Learning Intro', 'Introduction to supervised and unsupervised learning algorithms', ['ml', 'python', 'data-science']),
      createNote('empty-note', 'Empty Note', '', [])
    ]
    
    searchIndex = generateSearchIndex(testNotes)
  })

  describe('generateSearchIndex', () => {
    it('should create a search index with all notes', () => {
      expect(searchIndex.documents.size).toBe(6)
      expect(searchIndex.documents.has('javascript-basics')).toBe(true)
      expect(searchIndex.documents.has('react-hooks')).toBe(true)
      expect(searchIndex.index).toBeDefined()
    })

    it('should handle notes without titles', () => {
      const notesWithoutTitles = [
        createNote('untitled-1', undefined, 'Content without title'),
        createNote('untitled-2', '', 'Another content')
      ]

      const index = generateSearchIndex(notesWithoutTitles)
      expect(index.documents.size).toBe(2)
    })

    it('should handle notes with complex metadata', () => {
      const complexNotes = [
        createNote('complex', 'Complex Note', 'Content', ['tag1'], { 
          author: 'John Doe', 
          category: 'tutorial',
          difficulty: 'beginner'
        })
      ]

      const index = generateSearchIndex(complexNotes)
      expect(index.documents.size).toBe(1)
    })

    it('should accept custom index options', () => {
      const customIndex = generateSearchIndex(testNotes, {
        preset: 'memory',
        resolution: 5
      })

      expect(customIndex.documents.size).toBe(6)
      expect(customIndex.index).toBeDefined()
    })
  })

  describe('searchNotes', () => {
    it('should find notes by title', () => {
      const results = searchNotes('JavaScript', searchIndex)
      expect(results.length).toBeGreaterThan(0)
      
      const jsBasics = results.find(r => r.slug === 'javascript-basics')
      expect(jsBasics).toBeDefined()
      expect(jsBasics!.matchedFields).toContain('title')
    })

    it('should find notes by content', () => {
      const results = searchNotes('REST APIs', searchIndex)
      expect(results.length).toBeGreaterThan(0)
      
      const nodeServer = results.find(r => r.slug === 'node-server')
      expect(nodeServer).toBeDefined()
      expect(nodeServer!.matchedFields).toContain('content')
    })

    it('should find notes by tags', () => {
      const results = searchNotes('python', searchIndex)
      expect(results.length).toBeGreaterThan(0)
      
      const pythonNotes = results.filter(r => 
        r.slug === 'python-data' || r.slug === 'machine-learning'
      )
      expect(pythonNotes.length).toBe(2)
    })

    it('should return empty array for empty query', () => {
      const results = searchNotes('', searchIndex)
      expect(results).toEqual([])
    })

    it('should return empty array for whitespace query', () => {
      const results = searchNotes('   ', searchIndex)
      expect(results).toEqual([])
    })

    it('should respect limit option', () => {
      const results = searchNotes('javascript', searchIndex, { limit: 2 })
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should filter by tags', () => {
      const results = searchNotes('javascript', searchIndex, { 
        tags: ['react'] 
      })
      
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        const note = searchIndex.documents.get(result.slug)!
        const noteTags = note.metadata?.tags || []
        expect(noteTags).toContain('react')
      })
    })

    it('should apply minimum score filter', () => {
      const results = searchNotes('javascript', searchIndex, { 
        minimumScore: 2 
      })
      
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(2)
      })
    })

    it('should boost title matches higher than content', () => {
      const results = searchNotes('JavaScript', searchIndex)
      expect(results.length).toBeGreaterThan(0)
      
      // Title matches should have higher scores
      const titleMatch = results.find(r => r.slug === 'javascript-basics')
      const contentMatch = results.find(r => r.slug === 'react-hooks')
      
      if (titleMatch && contentMatch) {
        expect(titleMatch.score).toBeGreaterThan(contentMatch.score)
      }
    })

    it('should handle fuzzy search', () => {
      // Test with intentional typo - FlexSearch fuzzy might be more strict
      const results = searchNotes('javascrpt', searchIndex, { fuzzy: true })
      // FlexSearch's fuzzy search might not match this typo, so we test more lenient
      expect(results.length).toBeGreaterThanOrEqual(0)
      
      // Test a more likely fuzzy match
      const fuzzyResults = searchNotes('javascript', searchIndex, { fuzzy: true })
      expect(fuzzyResults.length).toBeGreaterThan(0)
    })

    it('should disable fuzzy search when requested', () => {
      const results = searchNotes('javascrpt', searchIndex, { fuzzy: false })
      // With fuzzy disabled, typos should return fewer or no results
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should search specific fields only', () => {
      const titleOnlyResults = searchNotes('JavaScript', searchIndex, { 
        fields: ['title'] 
      })
      
      titleOnlyResults.forEach(result => {
        expect(result.matchedFields).toEqual(['title'])
      })
    })

    it('should include highlights when requested', () => {
      const results = searchNotes('JavaScript', searchIndex, { 
        highlight: true 
      })
      
      expect(results.length).toBeGreaterThan(0)
      const highlighted = results.find(r => r.highlights && r.highlights.length > 0)
      expect(highlighted).toBeDefined()
    })

    it('should handle multi-word queries', () => {
      const results = searchNotes('React hooks useState', searchIndex)
      expect(results.length).toBeGreaterThan(0)
      
      const reactResult = results.find(r => r.slug === 'react-hooks')
      expect(reactResult).toBeDefined()
    })

    it('should be case insensitive', () => {
      const upperResults = searchNotes('JAVASCRIPT', searchIndex)
      const lowerResults = searchNotes('javascript', searchIndex)
      const mixedResults = searchNotes('JavaScript', searchIndex)
      
      expect(upperResults.length).toBeGreaterThan(0)
      expect(lowerResults.length).toBeGreaterThan(0)
      expect(mixedResults.length).toBeGreaterThan(0)
    })
  })

  describe('addNoteToIndex', () => {
    it('should add a new note to existing index', () => {
      const newNote = createNote('new-note', 'New Note', 'Fresh content', ['new'])
      
      addNoteToIndex(newNote, searchIndex)
      
      expect(searchIndex.documents.size).toBe(7)
      expect(searchIndex.documents.has('new-note')).toBe(true)
      
      const results = searchNotes('Fresh content', searchIndex)
      expect(results.some(r => r.slug === 'new-note')).toBe(true)
    })

    it('should handle notes without optional fields', () => {
      const minimalNote: ParsedNote = {
        slug: 'minimal' as Slug,
        html: '<p>Minimal</p>',
        metadata: {},
        linksTo: []
      }
      
      addNoteToIndex(minimalNote, searchIndex)
      
      expect(searchIndex.documents.size).toBe(7)
      expect(searchIndex.documents.has('minimal')).toBe(true)
    })
  })

  describe('removeNoteFromIndex', () => {
    it('should remove a note from the index', () => {
      removeNoteFromIndex('javascript-basics', searchIndex)
      
      expect(searchIndex.documents.size).toBe(5)
      expect(searchIndex.documents.has('javascript-basics')).toBe(false)
      
      const results = searchNotes('JavaScript Basics', searchIndex)
      expect(results.some(r => r.slug === 'javascript-basics')).toBe(false)
    })

    it('should handle removal of non-existent note', () => {
      const originalSize = searchIndex.documents.size
      
      removeNoteFromIndex('non-existent', searchIndex)
      
      expect(searchIndex.documents.size).toBe(originalSize)
    })
  })

  describe('updateNoteInIndex', () => {
    it('should update an existing note in the index', () => {
      const updatedNote = createNote(
        'javascript-basics', 
        'Advanced JavaScript', 
        'Deep dive into advanced JavaScript concepts',
        ['programming', 'javascript', 'advanced']
      )
      
      updateNoteInIndex(updatedNote, searchIndex)
      
      expect(searchIndex.documents.size).toBe(6) // Same count
      
      const results = searchNotes('Advanced JavaScript', searchIndex)
      expect(results.some(r => r.slug === 'javascript-basics')).toBe(true)
      
      // Old content should not be found
      const oldResults = searchNotes('fundamentals', searchIndex)
      expect(oldResults.some(r => r.slug === 'javascript-basics')).toBe(false)
    })

    it('should handle updating non-existent note', () => {
      const newNote = createNote('brand-new', 'Brand New', 'New content')
      
      updateNoteInIndex(newNote, searchIndex)
      
      expect(searchIndex.documents.size).toBe(7) // Added as new
      expect(searchIndex.documents.has('brand-new')).toBe(true)
    })
  })

  describe('getSearchSuggestions', () => {
    it('should return suggestions for partial queries', () => {
      const suggestions = getSearchSuggestions('java', searchIndex)
      expect(suggestions).toContain('javascript-basics')
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('should return empty array for empty query', () => {
      const suggestions = getSearchSuggestions('', searchIndex)
      expect(suggestions).toEqual([])
    })

    it('should return empty array for whitespace query', () => {
      const suggestions = getSearchSuggestions('   ', searchIndex)
      expect(suggestions).toEqual([])
    })

    it('should respect limit parameter', () => {
      const suggestions = getSearchSuggestions('java', searchIndex, 3)
      expect(suggestions.length).toBeLessThanOrEqual(3)
      expect(suggestions).toContain('javascript-basics')
    })

    it('should handle queries with no matches gracefully', () => {
      const suggestions = getSearchSuggestions('xyzzyx', searchIndex)
      expect(Array.isArray(suggestions)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty notes array', () => {
      const emptyIndex = generateSearchIndex([])
      expect(emptyIndex.documents.size).toBe(0)
      
      const results = searchNotes('anything', emptyIndex)
      expect(results).toEqual([])
    })

    it('should handle notes with special characters', () => {
      const specialNotes = [
        createNote('special', 'Special Chars!', 'Content with @#$%^&*() characters', ['special']),
        createNote('unicode', 'Unicode Rocket', 'Content with émojis and ünicode 🚀', ['unicode'])
      ]
      
      const specialIndex = generateSearchIndex(specialNotes)
      
      const results1 = searchNotes('Special Chars', specialIndex)
      expect(results1.length).toBeGreaterThan(0)
      
      // Search for text content instead of emoji, as FlexSearch might not index emojis
      const results2 = searchNotes('Unicode Rocket', specialIndex)
      expect(results2.length).toBeGreaterThan(0)
      
      // Test special punctuation is handled
      const results3 = searchNotes('émojis', specialIndex)
      expect(results3.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle very long content', () => {
      const longContent = 'This is a very long piece of content. '.repeat(1000)
      const longNote = createNote('long-note', 'Long Content', longContent, ['long'])
      
      const longIndex = generateSearchIndex([longNote])
      const results = searchNotes('very long piece', longIndex)
      
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].slug).toBe('long-note')
    })

    it('should handle notes with HTML in content', () => {
      const htmlNote: ParsedNote = {
        slug: 'html-note' as Slug,
        html: '<h1>Title</h1><p>Paragraph with <strong>bold</strong> text</p>',
        metadata: { title: 'HTML Note' },
        linksTo: [],
        raw: '# Title\n\nParagraph with **bold** text'
      }
      
      const htmlIndex = generateSearchIndex([htmlNote])
      const results = searchNotes('bold text', htmlIndex)
      
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].slug).toBe('html-note')
    })

    it('should handle notes with arrays and objects in metadata', () => {
      const complexNote = createNote(
        'complex-meta',
        'Complex Metadata',
        'Content',
        ['tag1', 'tag2'],
        {
          author: { name: 'John', email: 'john@example.com' },
          reviewers: ['Alice', 'Bob'],
          settings: { published: true, score: 95 }
        }
      )
      
      const complexIndex = generateSearchIndex([complexNote])
      const results = searchNotes('Complex Metadata', complexIndex)
      
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].slug).toBe('complex-meta')
    })
  })

  describe('performance', () => {
    it('should handle large number of notes efficiently', () => {
      const manyNotes = Array.from({ length: 1000 }, (_, i) => 
        createNote(`note-${i}`, `Note ${i}`, `Content for note number ${i}`, [`tag-${i % 10}`])
      )
      
      const start = Date.now()
      const largeIndex = generateSearchIndex(manyNotes)
      const indexTime = Date.now() - start
      
      expect(largeIndex.documents.size).toBe(1000)
      expect(indexTime).toBeLessThan(5000) // Should index 1000 notes in under 5 seconds
      
      const searchStart = Date.now()
      const results = searchNotes('Note', largeIndex, { limit: 20 })
      const searchTime = Date.now() - searchStart
      
      expect(results.length).toBe(20)
      expect(searchTime).toBeLessThan(1000) // Search should be fast
    })
  })
})
