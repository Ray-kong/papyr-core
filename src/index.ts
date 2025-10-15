// @papyr/core - Core types and utilities
export * from './types'
export { parseMarkdown, toWebReadyNote } from './parseMarkdown'

// Graph and link resolution
export { 
  buildNoteGraph, 
  getBacklinks, 
  getConnections,
  findShortestPath 
} from './graph'

export { 
  resolveLinks, 
  findOrphanedLinks,
  createLinkMaps,
  validateLinks,
  getReachableNotes
} from './linkResolver'

export {
  findOrphanedNotes,
  findMostLinkedNotes,
  findMostReferencedNotes,
  calculateCentrality,
  getConnectedComponents,
  getGraphStatistics,
  findHubs,
  findAuthorities,
  getNeighborhood
} from './graphAnalysis'

// Search functionality
export {
  generateSearchIndex,
  searchNotes,
  addNoteToIndex,
  removeNoteFromIndex,
  updateNoteInIndex,
  getSearchSuggestions,
  exportSearchIndex,
  importSearchIndex
} from './search'

// Content processing (no file system access)
export {
  processMarkdownContent,
  processMarkdownContentToWeb,
  processMarkdownContents,
  processMarkdownContentsToWeb,
  type ProcessedFile,
  type WebReadyFile,
  type ProcessingResult,
  type WebReadyResult
} from './fileProcessor'

// JSON export (no file system access)
export {
  exportToJSON,
  exportWebReadyToJSON,
  toJSONString,
  type ExportOptions,
  type ExportedData,
  type WebReadyExportedData
} from './jsonExporter'

// Folder hierarchy
export {
  buildFolderHierarchy,
  calculateFolderStats,
  findFolderByPath,
  getAllNotesInFolder,
  type FolderStats
} from './folderHierarchy'

// Build automation and analytics
export { PapyrBuilder } from './builder'
export { AnalyticsEngine } from './analytics' 
