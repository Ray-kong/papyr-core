import { ParsedNote, NoteGraph, GraphNode, GraphLink, GraphOptions } from './types'

/**
 * Builds a graph representation from a collection of parsed notes
 * @param notes Array of parsed notes
 * @param options Configuration options for graph building
 * @returns A complete note graph with nodes, edges, and backlinks
 */
export function buildNoteGraph(
  notes: ParsedNote[], 
  options: GraphOptions = {}
): NoteGraph {
  const {
    includeOrphans = true,
    bidirectional = false,
    minimumConnections = 0
  } = options

  // Initialize graph structure
  const nodes = new Map<string, GraphNode>()
  const edges: GraphLink[] = []
  const backlinks = new Map<string, Set<string>>()
  const orphans = new Set<string>()
  
  // Create a map for quick note lookup
  const noteMap = new Map<string, ParsedNote>()
  notes.forEach(note => {
    noteMap.set(note.slug, note)
    backlinks.set(note.slug, new Set())
  })

  // First pass: Create nodes and track forward links
  notes.forEach(note => {
    const node: GraphNode = {
      id: note.slug,
      label: note.metadata.title || note.slug,
      metadata: note.metadata,
      linkCount: 0,
      backlinkCount: 0,
      forwardLinkCount: note.linksTo.length
    }
    nodes.set(note.slug, node)
  })

  // Second pass: Build edges and backlinks
  notes.forEach(sourceNote => {
    sourceNote.linksTo.forEach(targetSlug => {
      // Only create edges if target note exists
      if (noteMap.has(targetSlug)) {
        // Create forward edge
        edges.push({
          source: sourceNote.slug,
          target: targetSlug
        })

        // Track backlink
        backlinks.get(targetSlug)!.add(sourceNote.slug)

        // If bidirectional, create reverse edge
        if (bidirectional && sourceNote.slug !== targetSlug) {
          edges.push({
            source: targetSlug,
            target: sourceNote.slug
          })
          backlinks.get(sourceNote.slug)!.add(targetSlug)
        }
      }
    })
  })

  // Third pass: Update link counts, identify orphans, and flag nodes to remove
  const nodesToRemove: string[] = []
  nodes.forEach((node, slug) => {
    const backlinkSet = backlinks.get(slug) || new Set()
    node.backlinkCount = backlinkSet.size
    node.linkCount = node.forwardLinkCount + node.backlinkCount

    if (node.linkCount === 0) {
      orphans.add(slug)
    }

    if (node.linkCount < minimumConnections) {
      nodesToRemove.push(slug)
    }
  })

  nodesToRemove.forEach(slug => nodes.delete(slug))

  // Remove orphans if not included
  if (!includeOrphans) {
    orphans.forEach(slug => nodes.delete(slug))
  }

  // Filter edges to only include those between existing nodes
  const filteredEdges = edges.filter(edge => 
    nodes.has(edge.source) && nodes.has(edge.target)
  )

  // Filter backlinks to only include existing nodes
  backlinks.clear()
  nodes.forEach((_, slug) => backlinks.set(slug, new Set()))
  filteredEdges.forEach(edge => {
    backlinks.get(edge.target)!.add(edge.source)
  })

  // Recompute link metrics based on filtered edges
  nodes.forEach(node => {
    node.forwardLinkCount = 0
    node.backlinkCount = 0
    node.linkCount = 0
  })

  filteredEdges.forEach(edge => {
    const sourceNode = nodes.get(edge.source)
    if (sourceNode) {
      sourceNode.forwardLinkCount += 1
    }
    const targetNode = nodes.get(edge.target)
    if (targetNode) {
      targetNode.backlinkCount += 1
    }
  })

  nodes.forEach(node => {
    node.linkCount = node.forwardLinkCount + node.backlinkCount
  })

  // Refresh orphan tracking for the remaining nodes
  orphans.clear()
  nodes.forEach((node, slug) => {
    if (node.linkCount === 0) {
      orphans.add(slug)
    }
  })

  return {
    nodes,
    edges: filteredEdges,
    backlinks,
    orphans
  }
}

/**
 * Get all notes that link to a specific note
 * @param slug The slug of the note to find backlinks for
 * @param graph The note graph
 * @returns Array of slugs that link to the specified note
 */
export function getBacklinks(slug: string, graph: NoteGraph): string[] {
  const backlinkSet = graph.backlinks.get(slug)
  return backlinkSet ? Array.from(backlinkSet) : []
}

/**
 * Get all connections (forward and back) for a note
 * @param slug The slug of the note
 * @param graph The note graph
 * @returns Object containing forward links and backlinks
 */
export function getConnections(slug: string, graph: NoteGraph): {
  forward: string[]
  backward: string[]
} {
  const node = graph.nodes.get(slug)
  if (!node) {
    return { forward: [], backward: [] }
  }

  // Get forward links from edges
  const forward = graph.edges
    .filter(edge => edge.source === slug)
    .map(edge => edge.target)

  // Get backlinks
  const backward = getBacklinks(slug, graph)

  return { forward, backward }
}

/**
 * Find the shortest path between two notes using BFS
 * @param sourceSlug Starting note
 * @param targetSlug Destination note
 * @param graph The note graph
 * @returns Array of slugs representing the path, or null if no path exists
 */
export function findShortestPath(
  sourceSlug: string, 
  targetSlug: string, 
  graph: NoteGraph
): string[] | null {
  if (!graph.nodes.has(sourceSlug) || !graph.nodes.has(targetSlug)) {
    return null
  }

  if (sourceSlug === targetSlug) {
    return [sourceSlug]
  }

  // Build adjacency list
  const adjacency = new Map<string, Set<string>>()
  graph.edges.forEach(edge => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set())
    }
    adjacency.get(edge.source)!.add(edge.target)
  })

  // BFS
  const queue: string[] = [sourceSlug]
  const visited = new Set<string>([sourceSlug])
  const parent = new Map<string, string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    
    if (current === targetSlug) {
      // Reconstruct path
      const path: string[] = []
      let node: string | undefined = targetSlug
      while (node !== undefined) {
        path.unshift(node)
        node = parent.get(node)
      }
      return path
    }

    const neighbors = adjacency.get(current) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        parent.set(neighbor, current)
        queue.push(neighbor)
      }
    }
  }

  return null
}
