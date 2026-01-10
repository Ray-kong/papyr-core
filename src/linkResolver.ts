import { ParsedNote, BacklinkedNote, NoteGraph } from './types'
import { buildNoteGraph, getBacklinks } from './graph'

/**
 * Resolves all links in a collection of notes and enriches them with backlink data
 * @param notes Array of parsed notes
 * @returns Map of slug to BacklinkedNote with resolved links
 */
export function resolveLinks(notes: ParsedNote[]): Map<string, BacklinkedNote> {
  // Build the graph to get backlink information
  const graph = buildNoteGraph(notes)
  
  // Create the result map
  const resolvedNotes = new Map<string, BacklinkedNote>()
  
  // Enrich each note with backlinks
  notes.forEach(note => {
    const backlinks = getBacklinks(note.slug, graph)
    
    const backlinkedNote: BacklinkedNote = {
      ...note,
      backlinks
    }
    
    resolvedNotes.set(note.slug, backlinkedNote)
  })
  
  return resolvedNotes
}

/**
 * Find all orphaned links (links to non-existent notes)
 * @param notes Array of parsed notes
 * @returns Map of source slug to array of orphaned target slugs
 */
export function findOrphanedLinks(notes: ParsedNote[]): Map<string, string[]> {
  const orphanedLinks = new Map<string, string[]>()
  const existingSlugs = new Set<string>(notes.map(note => note.slug))
  
  notes.forEach(note => {
    const orphans = note.linksTo.filter(targetSlug => !existingSlugs.has(targetSlug))
    
    if (orphans.length > 0) {
      orphanedLinks.set(note.slug, orphans)
    }
  })
  
  return orphanedLinks
}

/**
 * Create a bidirectional link map for quick lookups
 * @param notes Array of parsed notes
 * @returns Object with forward and backward link mappings
 */
export function createLinkMaps(notes: ParsedNote[]): {
  forward: Map<string, Set<string>>  // slug -> Set of slugs it links to
  backward: Map<string, Set<string>>  // slug -> Set of slugs that link to it
} {
  const forward = new Map<string, Set<string>>()
  const backward = new Map<string, Set<string>>()
  
  // Initialize maps
  notes.forEach(note => {
    forward.set(note.slug, new Set(note.linksTo))
    backward.set(note.slug, new Set())
  })
  
  // Build backward links
  notes.forEach(note => {
    note.linksTo.forEach(targetSlug => {
      if (backward.has(targetSlug)) {
        backward.get(targetSlug)!.add(note.slug)
      }
    })
  })
  
  return { forward, backward }
}

/**
 * Validate all links in the note collection
 * @param notes Array of parsed notes
 * @returns Validation result with statistics
 */
export function validateLinks(notes: ParsedNote[]): {
  totalLinks: number
  validLinks: number
  orphanedLinks: number
  selfLinks: number
  duplicateLinks: number
  linksByNote: Map<string, { valid: number, orphaned: number, self: number, duplicate: number }>
} {
  const existingSlugs = new Set<string>(notes.map(note => note.slug))
  let totalLinks = 0
  let validLinks = 0
  let orphanedLinks = 0
  let selfLinks = 0
  let duplicateLinks = 0
  
  const linksByNote = new Map<string, { valid: number, orphaned: number, self: number, duplicate: number }>()
  
  notes.forEach(note => {
    const stats = { valid: 0, orphaned: 0, self: 0, duplicate: 0 }
    const seenLinks = new Set<string>()
    
    note.linksTo.forEach(targetSlug => {
      totalLinks++
      
      // Check for duplicates
      if (seenLinks.has(targetSlug)) {
        duplicateLinks++
        stats.duplicate++
      } else {
        seenLinks.add(targetSlug)
        
        // Check link validity
        if (targetSlug === note.slug) {
          selfLinks++
          stats.self++
        } else if (existingSlugs.has(targetSlug)) {
          validLinks++
          stats.valid++
        } else {
          orphanedLinks++
          stats.orphaned++
        }
      }
    })
    
    linksByNote.set(note.slug, stats)
  })
  
  return {
    totalLinks,
    validLinks,
    orphanedLinks,
    selfLinks,
    duplicateLinks,
    linksByNote
  }
}

/**
 * Get all notes that are reachable from a given note
 * @param startSlug Starting note slug
 * @param notes Array of parsed notes
 * @param maxDepth Maximum depth to traverse (default: unlimited)
 * @returns Set of reachable note slugs
 */
export function getReachableNotes(
  startSlug: string, 
  notes: ParsedNote[], 
  maxDepth: number = Infinity
): Set<string> {
  const noteMap = new Map<string, ParsedNote>()
  notes.forEach(note => noteMap.set(note.slug, note))
  
  if (!noteMap.has(startSlug)) {
    return new Set()
  }
  
  const visited = new Set<string>()
  const queue: { slug: string, depth: number }[] = [{ slug: startSlug, depth: 0 }]
  
  while (queue.length > 0) {
    const { slug, depth } = queue.shift()!
    
    if (visited.has(slug) || depth > maxDepth) {
      continue
    }
    
    visited.add(slug)
    
    const note = noteMap.get(slug)
    if (note) {
      note.linksTo.forEach(targetSlug => {
        if (noteMap.has(targetSlug) && !visited.has(targetSlug)) {
          queue.push({ slug: targetSlug, depth: depth + 1 })
        }
      })
    }
  }
  
  return visited
}
