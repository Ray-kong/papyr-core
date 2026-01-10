import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PapyrBuilder, type BuildConfig, type BuildResult } from '../src/builder.js';

const createWebNote = (slug: string, title: string) => ({
  slug,
  title,
  html: `<h1>${title}</h1>`,
  metadata: {},
  linksTo: [],
  embeds: [],
  headings: [],
  tags: [],
  wordCount: 0,
  readingTime: 0,
  description: title,
  keywords: []
});

const createWebFile = (note: ReturnType<typeof createWebNote>, relativePath: string) => ({
  note,
  relativePath,
  filePath: relativePath
});

const createBuildResult = (builder: PapyrBuilder): BuildResult => ({
  notes: [],
  graph: { nodes: new Map(), edges: [], backlinks: new Map(), orphans: new Set() } as any,
  searchIndex: {
    documents: new Map(),
    index: {},
    config: {
      preset: 'default',
      tokenize: 'forward',
      resolution: 9,
      depth: 4,
      context: { depth: 4, resolution: 9, bidirectional: false },
      document: {
        id: 'slug',
        index: [
          { field: 'title', tokenize: 'forward', preset: 'default' },
          { field: 'content', tokenize: 'forward', preset: 'default' },
          { field: 'tags', tokenize: 'forward', preset: 'default' },
          { field: 'metadata', tokenize: 'forward', preset: 'default' }
        ]
      }
    }
  },
  analytics: {
    basic: {
      totalNotes: 0,
      totalLinks: 0,
      orphanedNotes: 0,
      averageConnections: 0,
      buildTime: 0
    },
    graph: {} as any,
    content: {} as any,
    tags: { topTags: [] }
  },
  buildInfo: {
    timestamp: new Date().toISOString(),
    duration: 0,
    version: 'test',
    config: (builder as any).config,
    sources: {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errors: []
    }
  },
  folderHierarchy: {
    name: 'root',
    path: '',
    depth: 0,
    notes: [],
    children: []
  }
});

// Mock the dependencies
vi.mock('../src/index.js', () => ({
  processMarkdownContentsToWeb: vi.fn(),
  buildNoteGraph: vi.fn(),
  generateSearchIndex: vi.fn(),
  exportSearchIndex: vi.fn().mockResolvedValue({
    config: {
      preset: 'default',
      tokenize: 'forward',
      resolution: 9,
      depth: 4,
      context: { depth: 4, resolution: 9, bidirectional: false },
      document: {
        id: 'slug',
        index: [
          { field: 'title', tokenize: 'forward', preset: 'default' },
          { field: 'content', tokenize: 'forward', preset: 'default' },
          { field: 'tags', tokenize: 'forward', preset: 'default' },
          { field: 'metadata', tokenize: 'forward', preset: 'default' }
        ]
      }
    },
    index: {},
    documents: {}
  })
}));

vi.mock('../src/analytics.js', () => ({
  AnalyticsEngine: vi.fn().mockImplementation(() => ({
    calculateAnalytics: vi.fn().mockReturnValue({
      basic: {
        totalNotes: 2,
        totalLinks: 1,
        orphanedNotes: 0,
        averageConnections: 0.5,
        buildTime: 100
      },
      tags: {
        topTags: [{ tag: 'test', count: 1 }]
      }
    })
  }))
}));

describe('PapyrBuilder', () => {
  let tempDir: string;
  let outputDir: string;
  let sourceDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Create temporary directories using cross-platform temp dir
    const tmpPrefix = path.join(os.tmpdir(), 'papyr-test-');
    tempDir = await fs.promises.mkdtemp(tmpPrefix);
    sourceDir = path.join(tempDir, 'source');
    outputDir = path.join(tempDir, 'output');
    
    await fs.promises.mkdir(sourceDir, { recursive: true });
    await fs.promises.mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directories
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('Constructor', () => {
    it('should create builder with default config', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);

      expect(builder).toBeDefined();
      // Verify output directory was created
      expect(fs.existsSync(outputDir)).toBe(true);
    });

    it('should merge custom patterns with defaults', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir,
        patterns: {
          include: ['**/*.txt', '**/*.md'],
          exclude: ['**/temp/**']
        }
      };

      const builder = new PapyrBuilder(config);
      expect(builder).toBeDefined();
    });

    it('should merge custom processing options', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir,
        processing: {
          generateExcerpts: false,
          calculateReadingTime: false,
          extractKeywords: true,
          processImages: true
        }
      };

      const builder = new PapyrBuilder(config);
      expect(builder).toBeDefined();
    });

    it('should merge custom output options', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir,
        output: {
          formats: ['json', 'csv'],
          separateFiles: false,
          compress: true
        }
      };

      const builder = new PapyrBuilder(config);
      expect(builder).toBeDefined();
    });

    it('should create output directory if it does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent');
      const config: BuildConfig = {
        sourceDir,
        outputDir: nonExistentDir
      };

      expect(fs.existsSync(nonExistentDir)).toBe(false);
      
      const builder = new PapyrBuilder(config);
      
      expect(fs.existsSync(nonExistentDir)).toBe(true);
    });
  });

  describe('Pattern matching', () => {
    it('should exclude nested node_modules directories with default patterns', () => {
      const builder = new PapyrBuilder({ sourceDir, outputDir });
      const shouldExclude = (builder as any).shouldExcludeFile.bind(builder) as (path: string) => boolean;

      expect(shouldExclude('node_modules/file.md')).toBe(true);
      expect(shouldExclude('nested/node_modules/file.md')).toBe(true);
      expect(shouldExclude('deep/nested/node_modules/sub/file.md')).toBe(true);
      expect(shouldExclude('notes/content.md')).toBe(false);
    });

    it('should exclude nested .git directories with default patterns', () => {
      const builder = new PapyrBuilder({ sourceDir, outputDir });
      const shouldExclude = (builder as any).shouldExcludeFile.bind(builder) as (path: string) => boolean;

      expect(shouldExclude('.git/config')).toBe(true);
      expect(shouldExclude('nested/.git/config')).toBe(true);
      expect(shouldExclude('deep/nested/.git/HEAD')).toBe(true);
      expect(shouldExclude('deep/git-not/folder.md')).toBe(false);
    });

    it('should keep relative include patterns anchored to source root', () => {
      const builder = new PapyrBuilder({
        sourceDir,
        outputDir,
        patterns: {
          include: ['notes/*.md']
        }
      });
      const shouldInclude = (builder as any).shouldIncludeFile.bind(builder) as (path: string) => boolean;

      expect(shouldInclude('notes/file.md')).toBe(true);
      expect(shouldInclude('archive/notes/file.md')).toBe(false);
      expect(shouldInclude('notes/subdir/file.md')).toBe(false);
    });
  });

  describe('Build Pipeline', () => {
    it('should execute successful build', async () => {
      // Create test markdown files
      await fs.promises.writeFile(
        path.join(sourceDir, 'note1.md'),
        '# Note 1\n\nContent with [[Note 2]] link.'
      );
      await fs.promises.writeFile(
        path.join(sourceDir, 'note2.md'),
        '# Note 2\n\nContent of note 2.'
      );

      const { processMarkdownContentsToWeb, buildNoteGraph, generateSearchIndex } = await import('../src/index.js');
      
      // Mock the dependencies
      const mockNotes = [
        createWebNote('note-1', 'Note 1'),
        createWebNote('note-2', 'Note 2')
      ];
      
      vi.mocked(processMarkdownContentsToWeb).mockResolvedValue({
        files: mockNotes.map((note, index) => createWebFile(note, `note${index + 1}.md`)),
        errors: []
      });
      vi.mocked(buildNoteGraph).mockReturnValue({ nodes: new Map(), edges: [] });
      vi.mocked(generateSearchIndex).mockReturnValue({ documents: new Map() });

      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const result = await builder.build();

      expect(result).toBeDefined();
      expect(result.notes).toHaveLength(2);
      expect(result.graph).toBeDefined();
      expect(result.searchIndex).toBeDefined();
      expect(result.analytics).toBeDefined();
      expect(result.buildInfo).toBeDefined();
    });

    it('should handle build with processing errors', async () => {
      await fs.promises.writeFile(
        path.join(sourceDir, 'note1.md'),
        '# Note 1\n\nContent.'
      );

      const { processMarkdownContentsToWeb, buildNoteGraph, generateSearchIndex } = await import('../src/index.js');
      
      vi.mocked(processMarkdownContentsToWeb).mockResolvedValue({
        files: [],
        errors: [
          {
            filePath: 'note1.md',
            error: new Error('Processing failed')
          }
        ]
      });
      vi.mocked(buildNoteGraph).mockReturnValue({ nodes: new Map(), edges: [] });
      vi.mocked(generateSearchIndex).mockReturnValue({ documents: new Map() });

      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const result = await builder.build();

      expect(result.buildInfo.sources.errors).toHaveLength(1);
      expect(result.buildInfo.sources.errors[0].file).toBe('note1.md');
    });

    it('should calculate build time', async () => {
      await fs.promises.writeFile(
        path.join(sourceDir, 'note1.md'),
        '# Note 1\n\nContent.'
      );

      const { processMarkdownContentsToWeb, buildNoteGraph, generateSearchIndex } = await import('../src/index.js');
      
      vi.mocked(processMarkdownContentsToWeb).mockResolvedValue({
        files: [createWebFile(createWebNote('note-1', 'Note 1'), 'note1.md')],
        errors: []
      });
      vi.mocked(buildNoteGraph).mockReturnValue({ nodes: new Map(), edges: [] });
      vi.mocked(generateSearchIndex).mockReturnValue({ documents: new Map() });

      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const result = await builder.build();

      expect(result.buildInfo.duration).toBeGreaterThanOrEqual(0);
      expect(result.analytics.basic.buildTime).toBeGreaterThanOrEqual(0);
    });

    it('should fallback to default error metadata when plugin error lacks details', async () => {
      await fs.promises.writeFile(
        path.join(sourceDir, 'note1.md'),
        '# Note 1\n\nContent.'
      );

      const { processMarkdownContentsToWeb, buildNoteGraph, generateSearchIndex } = await import('../src/index.js');

      vi.mocked(processMarkdownContentsToWeb).mockResolvedValue({
        files: [],
        errors: [
          {
            filePath: undefined,
            error: undefined
          }
        ]
      });
      vi.mocked(buildNoteGraph).mockReturnValue({ nodes: new Map(), edges: [] });
      vi.mocked(generateSearchIndex).mockReturnValue({ documents: new Map() });

      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const result = await builder.build();

      expect(result.buildInfo.sources.errors).toHaveLength(1);
      expect(result.buildInfo.sources.errors[0].message).toBe('Unknown error');
      expect(result.buildInfo.sources.errors[0].file).toBe('unknown');
    });

    it('should rethrow and log build failures', async () => {
      await fs.promises.writeFile(
        path.join(sourceDir, 'note1.md'),
        '# Note 1\n\nContent.'
      );

      const { processMarkdownContentsToWeb } = await import('../src/index.js');
      vi.mocked(processMarkdownContentsToWeb).mockRejectedValueOnce(new Error('pipeline boom'));

      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(builder.build()).rejects.toThrow('pipeline boom');
      expect(errorSpy).toHaveBeenCalledWith('❌ Build failed:', expect.any(Error));

      errorSpy.mockRestore();
    });

    it('should ignore web files without path metadata when building folder hierarchy', async () => {
      await fs.promises.writeFile(
        path.join(sourceDir, 'note1.md'),
        '# Note 1\n\nContent.'
      );

      const {
        processMarkdownContentsToWeb,
        buildNoteGraph,
        generateSearchIndex
      } = await import('../src/index.js');
      const folderModule = await import('../src/folderHierarchy.js');

      const noteWithPath = createWebNote('note-1', 'Note 1');
      const noteWithoutPath = createWebNote('note-2', 'Note 2');

      vi.mocked(processMarkdownContentsToWeb).mockResolvedValue({
        files: [
          createWebFile(noteWithPath, 'note1.md'),
          { note: noteWithoutPath, relativePath: undefined, filePath: undefined }
        ],
        errors: []
      });
      vi.mocked(buildNoteGraph).mockReturnValue({ nodes: new Map(), edges: [] });
      vi.mocked(generateSearchIndex).mockReturnValue({ documents: new Map() });

      const folderSpy = vi
        .spyOn(folderModule, 'buildFolderHierarchy')
        .mockImplementation((sourceFiles, baseName, slugLookup) => {
          expect(Array.from(slugLookup.entries())).toEqual([
            ['note1.md', noteWithPath.slug]
          ]);
          return {
            name: baseName,
            path: '',
            depth: 0,
            notes: [],
            children: []
          };
        });

      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      await builder.build();

      folderSpy.mockRestore();
    });
  });

  describe('File Discovery', () => {
    it('should discover markdown files', async () => {
      await fs.promises.writeFile(path.join(sourceDir, 'note1.md'), '# Note 1');
      await fs.promises.writeFile(path.join(sourceDir, 'note2.md'), '# Note 2');
      await fs.promises.writeFile(path.join(sourceDir, 'readme.txt'), 'Not markdown');

      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      
      // Access private method for testing
      const discoverSourceFiles = (builder as any).discoverSourceFiles.bind(builder);
      const files = await discoverSourceFiles();

      expect(files).toHaveLength(2);
      expect(files.some(f => f.relativePath === 'note1.md')).toBe(true);
      expect(files.some(f => f.relativePath === 'note2.md')).toBe(true);
    });

    it('should exclude node_modules and .git directories', async () => {
      await fs.promises.mkdir(path.join(sourceDir, 'node_modules'), { recursive: true });
      await fs.promises.mkdir(path.join(sourceDir, '.git'), { recursive: true });
      await fs.promises.writeFile(path.join(sourceDir, 'node_modules', 'package.md'), '# Package');
      await fs.promises.writeFile(path.join(sourceDir, '.git', 'config.md'), '# Config');
      await fs.promises.writeFile(path.join(sourceDir, 'note1.md'), '# Note 1');

      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const discoverSourceFiles = (builder as any).discoverSourceFiles.bind(builder);
      const files = await discoverSourceFiles();

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('note1.md');
    });

    it('should handle custom include patterns', async () => {
      await fs.promises.writeFile(path.join(sourceDir, 'note1.md'), '# Note 1');
      await fs.promises.writeFile(path.join(sourceDir, 'note1.txt'), '# Note 1 Text');
      await fs.promises.mkdir(path.join(sourceDir, 'subdir'), { recursive: true });
      await fs.promises.writeFile(path.join(sourceDir, 'subdir', 'note2.md'), '# Note 2');

      const config: BuildConfig = {
        sourceDir,
        outputDir,
        patterns: {
          include: ['*.txt', 'subdir/**/*.md']
        }
      };

      const builder = new PapyrBuilder(config);
      const discoverSourceFiles = (builder as any).discoverSourceFiles.bind(builder);
      const files = await discoverSourceFiles();

      expect(files).toHaveLength(3);
      expect(files.some(f => f.relativePath === 'note1.md')).toBe(true);
      expect(files.some(f => f.relativePath === 'note1.txt')).toBe(true);
      expect(files.some(f => f.relativePath === 'subdir/note2.md')).toBe(true);
    });

    it('should handle custom exclude patterns', async () => {
      await fs.promises.writeFile(path.join(sourceDir, 'note1.md'), '# Note 1');
      await fs.promises.writeFile(path.join(sourceDir, 'draft.md'), '# Draft');
      await fs.promises.mkdir(path.join(sourceDir, 'drafts'), { recursive: true });
      await fs.promises.writeFile(path.join(sourceDir, 'drafts', 'note2.md'), '# Note 2');

      const config: BuildConfig = {
        sourceDir,
        outputDir,
        patterns: {
          exclude: ['draft*.md', 'drafts/**']
        }
      };

      const builder = new PapyrBuilder(config);
      const discoverSourceFiles = (builder as any).discoverSourceFiles.bind(builder);
      const files = await discoverSourceFiles();

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('note1.md');
    });

    it('should handle empty directory', async () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const discoverSourceFiles = (builder as any).discoverSourceFiles.bind(builder);
      const files = await discoverSourceFiles();

      expect(files).toHaveLength(0);
    });

    it('should warn when a file cannot be read', async () => {
      await fs.promises.writeFile(path.join(sourceDir, 'note1.md'), '# Note 1');

      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const discoverSourceFiles = (builder as any).discoverSourceFiles.bind(builder);

      const readSpy = vi.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(new Error('read failure'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const files = await discoverSourceFiles();

      expect(files).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not read file'), expect.any(Error));

      readSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should warn when source directory cannot be read', async () => {
      const missingSourceDir = path.join(tempDir, 'missing-source');

      const config: BuildConfig = {
        sourceDir: missingSourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const discoverSourceFiles = (builder as any).discoverSourceFiles.bind(builder);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const files = await discoverSourceFiles();

      expect(files).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not read directory'), expect.any(Error));

      warnSpy.mockRestore();
    });
  });

  describe('Pattern Matching', () => {
    it('should match standard **/*.md pattern', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const matchesPattern = (builder as any).matchesPattern.bind(builder);

      expect(matchesPattern('note.md', '**/*.md')).toBe(true);
      expect(matchesPattern('subdir/note.md', '**/*.md')).toBe(true);
      expect(matchesPattern('deep/nested/note.md', '**/*.md')).toBe(true);
      expect(matchesPattern('note.txt', '**/*.md')).toBe(false);
    });

    it('should match custom glob patterns', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const matchesPattern = (builder as any).matchesPattern.bind(builder);

      expect(matchesPattern('note.txt', '*.txt')).toBe(true);
      expect(matchesPattern('subdir/note.txt', '*.txt')).toBe(false);
      expect(matchesPattern('subdir/note.txt', '**/*.txt')).toBe(true);
      expect(matchesPattern('note?.md', 'note?.md')).toBe(true); // Question mark wildcard is supported
    });

    it('should treat globstars as multi-level directory matches', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const matchesPattern = (builder as any).matchesPattern.bind(builder);

      expect(matchesPattern('node_modules/package/deep/file.md', 'node_modules/**')).toBe(true);
      expect(matchesPattern('nested/node_modules/package/deep/file.md', '**/node_modules/**')).toBe(true);
      expect(matchesPattern('node_modules.md', 'node_modules/**')).toBe(false);
    });

    it('should handle exclusion patterns', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const shouldExcludeFile = (builder as any).shouldExcludeFile.bind(builder);

      // Test with default exclude patterns
      expect(shouldExcludeFile('node_modules/package.md')).toBe(true);
      expect(shouldExcludeFile('node_modules/package/deep/file.md')).toBe(true);
      expect(shouldExcludeFile('.git/config.md')).toBe(true);
      expect(shouldExcludeFile('note.md')).toBe(false);
    });
  });

  describe('Processing Toggles', () => {
    it('should create builder with custom processing options', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir,
        processing: {
          generateExcerpts: false,
          calculateReadingTime: false,
          extractKeywords: true,
          processImages: true
        }
      };

      const builder = new PapyrBuilder(config);
      expect(builder).toBeDefined();
    });

    it('should handle image processing configuration', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir,
        processing: {
          processImages: true
        }
      };

      const builder = new PapyrBuilder(config);
      expect(builder).toBeDefined();
    });
  });

  describe('Serialization', () => {
    it('should serialize Maps correctly', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const serializeForJSON = (builder as any).serializeForJSON.bind(builder);

      const map = new Map([
        ['key1', 'value1'],
        ['key2', 'value2']
      ]);

      const result = serializeForJSON(map);
      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should serialize Sets correctly', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const serializeForJSON = (builder as any).serializeForJSON.bind(builder);

      const set = new Set(['item1', 'item2', 'item3']);
      const result = serializeForJSON(set);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('item1');
      expect(result).toContain('item2');
      expect(result).toContain('item3');
    });

    it('should serialize nested objects correctly', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const serializeForJSON = (builder as any).serializeForJSON.bind(builder);

      const nested = {
        map: new Map([['key', 'value']]),
        set: new Set(['item']),
        array: [1, 2, 3],
        primitive: 'test'
      };

      const result = serializeForJSON(nested);
      expect(result).toEqual({
        map: { key: 'value' },
        set: ['item'],
        array: [1, 2, 3],
        primitive: 'test'
      });
    });

    it('should omit parent references to prevent circular serialization', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const serializeForJSON = (builder as any).serializeForJSON.bind(builder);

      const root: any = { name: 'root', children: [] };
      const child: any = { name: 'child', children: [], parent: root };
      root.children.push(child);

      const result = serializeForJSON(root);
      expect(result.children).toHaveLength(1);
      expect(result.children[0].name).toBe('child');
      expect(result.children[0].parent).toBeUndefined();
    });

    it('should skip duplicate children when serializing folder hierarchy', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const serializeFolderHierarchy = (builder as any).serializeFolderHierarchy.bind(builder);

      const child: any = {
        name: 'child',
        path: 'child',
        depth: 1,
        notes: ['note'],
        children: []
      };
      const root: any = {
        name: 'root',
        path: '',
        depth: 0,
        notes: [],
        children: [child, child]
      };

      const serialized = serializeFolderHierarchy(root);

      expect(serialized.children).toHaveLength(1);
      expect(serialized.children[0].name).toBe('child');
    });
  });

  describe('Watch Functionality', () => {
    it('should create builder with watch enabled', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir,
        watch: true
      };

      const builder = new PapyrBuilder(config);
      expect(builder).toBeDefined();
    });

    it('should stop watching files when no watcher exists', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      
      // Should not throw when no watcher exists
      expect(() => builder.stopWatching()).not.toThrow();
    });

    it('should stop watching files when watcher exists', () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const mockWatcher = {
        close: vi.fn()
      };
      
      // Set up a mock watcher
      (builder as any).fileWatcher = mockWatcher;

      builder.stopWatching();

      expect(mockWatcher.close).toHaveBeenCalled();
      expect((builder as any).fileWatcher).toBeUndefined();
    });

  });

  describe('Output', () => {
    it('should save files with correct content', async () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const saveToFile = (builder as any).saveToFile.bind(builder);

      const testData = { test: 'data' };
      await saveToFile('test.json', testData);

      const filePath = path.join(outputDir, 'test.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = await fs.promises.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(testData);
    });

    it('should handle string data in saveToFile', async () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir
      };

      const builder = new PapyrBuilder(config);
      const saveToFile = (builder as any).saveToFile.bind(builder);

      const testString = 'test string content';
      await saveToFile('test.txt', testString);

      const filePath = path.join(outputDir, 'test.txt');
      const content = await fs.promises.readFile(filePath, 'utf-8');
      expect(content).toBe(testString);
    });

    it('should handle separateFiles configuration', async () => {
      await fs.promises.writeFile(path.join(sourceDir, 'note1.md'), '# Note 1');

      const { processMarkdownContentsToWeb, buildNoteGraph, generateSearchIndex } = await import('../src/index.js');
      
      vi.mocked(processMarkdownContentsToWeb).mockResolvedValue({
        files: [createWebFile(createWebNote('note-1', 'Note 1'), 'note1.md')],
        errors: []
      });
      vi.mocked(buildNoteGraph).mockReturnValue({ nodes: new Map(), edges: [] });
      vi.mocked(generateSearchIndex).mockReturnValue({ documents: new Map() });

      const config: BuildConfig = {
        sourceDir,
        outputDir,
        output: {
          separateFiles: true
        }
      };

      const builder = new PapyrBuilder(config);
      await builder.build();

      // Check that separate files were created
      expect(fs.existsSync(path.join(outputDir, 'notes.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'graph.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'search-index.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'analytics.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'build-info.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'papyr-data.json'))).toBe(true);
    });

    it('should handle combined output when separateFiles is false', async () => {
      await fs.promises.writeFile(path.join(sourceDir, 'note1.md'), '# Note 1');

      const { processMarkdownContentsToWeb, buildNoteGraph, generateSearchIndex } = await import('../src/index.js');
      
      vi.mocked(processMarkdownContentsToWeb).mockResolvedValue({
        files: [createWebFile(createWebNote('note-1', 'Note 1'), 'note1.md')],
        errors: []
      });
      vi.mocked(buildNoteGraph).mockReturnValue({ nodes: new Map(), edges: [] });
      vi.mocked(generateSearchIndex).mockReturnValue({ documents: new Map() });

      const config: BuildConfig = {
        sourceDir,
        outputDir,
        output: {
          separateFiles: false
        }
      };

      const builder = new PapyrBuilder(config);
      await builder.build();

      // Check that only combined file was created
      expect(fs.existsSync(path.join(outputDir, 'papyr-data.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'notes.json'))).toBe(false);
    });

    it('should attempt to export additional formats without throwing', async () => {
      const config: BuildConfig = {
        sourceDir,
        outputDir,
        output: {
          formats: ['json', 'csv', 'markdown', 'yaml'],
          separateFiles: false
        }
      };

      const builder = new PapyrBuilder(config);
      const saveSpy = vi.spyOn(builder as any, 'saveToFile').mockResolvedValue(undefined);
      const exportSpy = vi.spyOn(builder as any, 'exportToFormat');

      const result = createBuildResult(builder);

      await (builder as any).outputResults(result);

      expect(exportSpy).toHaveBeenCalledTimes(3);
      expect(exportSpy).toHaveBeenNthCalledWith(1, result, 'csv');
      expect(exportSpy).toHaveBeenNthCalledWith(2, result, 'markdown');
      expect(exportSpy).toHaveBeenNthCalledWith(3, result, 'yaml');

      exportSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('should write csv, markdown, and yaml exports', async () => {
      await fs.promises.writeFile(path.join(sourceDir, 'note1.md'), '# Note 1');
      await fs.promises.writeFile(path.join(sourceDir, 'note2.md'), '# Note 2');

      const { processMarkdownContentsToWeb, buildNoteGraph, generateSearchIndex } = await import('../src/index.js');

      vi.mocked(processMarkdownContentsToWeb).mockResolvedValue({
        files: [
          createWebFile(createWebNote('note-1', 'Note 1'), 'note1.md'),
          createWebFile(createWebNote('note-2', 'Note 2'), 'note2.md')
        ],
        errors: []
      });

      const nodes = new Map();
      nodes.set('note-1', {
        id: 'note-1',
        label: 'Note 1',
        metadata: {},
        linkCount: 1,
        backlinkCount: 0,
        forwardLinkCount: 1
      });
      nodes.set('note-2', {
        id: 'note-2',
        label: 'Note 2',
        metadata: {},
        linkCount: 1,
        backlinkCount: 1,
        forwardLinkCount: 0
      });

      vi.mocked(buildNoteGraph).mockReturnValue({
        nodes,
        edges: [{ source: 'note-1', target: 'note-2', label: 'connects' }],
        backlinks: new Map(),
        orphans: new Set()
      } as any);

      vi.mocked(generateSearchIndex).mockReturnValue({ documents: new Map() } as any);

      const config: BuildConfig = {
        sourceDir,
        outputDir,
        output: {
          formats: ['json', 'csv', 'markdown', 'yaml'],
          separateFiles: false
        }
      };

      const builder = new PapyrBuilder(config);
      await builder.build();

      const notesCsvPath = path.join(outputDir, 'notes.csv');
      const graphCsvPath = path.join(outputDir, 'graph.csv');
      const markdownPath = path.join(outputDir, 'papyr-data.md');
      const yamlPath = path.join(outputDir, 'papyr-data.yaml');

      expect(fs.existsSync(notesCsvPath)).toBe(true);
      expect(fs.existsSync(graphCsvPath)).toBe(true);
      expect(fs.existsSync(markdownPath)).toBe(true);
      expect(fs.existsSync(yamlPath)).toBe(true);

      const notesCsv = await fs.promises.readFile(notesCsvPath, 'utf-8');
      expect(notesCsv).toContain('note-1');

      const graphCsv = await fs.promises.readFile(graphCsvPath, 'utf-8');
      expect(graphCsv).toContain('note-1');
      expect(graphCsv).toContain('note-2');

      const markdown = await fs.promises.readFile(markdownPath, 'utf-8');
      expect(markdown).toContain('# Papyr Export');
      expect(markdown).toContain('Notes: 2');

      const yaml = await fs.promises.readFile(yamlPath, 'utf-8');
      expect(yaml).toContain('buildInfo');
      expect(yaml).toContain('notes:');
    });
  });
});
