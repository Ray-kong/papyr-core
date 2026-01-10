import { FolderNode, VaultPath, Slug, SourceFile } from './types.js'
import slugify from 'slugify'

/**
 * Build a folder hierarchy tree from a list of source files
 * 
 * @param files - Array of source files with relative paths
 * @param rootName - Name for the root folder (default: 'root')
 * @returns Root FolderNode representing the complete folder hierarchy
 */
export function buildFolderHierarchy(
  files: SourceFile[],
  rootName: string = 'root',
  slugsByPath?: Map<string, Slug> | Record<string, Slug>
): FolderNode {
  // Create root node
  const root: FolderNode = {
    name: rootName,
    path: '' as VaultPath,
    children: [],
    notes: [],
    depth: 0
  }

  const slugLookup = normalizeSlugLookup(slugsByPath)

  // Map to track all folder nodes by their path
  const folderMap = new Map<string, FolderNode>()
  folderMap.set('', root)

  // Process each file
  for (const file of files) {
    const normalizedPath = normalizePath(file.relativePath)
    const pathParts = normalizedPath.split('/')
    
    // Get the file slug (filename without extension)
    const fileName = pathParts[pathParts.length - 1]
    const slug = resolveSlugForPath(normalizedPath, fileName, slugLookup)

    // Build folder structure for this file's path
    let currentPath = ''
    let currentFolder = root

    // Process each directory in the path (excluding the file itself)
    for (let i = 0; i < pathParts.length - 1; i++) {
      const folderName = pathParts[i]
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName

      // Check if folder node already exists
      let folderNode = folderMap.get(currentPath)

      if (!folderNode) {
        // Create new folder node
        folderNode = {
          name: folderName,
          path: currentPath as VaultPath,
          children: [],
          notes: [],
          parent: currentFolder,
          depth: currentFolder.depth + 1
        }

        // Add to parent's children
        currentFolder.children.push(folderNode)

        // Add to map
        folderMap.set(currentPath, folderNode)
      }

      // Move to this folder for next iteration
      currentFolder = folderNode
    }

    // Add the note to the current folder
    currentFolder.notes.push(slug)
  }

  // Sort folders and notes alphabetically for consistent output
  sortFolderHierarchy(root)

  return root
}

/**
 * Recursively sort folder hierarchy
 * - Children folders are sorted alphabetically by name
 * - Notes are sorted alphabetically by slug
 */
function sortFolderHierarchy(node: FolderNode): void {
  // Sort children folders alphabetically
  node.children.sort((a, b) => a.name.localeCompare(b.name))

  // Sort notes alphabetically
  node.notes.sort((a, b) => a.localeCompare(b))

  // Recursively sort children
  for (const child of node.children) {
    sortFolderHierarchy(child)
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function normalizeSlugLookup(
  source?: Map<string, Slug> | Record<string, Slug>
): Map<string, Slug> | undefined {
  if (!source) {
    return undefined
  }

  const lookup = new Map<string, Slug>()
  if (source instanceof Map) {
    source.forEach((slug, key) => {
      lookup.set(normalizePath(key), slug)
    })
  } else {
    for (const [key, slug] of Object.entries(source)) {
      lookup.set(normalizePath(key), slug)
    }
  }

  return lookup
}

function resolveSlugForPath(
  normalizedPath: string,
  fileName: string,
  slugLookup?: Map<string, Slug>
): Slug {
  if (slugLookup) {
    const slugFromLookup = slugLookup.get(normalizedPath)
    if (slugFromLookup) {
      return slugFromLookup
    }
  }

  const baseName = fileName.replace(/\.[^.]+$/, '')
  const fallback = slugify(baseName, { lower: true, strict: true })
  return fallback as Slug
}

/**
 * Get folder statistics from the hierarchy
 */
export interface FolderStats {
  totalFolders: number
  totalNotes: number
  maxDepth: number
  averageNotesPerFolder: number
  largestFolder: {
    path: string
    noteCount: number
  }
}

/**
 * Calculate statistics about the folder hierarchy
 */
export function calculateFolderStats(root: FolderNode): FolderStats {
  let totalFolders = 0
  let totalNotes = 0
  let maxDepth = 0
  let largestFolder = { path: '', noteCount: 0 }

  function traverse(node: FolderNode): void {
    totalFolders++
    totalNotes += node.notes.length
    maxDepth = Math.max(maxDepth, node.depth)

    if (node.notes.length > largestFolder.noteCount) {
      largestFolder = {
        path: node.path,
        noteCount: node.notes.length
      }
    }

    for (const child of node.children) {
      traverse(child)
    }
  }

  traverse(root)

  return {
    totalFolders,
    totalNotes,
    maxDepth,
    averageNotesPerFolder: totalFolders > 0 ? totalNotes / totalFolders : 0,
    largestFolder
  }
}

/**
 * Find a folder node by path
 */
export function findFolderByPath(root: FolderNode, targetPath: string): FolderNode | null {
  if (root.path === targetPath) {
    return root
  }

  for (const child of root.children) {
    const found = findFolderByPath(child, targetPath)
    if (found) {
      return found
    }
  }

  return null
}

/**
 * Get all notes in a folder and its subfolders (recursive)
 */
export function getAllNotesInFolder(folder: FolderNode, recursive: boolean = false): Slug[] {
  const notes = [...folder.notes]

  if (recursive) {
    for (const child of folder.children) {
      notes.push(...getAllNotesInFolder(child, true))
    }
  }

  return notes
}
