import { describe, it, expect } from 'vitest'
import {
  createSearchRecord,
  generateSearchIndex,
  getSearchSuggestions,
  searchNotes
} from '../src/search'
import { ParsedNote, SearchIndex, Slug } from '../src/types'

const createNote = (
  options: Partial<ParsedNote> & { metadata?: Record<string, any> } = {}
): ParsedNote => ({
  slug: (options.slug ?? 'note-slug') as Slug,
  html: options.html ?? '<p>Default content</p>',
  metadata: (options.metadata ?? {}) as ParsedNote['metadata'],
  linksTo: options.linksTo ?? [],
  embeds: options.embeds ?? [],
  headings: options.headings ?? [],
  raw: options.raw,
  excerpt: options.excerpt
})

describe('createSearchRecord', () => {
  it('falls back to slug when metadata title is missing and sanitizes HTML content', () => {
    const note = createNote({
      slug: 'untitled-note',
      html: '<h1>Heading</h1><p>Paragraph</p>',
      metadata: {}
    })

    const record = createSearchRecord(note)

    expect(record.title).toBe('untitled-note')
    expect(record.content).toBe('HeadingParagraph')
    expect(record.excerpt).toBe('HeadingParagraph')
  })

  it('truncates long content into an excerpt when no explicit excerpt is provided', () => {
    const longContent = 'a'.repeat(220)
    const note = createNote({
      slug: 'long-note',
      html: `<p>${longContent}</p>`,
      raw: longContent,
      metadata: {}
    })

    const record = createSearchRecord(note)

    expect(record.excerpt?.length).toBe(203)
    expect(record.excerpt?.endsWith('...')).toBe(true)
  })

  it('returns an empty excerpt when note content is blank', () => {
    const note = createNote({
      slug: 'blank-note',
      html: '',
      metadata: {}
    })

    const record = createSearchRecord(note)

    expect(record.content).toBe('')
    expect(record.excerpt).toBe('')
  })

  it('normalizes tag inputs from arrays, strings, and other values', () => {
    const customTag = { toString: () => 'custom' }

    const arrayNote = createNote({
      slug: 'array-tags',
      metadata: { tags: ['alpha', 42, '', customTag] }
    })
    const stringNote = createNote({
      slug: 'string-tag',
      metadata: { tags: 'solo-tag' }
    })
    const emptyStringNote = createNote({
      slug: 'empty-string-tag',
      metadata: { tags: '' }
    })
    const objectNote = createNote({
      slug: 'object-tags',
      metadata: { tags: { label: 'struct' } }
    })
    const missingNote = createNote({ slug: 'no-tags', metadata: {} })

    const arrayRecord = createSearchRecord(arrayNote)
    const stringRecord = createSearchRecord(stringNote)
    const emptyStringRecord = createSearchRecord(emptyStringNote)
    const objectRecord = createSearchRecord(objectNote)
    const missingRecord = createSearchRecord(missingNote)

    expect(arrayRecord.tags).toEqual(['alpha', '42', 'custom'])
    expect(stringRecord.tags).toEqual(['solo-tag'])
    expect(emptyStringRecord.tags).toEqual([])
    expect(objectRecord.tags).toEqual(['[object Object]'])
    expect(missingRecord.tags).toEqual([])
  })
})

describe('metadata indexing', () => {
  it('indexes numbers, booleans, arrays, and nested object values from metadata', () => {
    const note = createNote({
      slug: 'meta-note',
      metadata: {
        title: 'Meta Title',
        tags: ['ignore'],
        rating: 5,
        published: false,
        details: {
          author: 'Ada Lovelace',
          labels: ['nested', 42]
        }
      },
      raw: 'Plain content'
    })

    const index = generateSearchIndex([note])

    const ratingHit = searchNotes('5', index, { fields: ['metadata'] })
    const booleanHit = searchNotes('false', index, { fields: ['metadata'] })
    const nestedHit = searchNotes('nested', index, { fields: ['metadata'] })
    const objectHit = searchNotes('Ada', index, { fields: ['metadata'] })
    const numericArrayHit = searchNotes('42', index, { fields: ['metadata'] })

    const expectSlug = (results: ReturnType<typeof searchNotes>) =>
      results.some(result => result.slug === 'meta-note')

    expect(expectSlug(ratingHit)).toBe(true)
    expect(expectSlug(booleanHit)).toBe(true)
    expect(expectSlug(nestedHit)).toBe(true)
    expect(expectSlug(objectHit)).toBe(true)
    expect(expectSlug(numericArrayHit)).toBe(true)
  })

  it('omits falsy metadata values when flattening', () => {
    const note = createNote({
      slug: 'void-meta',
      metadata: {
        title: 'Void Meta',
        tags: [],
        description: null,
        optional: undefined,
        nested: { value: undefined }
      },
      raw: 'Void content'
    })

    const index = generateSearchIndex([note])
    const results = searchNotes('undefined', index, { fields: ['metadata'] })

    expect(results).toEqual([])
  })
})

describe('getSearchSuggestions', () => {
  const makeStubIndex = (searchImplementation: () => any): SearchIndex => ({
    index: { search: searchImplementation },
    documents: new Map() as Map<Slug, ParsedNote>,
    config: {
      preset: 'default',
      tokenize: 'forward',
      resolution: 9,
      depth: 4,
      context: { depth: 4, resolution: 9, bidirectional: false },
      document: {
        id: 'slug',
        index: []
      }
    }
  })

  it('deduplicates string suggestions from the underlying index', () => {
    const stubIndex = makeStubIndex(() => [
      'suggestion-one',
      'suggestion-one',
      'suggestion-two'
    ])

    const suggestions = getSearchSuggestions('sug', stubIndex, 5)

    expect(suggestions).toEqual(['suggestion-one', 'suggestion-two'])
  })

  it('extracts ids from document-style suggestion responses', () => {
    const stubIndex = makeStubIndex(() => [
      { field: 'title', result: [{ id: 'doc-one' }, { id: 'doc-one' }] },
      { field: 'content', result: ['doc-two'] }
    ])

    const suggestions = getSearchSuggestions('doc', stubIndex, 5)

    expect(suggestions).toEqual(['doc-one', 'doc-two'])
  })

  it('returns an empty array when the index search throws', () => {
    const failingIndex = makeStubIndex(() => {
      throw new Error('search failure')
    })

    const suggestions = getSearchSuggestions('fail', failingIndex)

    expect(suggestions).toEqual([])
  })
})

describe('searchNotes highlighting', () => {
  it('generates highlights for tags and metadata fields', () => {
    const tagsNote = createNote({
      slug: 'tags-note',
      metadata: { tags: ['alpha', 'beta'] },
      raw: 'Tagged content'
    })

    const metadataNote = createNote({
      slug: 'metadata-note',
      metadata: { title: 'Meta', summary: 'Alpha rich metadata' },
      raw: 'Meta content'
    })

    const documents = new Map<Slug, ParsedNote>([
      [tagsNote.slug, tagsNote],
      [metadataNote.slug, metadataNote]
    ])

    const stubIndex = {
      search: () => [
        { field: 'tags', result: ['tags-note'] },
        { field: 'metadata', result: ['metadata-note'] }
      ]
    }

    const results = searchNotes('alpha', { index: stubIndex, documents }, { highlight: true })

    const tagsResult = results.find(result => result.slug === 'tags-note')
    expect(tagsResult?.highlights?.some(highlight => highlight.field === 'tags')).toBe(true)

    const metadataResult = results.find(result => result.slug === 'metadata-note')
    expect(metadataResult?.highlights?.some(highlight => highlight.field === 'metadata')).toBe(true)
  })

  it('generates highlights for content field when matched', () => {
    const contentNote = createNote({
      slug: 'content-note',
      raw: 'Important keyword inside content',
      metadata: {}
    })

    const documents = new Map<Slug, ParsedNote>([[contentNote.slug, contentNote]])
    const stubIndex = {
      search: () => [{ field: 'content', result: [contentNote.slug] }]
    }

    const results = searchNotes('keyword', { index: stubIndex, documents }, { highlight: true })
    const contentResult = results.find(result => result.slug === 'content-note')

    expect(contentResult?.highlights?.some(highlight => highlight.field === 'content')).toBe(true)
  })

  it('generates highlights for title field when matched', () => {
    const titleNote = createNote({
      slug: 'title-note',
      metadata: { title: 'Alpha Manual' },
      raw: 'Alpha content'
    })

    const documents = new Map<Slug, ParsedNote>([[titleNote.slug, titleNote]])
    const stubIndex = {
      search: () => [{ field: 'title', result: [titleNote.slug] }]
    }

    const results = searchNotes('Alpha', { index: stubIndex, documents }, { highlight: true })
    const titleResult = results.find(result => result.slug === 'title-note')

    expect(titleResult?.highlights?.some(highlight => highlight.field === 'title')).toBe(true)
  })
})

describe('searchNotes branches', () => {
  it('skips index hits that lack a corresponding document', () => {
    const stubIndex = {
      search: () => [{ field: 'content', result: ['ghost-note'] }]
    }

    const documents = new Map<Slug, ParsedNote>()
    const results = searchNotes('ghost', { index: stubIndex, documents }, {})

    expect(results).toEqual([])
  })
})
