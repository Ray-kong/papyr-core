// Base interface for core processing
export interface ParsedNote {
  slug: string
  html: string
  metadata: Record<string, any>
  linksTo: string[]
  raw?: string
  excerpt?: string
}

// Extended interface for web applications
export interface WebReadyNote extends ParsedNote {
  // Web-specific computed fields
  title: string
  tags: string[]
  createdAt?: string
  updatedAt?: string
  readingTime?: number
  wordCount?: number
  description?: string
  keywords?: string[]
  ogImage?: string
}
export interface ParseOptions {
  path?: string  // filename to derive slug from
}

// Graph-related types
export interface BacklinkedNote extends ParsedNote {
  backlinks: string[]  // slugs of notes that link to this note
}

export interface GraphNode {
  id: string  // note slug
  label: string  // display name (usually title)
  metadata: Record<string, any>
  linkCount: number  // total number of connections
  backlinkCount: number
  forwardLinkCount: number
}

export interface GraphLink {
  source: string  // source note slug
  target: string  // target note slug
  label?: string  // optional link label
}

export interface NoteGraph {
  nodes: Map<string, GraphNode>
  edges: GraphLink[]
  backlinks: Map<string, Set<string>>  // slug -> Set of slugs that link to it
  orphans: Set<string>  // notes with no connections
}

export interface GraphOptions {
  includeOrphans?: boolean  // include unconnected notes in graph
  bidirectional?: boolean  // treat links as bidirectional
  minimumConnections?: number  // minimum connections to include node
}

// Search-related types
export interface SearchIndex {
  index: any  // FlexSearch index instance
  documents: Map<string, ParsedNote>  // slug -> note mapping for result lookup
}

export interface SearchResult {
  slug: string
  title: string
  excerpt: string
  score: number
  highlights?: SearchHighlight[]
  matchedFields: string[]  // which fields matched the query
}

export interface SearchHighlight {
  field: string  // 'title', 'content', 'metadata', etc.
  start: number
  end: number
  text: string
}

export interface SearchOptions {
  limit?: number  // max number of results (default: 20)
  fuzzy?: boolean  // enable fuzzy search (default: true)
  highlight?: boolean  // include highlights in results (default: false)
  fields?: string[]  // specific fields to search in
  tags?: string[]  // filter by metadata tags
  minimumScore?: number  // minimum relevance score
  boost?: SearchBoost  // field-specific scoring boost
}

export interface SearchBoost {
  title?: number  // boost factor for title matches (default: 3)
  metadata?: number  // boost factor for metadata matches (default: 2)
  content?: number  // boost factor for content matches (default: 1)
}

export interface IndexOptions {
  tokenize?: string  // tokenization strategy
  resolution?: number  // index resolution for performance tuning
  depth?: number  // contextual depth
  preset?: 'memory' | 'speed' | 'match' | 'score' | 'default'
}

// Builder-related types
export interface BuildConfig {
  sourceDir: string
  outputDir: string
  patterns?: {
    include?: string[]  // glob patterns for files to include
    exclude?: string[]  // glob patterns for files to exclude
  }
  processing?: {
    generateExcerpts?: boolean
    calculateReadingTime?: boolean
    extractKeywords?: boolean
    processImages?: boolean
  }
  output?: {
    formats?: ('json' | 'yaml' | 'csv' | 'markdown')[]
    separateFiles?: boolean  // output as separate files vs single bundle
    compress?: boolean
  }
  watch?: boolean  // enable file watching for development
}

export interface SourceFile {
  content: string
  filePath: string
  relativePath: string
  baseDir: string
  stats?: {
    size: number
    modified: Date
    created: Date
  }
}

export interface BuildResult {
  notes: WebReadyNote[]
  graph: NoteGraph
  searchIndex: SearchIndex
  analytics: AnalyticsResult
  buildInfo: BuildInfo
}

export interface BuildInfo {
  timestamp: string
  duration: number
  version: string
  config: BuildConfig
  sources: {
    totalFiles: number
    processedFiles: number
    skippedFiles: number
    errors: BuildError[]
  }
}

export interface BuildError {
  file: string
  error: string
  line?: number
  column?: number
}

// Analytics-related types
export interface AnalyticsResult {
  basic: BasicStats
  graph: GraphAnalytics
  content: ContentAnalytics
  tags: TagAnalytics
}

export interface BasicStats {
  totalNotes: number
  totalLinks: number
  orphanedNotes: number
  averageConnections: number
  totalWords: number
  averageWordsPerNote: number
  buildTime: number
}

export interface GraphAnalytics {
  nodeCount: number
  edgeCount: number
  orphanCount: number
  connectedComponents: number
  averageDegree: number
  density: number
  centrality: {
    highest: Array<{ id: string; score: number }>
    hubs: Array<{ id: string; score: number }>
    authorities: Array<{ id: string; score: number }>
  }
  clusters: Array<{
    id: string
    members: string[]
    density: number
  }>
}

export interface ContentAnalytics {
  wordDistribution: {
    min: number
    max: number
    average: number
    median: number
  }
  readingTimeDistribution: {
    min: number
    max: number
    average: number
  }
  linkDensity: {
    average: number
    distribution: Record<string, number>
  }
  orphanageRate: number
}

export interface TagAnalytics {
  totalTags: number
  averageTagsPerNote: number
  topTags: Array<{ tag: string; count: number; percentage: number }>
  tagDistribution: Record<string, number>
  relatedTags: Array<{
    tag1: string
    tag2: string
    cooccurrence: number
  }>
}

// Export-related types
export interface ExportFormat {
  format: 'json' | 'csv' | 'markdown' | 'yaml'
  filename: string
  options?: ExportOptions
}

export interface ExportOptions {
  includeMetadata?: boolean
  includeContent?: boolean
  includeAnalytics?: boolean
  compress?: boolean
  pretty?: boolean
}

export interface ExportBundle {
  files: Array<{
    filename: string
    content: string | Buffer
    mimeType: string
    size: number
  }>
  manifest: {
    generated: string
    formats: string[]
    totalSize: number
  }
} 