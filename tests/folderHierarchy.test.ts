import { describe, it, expect } from 'vitest'
import { 
  buildFolderHierarchy, 
  calculateFolderStats,
  findFolderByPath,
  getAllNotesInFolder
} from '../src/folderHierarchy'
import { SourceFile, FolderNode, VaultPath, Slug } from '../src/types'

describe('buildFolderHierarchy', () => {
  it('should create a root folder for empty file list', () => {
    const files: SourceFile[] = []
    const hierarchy = buildFolderHierarchy(files, 'test-vault')

    expect(hierarchy.name).toBe('test-vault')
    expect(hierarchy.path).toBe('')
    expect(hierarchy.depth).toBe(0)
    expect(hierarchy.children).toEqual([])
    expect(hierarchy.notes).toEqual([])
  })

  it('should handle files in the root directory', () => {
    const files: SourceFile[] = [
      {
        content: '# Note 1',
        filePath: 'note1.md',
        relativePath: 'note1.md',
        baseDir: '/vault'
      },
      {
        content: '# Note 2',
        filePath: 'note2.md',
        relativePath: 'note2.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files)

    expect(hierarchy.notes).toHaveLength(2)
    expect(hierarchy.notes).toContain('note1' as Slug)
    expect(hierarchy.notes).toContain('note2' as Slug)
    expect(hierarchy.children).toEqual([])
  })

  it('should slugify filenames when no explicit slug is provided', () => {
    const files: SourceFile[] = [
      {
        content: '# My Note',
        filePath: 'My Note.md',
        relativePath: 'My Note.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files)

    expect(hierarchy.notes).toEqual(['my-note'])
  })

  it('should use provided note slugs when available', () => {
    const files: SourceFile[] = [
      {
        content: '# Custom Note',
        filePath: 'folder/My Note.md',
        relativePath: 'folder/My Note.md',
        baseDir: '/vault'
      }
    ]

    const slugs = new Map<string, Slug>([
      ['folder/My Note.md', 'custom-topic' as Slug]
    ])

    const hierarchy = buildFolderHierarchy(files, 'vault', slugs)
    const folder = hierarchy.children.find(child => child.name === 'folder')

    expect(folder).toBeDefined()
    expect(folder!.notes).toEqual(['custom-topic'])
  })

  it('should create folder structure from nested paths', () => {
    const files: SourceFile[] = [
      {
        content: '# Root note',
        filePath: 'root.md',
        relativePath: 'root.md',
        baseDir: '/vault'
      },
      {
        content: '# Folder note',
        filePath: 'folder/note.md',
        relativePath: 'folder/note.md',
        baseDir: '/vault'
      },
      {
        content: '# Nested note',
        filePath: 'folder/subfolder/nested.md',
        relativePath: 'folder/subfolder/nested.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files, 'vault')

    // Root should have 1 note and 1 folder
    expect(hierarchy.notes).toEqual(['root'])
    expect(hierarchy.children).toHaveLength(1)

    // Check folder
    const folder = hierarchy.children[0]
    expect(folder.name).toBe('folder')
    expect(folder.path).toBe('folder')
    expect(folder.depth).toBe(1)
    expect(folder.notes).toEqual(['note'])
    expect(folder.children).toHaveLength(1)

    // Check subfolder
    const subfolder = folder.children[0]
    expect(subfolder.name).toBe('subfolder')
    expect(subfolder.path).toBe('folder/subfolder')
    expect(subfolder.depth).toBe(2)
    expect(subfolder.notes).toEqual(['nested'])
    expect(subfolder.children).toEqual([])
  })

  it('should handle multiple files in the same folder', () => {
    const files: SourceFile[] = [
      {
        content: '# Note 1',
        filePath: 'folder/note1.md',
        relativePath: 'folder/note1.md',
        baseDir: '/vault'
      },
      {
        content: '# Note 2',
        filePath: 'folder/note2.md',
        relativePath: 'folder/note2.md',
        baseDir: '/vault'
      },
      {
        content: '# Note 3',
        filePath: 'folder/note3.md',
        relativePath: 'folder/note3.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files)
    const folder = hierarchy.children[0]

    expect(folder.notes).toHaveLength(3)
    expect(folder.notes).toContain('note1' as Slug)
    expect(folder.notes).toContain('note2' as Slug)
    expect(folder.notes).toContain('note3' as Slug)
  })

  it('should sort folders and notes alphabetically', () => {
    const files: SourceFile[] = [
      {
        content: '',
        filePath: 'zebra.md',
        relativePath: 'zebra.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'alpha.md',
        relativePath: 'alpha.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'beta/note.md',
        relativePath: 'beta/note.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'alpha-folder/note.md',
        relativePath: 'alpha-folder/note.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files)

    // Notes should be sorted
    expect(hierarchy.notes).toEqual(['alpha', 'zebra'])

    // Folders should be sorted
    expect(hierarchy.children[0].name).toBe('alpha-folder')
    expect(hierarchy.children[1].name).toBe('beta')
  })

  it('should handle complex nested structures', () => {
    const files: SourceFile[] = [
      {
        content: '',
        filePath: 'projects/2023/project-a/readme.md',
        relativePath: 'projects/2023/project-a/readme.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'projects/2023/project-b/readme.md',
        relativePath: 'projects/2023/project-b/readme.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'projects/2024/project-c/readme.md',
        relativePath: 'projects/2024/project-c/readme.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'daily/2023/january.md',
        relativePath: 'daily/2023/january.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files)

    expect(hierarchy.children).toHaveLength(2)
    
    const projectsFolder = hierarchy.children.find(f => f.name === 'projects')
    expect(projectsFolder).toBeDefined()
    expect(projectsFolder!.children).toHaveLength(2) // 2023 and 2024

    const projects2023 = projectsFolder!.children.find(f => f.name === '2023')
    expect(projects2023!.children).toHaveLength(2) // project-a and project-b
  })

  it('should set parent references correctly', () => {
    const files: SourceFile[] = [
      {
        content: '',
        filePath: 'folder/subfolder/note.md',
        relativePath: 'folder/subfolder/note.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files)
    const folder = hierarchy.children[0]
    const subfolder = folder.children[0]

    expect(folder.parent).toBe(hierarchy)
    expect(subfolder.parent).toBe(folder)
  })

  it('should resolve slugs using lookup map and object inputs', () => {
    const files: SourceFile[] = [
      {
        content: '',
        filePath: 'docs/intro.md',
        relativePath: 'docs/intro.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'docs/guide.md',
        relativePath: './docs/guide.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'docs/tutorial.md',
        relativePath: 'docs\\tutorial.md',
        baseDir: '/vault'
      }
    ]

    const mapLookup = new Map<string, Slug>([
      ['docs/intro.md', 'intro-slug' as Slug]
    ])
    const objectLookup: Record<string, Slug> = {
      './docs/guide.md': 'guide-slug' as Slug
    }

    const hierarchyFromMap = buildFolderHierarchy(files.slice(0, 2), 'root', mapLookup)
    const docsFolderFromMap = hierarchyFromMap.children.find(f => f.name === 'docs')
    expect(docsFolderFromMap?.notes).toEqual(['guide', 'intro-slug'] as Slug[])

    const hierarchyFromObject = buildFolderHierarchy(files, 'root', objectLookup)
    const docsFolderFromObject = hierarchyFromObject.children.find(f => f.name === 'docs')
    expect(docsFolderFromObject?.notes).toEqual(['guide-slug', 'intro', 'tutorial'] as Slug[])
  })
})

describe('calculateFolderStats', () => {
  it('should calculate correct stats for simple hierarchy', () => {
    const files: SourceFile[] = [
      {
        content: '',
        filePath: 'note1.md',
        relativePath: 'note1.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'folder/note2.md',
        relativePath: 'folder/note2.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files)
    const stats = calculateFolderStats(hierarchy)

    expect(stats.totalFolders).toBe(2) // root + folder
    expect(stats.totalNotes).toBe(2)
    expect(stats.maxDepth).toBe(1)
    expect(stats.averageNotesPerFolder).toBe(1) // 2 notes / 2 folders
  })

  it('should identify largest folder', () => {
    const files: SourceFile[] = [
      {
        content: '',
        filePath: 'small/note1.md',
        relativePath: 'small/note1.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'large/note1.md',
        relativePath: 'large/note1.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'large/note2.md',
        relativePath: 'large/note2.md',
        baseDir: '/vault'
      },
      {
        content: '',
        filePath: 'large/note3.md',
        relativePath: 'large/note3.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files)
    const stats = calculateFolderStats(hierarchy)

    expect(stats.largestFolder.path).toBe('large')
    expect(stats.largestFolder.noteCount).toBe(3)
  })

  it('should calculate max depth correctly', () => {
    const files: SourceFile[] = [
      {
        content: '',
        filePath: 'a/b/c/d/e/note.md',
        relativePath: 'a/b/c/d/e/note.md',
        baseDir: '/vault'
      }
    ]

    const hierarchy = buildFolderHierarchy(files)
    const stats = calculateFolderStats(hierarchy)

    expect(stats.maxDepth).toBe(5) // a=1, b=2, c=3, d=4, e=5
  })
})

describe('findFolderByPath', () => {
  const files: SourceFile[] = [
    {
      content: '',
      filePath: 'folder/subfolder/note.md',
      relativePath: 'folder/subfolder/note.md',
      baseDir: '/vault'
    },
    {
      content: '',
      filePath: 'other/note.md',
      relativePath: 'other/note.md',
      baseDir: '/vault'
    }
  ]

  const hierarchy = buildFolderHierarchy(files)

  it('should find root folder', () => {
    const found = findFolderByPath(hierarchy, '')
    expect(found).toBe(hierarchy)
  })

  it('should find nested folder by path', () => {
    const found = findFolderByPath(hierarchy, 'folder/subfolder')
    expect(found).toBeDefined()
    expect(found!.name).toBe('subfolder')
    expect(found!.path).toBe('folder/subfolder')
  })

  it('should find top-level folder', () => {
    const found = findFolderByPath(hierarchy, 'folder')
    expect(found).toBeDefined()
    expect(found!.name).toBe('folder')
  })

  it('should return null for non-existent path', () => {
    const found = findFolderByPath(hierarchy, 'does-not-exist')
    expect(found).toBeNull()
  })
})

describe('getAllNotesInFolder', () => {
  const files: SourceFile[] = [
    {
      content: '',
      filePath: 'folder/note1.md',
      relativePath: 'folder/note1.md',
      baseDir: '/vault'
    },
    {
      content: '',
      filePath: 'folder/note2.md',
      relativePath: 'folder/note2.md',
      baseDir: '/vault'
    },
    {
      content: '',
      filePath: 'folder/subfolder/note3.md',
      relativePath: 'folder/subfolder/note3.md',
      baseDir: '/vault'
    },
    {
      content: '',
      filePath: 'folder/subfolder/note4.md',
      relativePath: 'folder/subfolder/note4.md',
      baseDir: '/vault'
    }
  ]

  const hierarchy = buildFolderHierarchy(files)
  const folder = findFolderByPath(hierarchy, 'folder')!

  it('should get only direct notes when not recursive', () => {
    const notes = getAllNotesInFolder(folder, false)
    expect(notes).toHaveLength(2)
    expect(notes).toContain('note1' as Slug)
    expect(notes).toContain('note2' as Slug)
  })

  it('should get all notes including subfolders when recursive', () => {
    const notes = getAllNotesInFolder(folder, true)
    expect(notes).toHaveLength(4)
    expect(notes).toContain('note1' as Slug)
    expect(notes).toContain('note2' as Slug)
    expect(notes).toContain('note3' as Slug)
    expect(notes).toContain('note4' as Slug)
  })

  it('should handle empty folders', () => {
    const emptyFolder: FolderNode = {
      name: 'empty',
      path: 'empty' as VaultPath,
      children: [],
      notes: [],
      depth: 1
    }

    const notes = getAllNotesInFolder(emptyFolder, true)
    expect(notes).toEqual([])
  })
})
