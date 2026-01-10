// Runtime-friendly exports for papyr-core
// This entry point deliberately omits build-time utilities that rely on Node APIs

export * from '../types'

export {
  buildNoteGraph,
  getBacklinks,
  getConnections,
  findShortestPath
} from '../graph'

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
} from '../graphAnalysis'

export {
  resolveLinks,
  findOrphanedLinks,
  createLinkMaps,
  validateLinks,
  getReachableNotes
} from '../linkResolver'

export {
  buildFolderHierarchy,
  calculateFolderStats,
  findFolderByPath,
  getAllNotesInFolder
} from '../folderHierarchy'

export {
  generateSearchIndex,
  searchNotes,
  addNoteToIndex,
  removeNoteFromIndex,
  updateNoteInIndex,
  getSearchSuggestions,
  createSearchRecord,
  exportSearchIndex,
  importSearchIndex
} from '../search'

export {
  exportToJSON,
  exportWebReadyToJSON,
  toJSONString
} from '../jsonExporter'

export {
  AnalyticsEngine
} from '../analytics'
