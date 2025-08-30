import FlexSearch from 'flexsearch'
import { 
  ParsedNote, 
  SearchIndex, 
  SearchResult, 
  SearchOptions, 
  IndexOptions,
  SearchBoost 
} from './types'

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
  const {
    preset = 'default',
    tokenize = 'forward',
    resolution = 9,
    depth = 4
  } = options

  // Create document-based index for multi-field search
  // FlexSearch Document has restrictive types, so we'll use a basic configuration
  const index = new FlexSearch.Document({
    preset: 'default' as any,
    tokenize: 'forward' as any,
    resolution,
    document: {
      id: 'slug',
      field: ['title', 'content', 'tags', 'metadata']
    }
  })

  // Create document map for quick lookup
  const documents = new Map<string, ParsedNote>()

  // Index all notes
  notes.forEach(note => {
    // Extract title from metadata or use slug as fallback
    const title = note.metadata?.title || note.slug

    // Extract tags from metadata
    const tags = note.metadata?.tags ? 
      (Array.isArray(note.metadata.tags) ? note.metadata.tags : [note.metadata.tags]).join(' ') 
      : ''

    // Create searchable metadata string
    const metadataText = Object.entries(note.metadata || {})
      .filter(([key, value]) => key !== 'title' && key !== 'tags' && typeof value === 'string')
      .map(([_, value]) => value)
      .join(' ')

    // Add to FlexSearch index
    index.add({
      slug: note.slug,
      title,
      content: note.raw || note.html.replace(/<[^>]*>/g, ''), // Use raw markdown or strip HTML
      tags,
      metadata: metadataText
    })

    // Store in document map
    documents.set(note.slug, note)
  })

  return { index, documents }
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
    fields = ['title', 'content', 'tags', 'metadata'],
    tags,
    minimumScore = 0,
    boost = { title: 3, metadata: 2, content: 1 }
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
      const note = searchIndex.documents.get(slug)
      if (!note) return

      // Filter by tags if specified
      if (tags && tags.length > 0) {
        const noteTags = note.metadata?.tags || []
        const noteTagsArray = Array.isArray(noteTags) ? noteTags : [noteTags]
        if (!tags.some(tag => noteTagsArray.includes(tag))) {
          return
        }
      }

      // Check if we already have this result
      const existingResult = processedResults.find(r => r.slug === slug)
      
      if (existingResult) {
        // Update score and matched fields
        existingResult.score += fieldBoost
        if (!existingResult.matchedFields.includes(field)) {
          existingResult.matchedFields.push(field)
        }
      } else {
        // Create new result
        const title = note.metadata?.title || note.slug
        const excerpt = note.excerpt || 
          (note.raw ? note.raw.substring(0, 200) + '...' : 
           note.html.replace(/<[^>]*>/g, '').substring(0, 200) + '...')

        const result: SearchResult = {
          slug,
          title,
          excerpt,
          score: fieldBoost,
          matchedFields: [field]
        }

        // Add highlights if requested
        if (highlight) {
          result.highlights = generateHighlights(query, note, field)
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
  const title = note.metadata?.title || note.slug
  const tags = note.metadata?.tags ? 
    (Array.isArray(note.metadata.tags) ? note.metadata.tags : [note.metadata.tags]).join(' ') 
    : ''
  const metadataText = Object.entries(note.metadata || {})
    .filter(([key, value]) => key !== 'title' && key !== 'tags' && typeof value === 'string')
    .map(([_, value]) => value)
    .join(' ')

  searchIndex.index.add({
    slug: note.slug,
    title,
    content: note.raw || note.html.replace(/<[^>]*>/g, ''),
    tags,
    metadata: metadataText
  })

  searchIndex.documents.set(note.slug, note)
}

/**
 * Remove a note from the search index
 * @param slug The slug of the note to remove
 * @param searchIndex The search index to update
 */
export function removeNoteFromIndex(slug: string, searchIndex: SearchIndex): void {
  searchIndex.index.remove(slug)
  searchIndex.documents.delete(slug)
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
function generateHighlights(query: string, note: ParsedNote, field: string): any[] {
  // This is a simplified highlight implementation
  // In a production system, you might want more sophisticated highlighting
  const highlights: any[] = []
  
  let content = ''
  switch (field) {
    case 'title':
      content = note.metadata?.title || note.slug
      break
    case 'content':
      content = note.raw || note.html.replace(/<[^>]*>/g, '')
      break
    case 'tags':
      content = note.metadata?.tags ? 
        (Array.isArray(note.metadata.tags) ? note.metadata.tags : [note.metadata.tags]).join(' ') 
        : ''
      break
    case 'metadata':
      content = Object.entries(note.metadata || {})
        .filter(([key, value]) => key !== 'title' && key !== 'tags' && typeof value === 'string')
        .map(([_, value]) => value)
        .join(' ')
      break
  }

  // Simple case-insensitive search for highlights
  const queryTerms = query.toLowerCase().split(/\s+/)
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
    
    // Extract unique suggestions
    const uniqueSuggestions = new Set<string>()
    suggestions.forEach((result: any) => {
      if (typeof result === 'string') {
        uniqueSuggestions.add(result)
      }
    })

    return Array.from(uniqueSuggestions).slice(0, limit)
  } catch (error) {
    // Fallback: return empty array if suggestions fail
    return []
  }
}