import FlexSearch from 'flexsearch'
import { 
  ParsedNote, 
  SearchIndex, 
  SearchResult, 
  SearchOptions, 
  IndexOptions,
  SearchBoost,
  SearchRecord,
  Slug,
  Frontmatter,
  SerializedSearchIndex,
  SearchIndexConfig
} from './types'

function buildSearchIndexConfig(options: IndexOptions = {}): SearchIndexConfig {
  const {
    preset = 'default',
    tokenize = 'forward',
    resolution = 9,
    depth = 4
  } = options

  return {
    preset,
    tokenize,
    resolution,
    depth,
    context: { depth, resolution, bidirectional: false },
    document: {
      id: 'slug',
      index: [
        { field: 'title', tokenize, preset },
        { field: 'headings', tokenize, preset },
        { field: 'content', tokenize, preset },
        { field: 'tags', tokenize, preset },
        { field: 'metadata', tokenize, preset }
      ]
    }
  }
}

/**
 * Generate a FlexSearch index from an array of notes
 * @param notes Array of parsed notes to index
 * @param options Index configuration options
 * @returns SearchIndex containing the FlexSearch instance and document map
 */
export function generateSearchIndex(
  notes: ParsedNote[], 
  options: IndexOptions = {}
): SearchIndex {
  const config = buildSearchIndexConfig(options)

  // Create document-based index for multi-field search
  // FlexSearch Document has restrictive types, so we'll use a basic configuration
  const index = new FlexSearch.Document({
    preset: config.preset as any,
    tokenize: config.tokenize as any,
    resolution: config.resolution,
    context: config.context,
    document: config.document as any
  })

  // Create document map for quick lookup
  const documents = new Map<Slug, ParsedNote>()

  // Index all notes
  notes.forEach(note => {
    const record = createSearchRecord(note)

    // Add to FlexSearch index
    index.add({
      slug: record.slug,
      title: record.title,
      headings: record.headings.join(' '),
      content: record.content,
      tags: record.tags.join(' '),
      metadata: metadataToSearchText(record.metadata)
    })

    // Store in document map
    documents.set(note.slug, note)
  })

  return { index, documents, config }
}

/**
 * Search notes using the generated index
 * @param query Search query string
 * @param searchIndex The search index to query
 * @param options Search configuration options
 * @returns Array of search results
 */
export function searchNotes(
  query: string,
  searchIndex: SearchIndex,
  options: SearchOptions = {}
): SearchResult[] {
  const {
    limit = 20,
    fuzzy = true,
    highlight = false,
    fields = ['title', 'headings', 'content', 'tags', 'metadata'],
    tags,
    minimumScore = 0,
    boost = { title: 5, headings: 3, metadata: 2, content: 1 }
  } = options

  if (!query.trim()) {
    return []
  }

  // Perform search across specified fields
  const searchResults = searchIndex.index.search(query, {
    field: fields,
    limit: limit * 2, // Get more results for filtering
    enrich: true,
    fuzzy: fuzzy ? 0.2 : false
  })

  // Process and score results
  const processedResults: SearchResult[] = []

  searchResults.forEach((fieldResult: any) => {
    const field = fieldResult.field
    const fieldBoost = boost[field as keyof SearchBoost] || 1

    fieldResult.result.forEach((slug: string) => {
      const typedSlug = slug as Slug
      const note = searchIndex.documents.get(typedSlug)
      if (!note) return

      const record = createSearchRecord(note)

      // Filter by tags if specified
      if (tags && tags.length > 0) {
        const noteTagsArray = record.tags
        if (!tags.some(tag => noteTagsArray.includes(tag))) {
          return
        }
      }

      // Check if we already have this result
      const existingResult = processedResults.find(r => r.slug === typedSlug)
      
      if (existingResult) {
        // Update score and matched fields
        existingResult.score += fieldBoost
        if (!existingResult.matchedFields.includes(field)) {
          existingResult.matchedFields.push(field)
          if (field === 'headings') {
            const headingExcerpt = findHeadingExcerpt(record, query)
            if (headingExcerpt) {
              existingResult.excerpt = headingExcerpt
            }
          }
        }
      } else {
        // Create new result
        const title = record.title
        let excerpt = record.excerpt ?? buildExcerpt(record.content)
        if (field === 'headings') {
          excerpt = findHeadingExcerpt(record, query) ?? excerpt
        }

        const result: SearchResult = {
          slug: typedSlug,
          title,
          excerpt,
          score: fieldBoost,
          matchedFields: [field]
        }

        // Add highlights if requested
        if (highlight) {
          result.highlights = generateHighlights(query, record, field)
        }

        processedResults.push(result)
      }
    })
  })

  // Filter by minimum score and sort by relevance
  return processedResults
    .filter(result => result.score >= minimumScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Add a single note to an existing search index
 * @param note The note to add
 * @param searchIndex The search index to update
 */
export function addNoteToIndex(note: ParsedNote, searchIndex: SearchIndex): void {
  const record = createSearchRecord(note)

  searchIndex.index.add({
    slug: record.slug,
    title: record.title,
    headings: record.headings.join(' '),
    content: record.content,
    tags: record.tags.join(' '),
    metadata: metadataToSearchText(record.metadata)
  })

  searchIndex.documents.set(note.slug, note)
}

/**
 * Remove a note from the search index
 * @param slug The slug of the note to remove
 * @param searchIndex The search index to update
 */
export function removeNoteFromIndex(slug: Slug | string, searchIndex: SearchIndex): void {
  searchIndex.index.remove(slug)
  searchIndex.documents.delete(slug as Slug)
}

/**
 * Update an existing note in the search index
 * @param note The updated note
 * @param searchIndex The search index to update
 */
export function updateNoteInIndex(note: ParsedNote, searchIndex: SearchIndex): void {
  // Remove existing entry
  removeNoteFromIndex(note.slug, searchIndex)
  // Add updated entry
  addNoteToIndex(note, searchIndex)
}

/**
 * Generate search highlights for a query match
 * @param query The search query
 * @param note The note that matched
 * @param field The field that matched
 * @returns Array of highlight objects
 */
function generateHighlights(query: string, record: SearchRecord, field: string): any[] {
  // This is a simplified highlight implementation
  // In a production system, you might want more sophisticated highlighting
  const highlights: any[] = []

  if (field === 'headings') {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return highlights
    }

    record.headings.forEach(heading => {
      const headingLower = heading.toLowerCase()
      const matchIndex = headingLower.indexOf(normalizedQuery)
      if (matchIndex !== -1) {
        highlights.push({
          field,
          start: matchIndex,
          end: matchIndex + normalizedQuery.length,
          text: heading
        })
      }
    })

    return highlights
  }
  
  let content = ''
  switch (field) {
    case 'title':
      content = record.title || String(record.slug)
      break
    case 'content':
      content = record.content
      break
    case 'tags':
      content = record.tags.join(' ')
      break
    case 'metadata':
      content = metadataToSearchText(record.metadata)
      break
  }

  // Simple case-insensitive search for highlights
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 0)
  const contentLower = content.toLowerCase()

  queryTerms.forEach(term => {
    let startIndex = 0
    while (true) {
      const index = contentLower.indexOf(term, startIndex)
      if (index === -1) break

      highlights.push({
        field,
        start: index,
        end: index + term.length,
        text: content.substring(index, index + term.length)
      })

      startIndex = index + term.length
    }
  })

  return highlights
}

/**
 * Build a search-ready document record from a parsed note
 */
export function createSearchRecord(note: ParsedNote): SearchRecord {
  const metadata = (note.metadata ?? {}) as Frontmatter
  const tags = normalizeTags((metadata as any).tags)
  const content = note.raw || note.html.replace(/<[^>]*>/g, '')
  const excerpt = note.excerpt || buildExcerpt(content)
  const headings = (note.headings ?? []).map(heading => heading.text).filter(Boolean)

  return {
    slug: note.slug as Slug,
    title: typeof metadata.title === 'string' && metadata.title.length > 0 ? metadata.title : note.slug,
    headings,
    content,
    tags,
    metadata,
    excerpt
  }
}

function findHeadingExcerpt(record: SearchRecord, query: string): string | undefined {
  if (!record.headings.length) {
    return undefined
  }

  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return undefined
  }

  return record.headings.find(heading =>
    heading.toLowerCase().includes(normalizedQuery)
  )
}

/**
 * Normalize tag values from frontmatter into a string array
 */
function normalizeTags(rawTags: unknown): string[] {
  if (!rawTags) {
    return []
  }

  if (Array.isArray(rawTags)) {
    return rawTags
      .map(tag => (typeof tag === 'string' ? tag : String(tag)))
      .filter(tag => tag.length > 0)
  }

  if (typeof rawTags === 'string') {
    return rawTags.length > 0 ? [rawTags] : []
  }

  return [String(rawTags)]
}

/**
 * Convert metadata values into a search-friendly string
 */
function metadataToSearchText(metadata: Frontmatter): string {
  const excludeKeys = new Set(['title', 'tags'])
  const values: string[] = []

  for (const [key, value] of Object.entries(metadata || {})) {
    if (excludeKeys.has(key)) {
      continue
    }
    values.push(...collectTextValues(value))
  }

  return values.join(' ')
}

function collectTextValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectTextValues)
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectTextValues)
  }

  return []
}

function buildExcerpt(content: string, length: number = 200): string {
  if (!content) {
    return ''
  }

  const trimmed = content.trim()
  if (trimmed.length <= length) {
    return trimmed
  }

  return `${trimmed.substring(0, length)}...`
}

/**
 * Get search suggestions based on partial query
 * @param partialQuery Partial search query
 * @param searchIndex The search index to query
 * @param limit Maximum number of suggestions
 * @returns Array of suggested terms
 */
export function getSearchSuggestions(
  partialQuery: string,
  searchIndex: SearchIndex,
  limit: number = 5
): string[] {
  if (!partialQuery.trim()) {
    return []
  }

  // Use FlexSearch's suggestion feature
  try {
    const suggestions = searchIndex.index.search(partialQuery, {
      limit,
      suggest: true
    })

    const uniqueSuggestions = new Set<string>()

    const enqueue = (value: unknown): void => {
      if (value === null || value === undefined) {
        return
      }

      if (typeof value === 'string') {
        uniqueSuggestions.add(value)
        return
      }

      if (Array.isArray(value)) {
        value.forEach(enqueue)
        return
      }

      if (typeof value === 'object') {
        const candidate = value as Record<string, unknown>

        const id = candidate.id
        if (typeof id === 'string') {
          uniqueSuggestions.add(id)
        }

        const slug = candidate.slug
        if (typeof slug === 'string') {
          uniqueSuggestions.add(slug)
        }

        const result = candidate.result
        if (Array.isArray(result)) {
          result.forEach(enqueue)
        }

        const doc = candidate.doc
        if (doc && typeof doc === 'object') {
          const docSlug = (doc as Record<string, unknown>).slug
          if (typeof docSlug === 'string') {
            uniqueSuggestions.add(docSlug)
          }
        }
      }
    }

    enqueue(suggestions)

    return Array.from(uniqueSuggestions).slice(0, limit)
  } catch (error) {
    // Fallback: return empty array if suggestions fail
    return []
  }
}

export async function exportSearchIndex(searchIndex: SearchIndex): Promise<SerializedSearchIndex> {
  const exportedIndex: Record<string, string> = {}

  await searchIndex.index.export((key: string, data: string) => {
    exportedIndex[key] = data
  })

  const documents: Record<string, ParsedNote> = {}
  searchIndex.documents.forEach((note, slug) => {
    documents[slug] = note
  })

  return {
    config: searchIndex.config,
    index: exportedIndex,
    documents
  }
}

export function importSearchIndex(serialized: SerializedSearchIndex): SearchIndex {
  const index = new FlexSearch.Document({
    preset: serialized.config.preset as any,
    tokenize: serialized.config.tokenize as any,
    resolution: serialized.config.resolution,
    context: serialized.config.context,
    document: serialized.config.document as any
  })

  Object.entries(serialized.index).forEach(([key, data]) => {
    index.import(key, data)
  })

  const documents = new Map<Slug, ParsedNote>()
  Object.entries(serialized.documents).forEach(([slug, note]) => {
    documents.set(slug as Slug, note)
  })

  return {
    index,
    documents,
    config: serialized.config
  }
}
