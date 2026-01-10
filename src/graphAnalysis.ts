import { NoteGraph, GraphNode } from './types'

/**
 * Find all orphaned notes (notes with no connections)
 * @param graph The note graph
 * @returns Array of orphaned note slugs
 */
export function findOrphanedNotes(graph: NoteGraph): string[] {
  return Array.from(graph.orphans)
}

/**
 * Find the most linked notes in the graph
 * @param graph The note graph
 * @param limit Maximum number of results (default: 10)
 * @returns Array of nodes sorted by total link count
 */
export function findMostLinkedNotes(graph: NoteGraph, limit: number = 10): GraphNode[] {
  const nodes = Array.from(graph.nodes.values())
  
  return nodes
    .sort((a, b) => b.linkCount - a.linkCount)
    .slice(0, limit)
}

/**
 * Find the most referenced notes (highest backlink count)
 * @param graph The note graph
 * @param limit Maximum number of results (default: 10)
 * @returns Array of nodes sorted by backlink count
 */
export function findMostReferencedNotes(graph: NoteGraph, limit: number = 10): GraphNode[] {
  const nodes = Array.from(graph.nodes.values())
  
  return nodes
    .sort((a, b) => b.backlinkCount - a.backlinkCount)
    .slice(0, limit)
}

/**
 * Calculate degree centrality for all nodes
 * @param graph The note graph
 * @returns Map of slug to centrality score (0-1)
 */
export function calculateCentrality(graph: NoteGraph): Map<string, number> {
  const centrality = new Map<string, number>()
  const maxPossibleConnections = graph.nodes.size - 1
  
  if (maxPossibleConnections === 0) {
    // Single node or empty graph
    graph.nodes.forEach((_, slug) => centrality.set(slug, 0))
    return centrality
  }
  
  graph.nodes.forEach((node, slug) => {
    // Degree centrality = number of connections / max possible connections
    const score = node.linkCount / maxPossibleConnections
    centrality.set(slug, Math.min(score, 1)) // Cap at 1
  })
  
  return centrality
}

/**
 * Find connected components in the graph using DFS
 * @param graph The note graph
 * @returns Array of components, each component is an array of slugs
 */
export function getConnectedComponents(graph: NoteGraph): string[][] {
  const visited = new Set<string>()
  const components: string[][] = []
  
  // Build adjacency list (considering links as undirected for component detection)
  const adjacency = new Map<string, Set<string>>()
  graph.nodes.forEach((_, slug) => adjacency.set(slug, new Set()))
  
  graph.edges.forEach(edge => {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source) // Make it undirected
  })
  
  // DFS to find components
  function dfs(slug: string, component: string[]): void {
    visited.add(slug)
    component.push(slug)
    
    const neighbors = adjacency.get(slug) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, component)
      }
    }
  }
  
  // Find all components
  graph.nodes.forEach((_, slug) => {
    if (!visited.has(slug)) {
      const component: string[] = []
      dfs(slug, component)
      if (component.length > 0) {
        components.push(component)
      }
    }
  })
  
  return components.sort((a, b) => b.length - a.length) // Sort by size
}

/**
 * Calculate graph statistics
 * @param graph The note graph
 * @returns Object with various graph metrics
 */
export function getGraphStatistics(graph: NoteGraph): {
  nodeCount: number
  edgeCount: number
  orphanCount: number
  averageConnections: number
  maxConnections: number
  componentCount: number
  largestComponentSize: number
  density: number
} {
  const nodeCount = graph.nodes.size
  const edgeCount = graph.edges.length
  const orphanCount = graph.orphans.size
  
  // Calculate average connections
  let totalConnections = 0
  let maxConnections = 0
  
  graph.nodes.forEach(node => {
    totalConnections += node.linkCount
    maxConnections = Math.max(maxConnections, node.linkCount)
  })
  
  const averageConnections = nodeCount > 0 ? totalConnections / nodeCount : 0
  
  // Get components
  const components = getConnectedComponents(graph)
  const componentCount = components.length
  const largestComponentSize = components.length > 0 ? components[0].length : 0
  
  // Calculate density (actual edges / possible edges)
  const possibleEdges = nodeCount * (nodeCount - 1)
  const density = possibleEdges > 0 ? edgeCount / possibleEdges : 0
  
  return {
    nodeCount,
    edgeCount,
    orphanCount,
    averageConnections,
    maxConnections,
    componentCount,
    largestComponentSize,
    density
  }
}

/**
 * Find hubs (notes with many outgoing links)
 * @param graph The note graph
 * @param threshold Minimum forward link count to be considered a hub
 * @returns Array of hub nodes
 */
export function findHubs(graph: NoteGraph, threshold: number = 5): GraphNode[] {
  return Array.from(graph.nodes.values())
    .filter(node => node.forwardLinkCount >= threshold)
    .sort((a, b) => b.forwardLinkCount - a.forwardLinkCount)
}

/**
 * Find authorities (notes with many incoming links)
 * @param graph The note graph
 * @param threshold Minimum backlink count to be considered an authority
 * @returns Array of authority nodes
 */
export function findAuthorities(graph: NoteGraph, threshold: number = 5): GraphNode[] {
  return Array.from(graph.nodes.values())
    .filter(node => node.backlinkCount >= threshold)
    .sort((a, b) => b.backlinkCount - a.backlinkCount)
}

/**
 * Get the neighborhood of a node (all directly connected nodes)
 * @param slug The node slug
 * @param graph The note graph
 * @param depth How many hops to include (default: 1)
 * @returns Set of neighboring node slugs
 */
export function getNeighborhood(
  slug: string, 
  graph: NoteGraph, 
  depth: number = 1
): Set<string> {
  if (!graph.nodes.has(slug) || depth < 1) {
    return new Set()
  }
  
  const neighborhood = new Set<string>()
  const currentLevel = new Set<string>([slug])
  
  for (let d = 0; d < depth; d++) {
    const nextLevel = new Set<string>()
    
    for (const current of currentLevel) {
      // Add outgoing connections
      graph.edges
        .filter(edge => edge.source === current)
        .forEach(edge => {
          neighborhood.add(edge.target)
          nextLevel.add(edge.target)
        })
      
      // Add incoming connections
      graph.edges
        .filter(edge => edge.target === current)
        .forEach(edge => {
          neighborhood.add(edge.source)
          nextLevel.add(edge.source)
        })
    }
    
    currentLevel.clear()
    nextLevel.forEach(n => currentLevel.add(n))
  }
  
  neighborhood.delete(slug) // Remove the original node
  return neighborhood
}