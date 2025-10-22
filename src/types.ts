// ===========================
// Branded Domain Types
// ===========================
// These provide type safety for string-based identifiers

/** Unique identifier for a note */
export type NoteId = string & { readonly __brand: 'NoteId' }

/** URL-safe slug derived from note filename */
export type Slug = string & { readonly __brand: 'Slug' }

/** Absolute or relative path to a vault location */
export type VaultPath = string & { readonly __brand: 'VaultPath' }

/** YAML frontmatter metadata */
export interface Frontmatter {
  [key: string]: unknown
  title?: string
  tags?: string[]
  aliases?: string[]
  created?: string
  updated?: string
  published?: boolean
}

/** Note metadata extracted from frontmatter and content */
export interface NoteMeta {
  title: string
  tags: string[]
  aliases: string[]
  created?: Date
  updated?: Date
  wordCount?: number
  readingTime?: number
}

// ===========================
// AST & Content Structure
// ===========================

/** Markdown AST node (using unified/remark structure) */
export interface ASTNode {
  type: string
  children?: ASTNode[]
  value?: string
  [key: string]: any
}

/** Heading structure extracted from markdown */
export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  slug: string
  line?: number
}

/** Code block extracted from markdown */
export interface CodeBlock {
  language?: string | null
  meta?: string | null
  value: string
}

/** Link reference within a note */
export interface LinkReference {
  type: 'wiki' | 'markdown' | 'embed'
  target: string
  alias?: string
  line?: number
}

/** Embedded content reference (transclusions) */
export interface EmbedReference extends LinkReference {
  type: 'embed'
  blockId?: string
  heading?: string
}

// ===========================
// Core Note Types
// ===========================

/** Base interface for core processing */
export interface ParsedNote {
  slug: Slug
  html: string
  metadata: Frontmatter
  linksTo: string[]
  embeds: string[]
  headings: Heading[]
  codeBlocks: CodeBlock[]
  raw?: string
  excerpt?: string
  ast?: ASTNode
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

// ===========================
// Folder & Tree Structure
// ===========================

/** Folder node for hierarchical vault navigation */
export interface FolderNode {
  name: string
  path: VaultPath
  children: FolderNode[]
  notes: Slug[]
  parent?: FolderNode
  depth: number
}

// ===========================
// Search-related types
// ===========================

export interface SearchIndexConfig {
  preset: string
  tokenize: string
  resolution: number
  depth: number
  context: {
    depth: number
    resolution: number
    bidirectional: boolean
  }
  document: {
    id: string
    index: Array<{ field: string; tokenize: string; preset: string }>
  }
}

/** Search index with FlexSearch and document store */
export interface SearchIndex {
  index: any  // FlexSearch index instance
  documents: Map<Slug, ParsedNote>  // slug -> original note mapping
  config: SearchIndexConfig
}

/** Serialized search index data for build outputs */
export interface SerializedSearchIndex {
  config: SearchIndexConfig
  index: Record<string, string>
  documents: Record<string, ParsedNote>
}

/** Indexed document record for search processing */
export interface SearchRecord {
  slug: Slug
  title: string
  content: string
  headings: string[]
  tags: string[]
  metadata: Frontmatter
  excerpt?: string
}

/** Individual search result hit */
export interface SearchHit {
  slug: Slug
  title: string
  excerpt: string
  score: number
  highlights?: SearchHighlight[]
  matchedFields: string[]  // which fields matched the query
}

/** @deprecated Use SearchHit instead */
export interface SearchResult extends SearchHit {}

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
  headings?: number  // boost factor for heading matches (default: 2.5)
  metadata?: number  // boost factor for metadata matches (default: 2)
  content?: number  // boost factor for content matches (default: 1)
}

export interface IndexOptions {
  tokenize?: string  // tokenization strategy
  resolution?: number  // index resolution for performance tuning
  depth?: number  // contextual depth
  preset?: 'memory' | 'speed' | 'match' | 'score' | 'default'
}

// ===========================
// Configuration Types
// ===========================

/** Main Papyr library configuration */
export interface PapyrConfig {
  /** Base path for link resolution */
  basePath?: string
  
  /** Link resolution strategy */
  linkResolver?: LinkResolverConfig
  
  /** HTML sanitization options */
  sanitize?: SanitizeConfig
  
  /** Theme and component customization */
  theme?: ThemeConfig
  
  /** Plugin system configuration */
  plugins?: PluginConfig[]
  
  /** Obsidian compatibility options */
  obsidian?: ObsidianCompatOptions
}

/** Link resolution configuration */
export interface LinkResolverConfig {
  /** Strategy for resolving wiki links */
  strategy: 'shortest' | 'relative' | 'absolute'
  
  /** Case sensitivity for link matching */
  caseSensitive?: boolean
  
  /** Handle broken links */
  onBrokenLink?: 'ignore' | 'warn' | 'error'
  
  /** Custom link transformer */
  transform?: (target: string) => string
}

/** HTML sanitization configuration */
export interface SanitizeConfig {
  /** Enable/disable sanitization */
  enabled?: boolean
  
  /** Allowed HTML tags */
  allowedTags?: string[]
  
  /** Allowed attributes */
  allowedAttributes?: Record<string, string[]>
  
  /** Allow class names */
  allowedClasses?: Record<string, string[]>
}

/** Theme configuration */
export interface ThemeConfig {
  /** Color scheme */
  mode?: 'light' | 'dark' | 'auto'
  
  /** Custom CSS classes */
  customClasses?: Record<string, string>
  
  /** Component overrides */
  components?: Record<string, any>
}

/** Plugin configuration */
export interface PluginConfig {
  /** Plugin name/identifier */
  name: string
  
  /** Plugin options */
  options?: Record<string, unknown>
  
  /** Enable/disable plugin */
  enabled?: boolean
}

/** Obsidian-specific compatibility options */
export interface ObsidianCompatOptions {
  /** Enable wiki-style links [[target]] */
  wikilinks?: boolean | WikilinkOptions
  
  /** Enable transclusions/embeds ![[target]] */
  transclusions?: boolean | TransclusionOptions
  
  /** Enable callout blocks */
  callouts?: boolean | CalloutOptions
  
  /** Tag prefix character (default: #) */
  tagPrefix?: string
  
  /** Enable dataview-style inline fields */
  dataview?: boolean
  
  /** Enable block references ^block-id */
  blockReferences?: boolean
}

/** Wiki link parsing options */
export interface WikilinkOptions {
  /** Parse aliases [[target|alias]] */
  parseAliases?: boolean
  
  /** Parse heading references [[target#heading]] */
  parseHeadings?: boolean
  
  /** Parse block references [[target^block]] */
  parseBlocks?: boolean
}

/** Transclusion/embed options */
export interface TransclusionOptions {
  /** Allow heading embeds ![[note#heading]] */
  allowHeadings?: boolean
  
  /** Allow block embeds ![[note^block]] */
  allowBlocks?: boolean
  
  /** Max nesting depth to prevent infinite loops */
  maxDepth?: number
}

/** Callout block options */
export interface CalloutOptions {
  /** Supported callout types */
  types?: string[]
  
  /** Allow foldable callouts */
  foldable?: boolean
  
  /** Custom callout renderer */
  renderer?: (type: string, content: string) => string
}

// ===========================
// Error Types
// ===========================

/** Discriminated union of all Papyr errors */
export type PapyrError = 
  | ParseError
  | LinkError
  | BuildError
  | ValidationError

/** Parser-related errors */
export interface ParseError {
  type: 'parse'
  code: 
    | 'INVALID_FRONTMATTER'
    | 'MALFORMED_MARKDOWN'
    | 'INVALID_YAML'
    | 'ENCODING_ERROR'
  message: string
  file: string
  line?: number
  column?: number
  context?: string
}

/** Link resolution errors */
export interface LinkError {
  type: 'link'
  code:
    | 'UNRESOLVED_LINK'
    | 'CIRCULAR_EMBED'
    | 'EMBED_DEPTH_EXCEEDED'
    | 'INVALID_LINK_FORMAT'
    | 'AMBIGUOUS_LINK'
  message: string
  source: string
  target: string
  suggestions?: string[]
}

/** Build process errors */
export interface BuildError {
  type: 'build'
  code:
    | 'FILE_NOT_FOUND'
    | 'PERMISSION_DENIED'
    | 'INVALID_CONFIG'
    | 'OUTPUT_WRITE_FAILED'
    | 'PLUGIN_ERROR'
  message: string
  file?: string
  plugin?: string
  cause?: Error
}

/** Validation errors */
export interface ValidationError {
  type: 'validation'
  code:
    | 'INVALID_SLUG'
    | 'DUPLICATE_SLUG'
    | 'INVALID_PATH'
    | 'MISSING_REQUIRED_FIELD'
  message: string
  field?: string
  value?: unknown
}

/** Error catalog for reference */
export const ERROR_MESSAGES = {
  // Parse errors
  INVALID_FRONTMATTER: 'Invalid YAML frontmatter syntax',
  MALFORMED_MARKDOWN: 'Malformed markdown structure',
  INVALID_YAML: 'YAML parsing failed',
  ENCODING_ERROR: 'File encoding not supported',
  
  // Link errors
  UNRESOLVED_LINK: 'Could not resolve link target',
  CIRCULAR_EMBED: 'Circular embed reference detected',
  EMBED_DEPTH_EXCEEDED: 'Maximum embed depth exceeded',
  INVALID_LINK_FORMAT: 'Invalid link format',
  AMBIGUOUS_LINK: 'Multiple targets match this link',
  
  // Build errors
  FILE_NOT_FOUND: 'File not found',
  PERMISSION_DENIED: 'Permission denied',
  INVALID_CONFIG: 'Invalid configuration',
  OUTPUT_WRITE_FAILED: 'Failed to write output',
  PLUGIN_ERROR: 'Plugin error',
  
  // Validation errors
  INVALID_SLUG: 'Invalid slug format',
  DUPLICATE_SLUG: 'Duplicate slug detected',
  INVALID_PATH: 'Invalid file path',
  MISSING_REQUIRED_FIELD: 'Required field is missing',
} as const

// ===========================
// Builder-related types
// ===========================

/** Build configuration (legacy - consider using PapyrConfig) */
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
  folderHierarchy: FolderNode
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
    errors: PapyrError[]
  }
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
