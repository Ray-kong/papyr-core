import { ProcessingResult, WebReadyResult } from './fileProcessor'
import { NoteGraph, SearchIndex, ExportOptions } from './types'
import { getGraphStatistics } from './graphAnalysis'
import { createSearchRecord } from './search'

export interface ExportedData {
  notes: any[]
  graph: {
    nodes: any[]
    edges: any[]
    statistics: any
  }
  searchIndex: {
    documents: any[]
    stats: {
      totalDocuments: number
      totalTerms?: number
    }
  }
  statistics: {
    totalFiles: number
    totalErrors: number
    processingTime: number
  }
  metadata?: {
    exportedAt: string
    version: string
    sourceDirectory?: string
  }
}

export interface WebReadyExportedData {
  notes: any[]
  graph: {
    nodes: any[]
    edges: any[]
    statistics: any
  }
  searchIndex: {
    documents: any[]
    stats: {
      totalDocuments: number
      totalTerms?: number
    }
  }
  statistics: {
    totalFiles: number
    totalErrors: number
    processingTime: number
  }
  metadata?: {
    exportedAt: string
    version: string
    sourceDirectory?: string
  }
}

function serializeGraph(graph: NoteGraph): any {
  const nodes = Array.from(graph.nodes.entries()).map(([slug, node]) => ({
    slug,
    ...node
  }))
  
  const statistics = getGraphStatistics(graph)
  
  return {
    nodes,
    edges: graph.edges,
    statistics,
    orphans: Array.from(graph.orphans)
  }
}

function serializeSearchIndex(searchIndex: SearchIndex): any {
  const documents = Array.from(searchIndex.documents.entries()).map(([slug, note]) => {
    const record = createSearchRecord(note)

    return {
      slug,
      title: record.title,
      excerpt: record.excerpt,
      tags: record.tags,
      metadata: record.metadata
    }
  })
  
  return {
    documents,
    stats: {
      totalDocuments: searchIndex.documents.size
    }
  }
}

/**
 * Export data to JSON format (returns data structure, no file system access)
 */
export function exportToJSON(
  processingResult: ProcessingResult,
  graph: NoteGraph,
  searchIndex: SearchIndex,
  options: ExportOptions = {}
): ExportedData {
  const { pretty = true, includeMetadata = true } = options
  
  // Prepare notes data
  const notes = processingResult.files.map(file => ({
    slug: file.note.slug,
    path: file.relativePath,
    html: file.note.html,
    metadata: file.note.metadata,
    linksTo: file.note.linksTo,
    excerpt: file.note.excerpt
  }))
  
  // Prepare graph data
  const graphData = serializeGraph(graph)
  
  // Prepare search index data
  const searchData = serializeSearchIndex(searchIndex)
  
  // Prepare metadata
  const metadata = includeMetadata ? {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    totalNotes: notes.length
  } : undefined
  
  return {
    notes,
    graph: graphData,
    searchIndex: searchData,
    statistics: processingResult.statistics,
    ...(metadata && { metadata })
  }
}

/**
 * Export web-ready data to JSON format (returns data structure, no file system access)
 */
export function exportWebReadyToJSON(
  webReadyResult: WebReadyResult,
  graph: NoteGraph,
  searchIndex: SearchIndex,
  options: ExportOptions = {}
): WebReadyExportedData {
  const { pretty = true, includeMetadata = true } = options
  
  // Prepare web-ready notes data
  const notes = webReadyResult.files.map(file => ({
    slug: file.note.slug,
    path: file.relativePath,
    html: file.note.html,
    metadata: file.note.metadata,
    linksTo: file.note.linksTo,
    excerpt: file.note.excerpt,
    title: file.note.title,
    tags: file.note.tags,
    createdAt: file.note.createdAt,
    updatedAt: file.note.updatedAt,
    readingTime: file.note.readingTime,
    wordCount: file.note.wordCount,
    description: file.note.description,
    keywords: file.note.keywords,
    ogImage: file.note.ogImage
  }))
  
  // Prepare graph data
  const graphData = serializeGraph(graph)
  
  // Prepare search index data
  const searchData = serializeSearchIndex(searchIndex)
  
  // Prepare metadata
  const metadata = includeMetadata ? {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    totalNotes: notes.length
  } : undefined
  
  return {
    notes,
    graph: graphData,
    searchIndex: searchData,
    statistics: webReadyResult.statistics,
    ...(metadata && { metadata })
  }
}

/**
 * Convert exported data to JSON string
 */
export function toJSONString(data: ExportedData | WebReadyExportedData, pretty: boolean = true): string {
  return JSON.stringify(data, null, pretty ? 2 : undefined)
}

export type { ExportOptions }
