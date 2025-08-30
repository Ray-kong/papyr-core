import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PapyrBuilder } from '../src/builder.js';
import { type BuildConfig } from '../src/types.js';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    watch: vi.fn(),
    FSWatcher: vi.fn()
  },
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  watch: vi.fn()
}));

// Mock path module
vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...args) => '/' + args.join('/')),
    relative: vi.fn((from, to) => to),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/') || '/'),
    extname: vi.fn((p) => p.includes('.') ? '.' + p.split('.').pop() : ''),
    basename: vi.fn((p) => p.split('/').pop() || p)
  },
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((...args) => '/' + args.join('/')),
  relative: vi.fn((from, to) => to),
  dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/') || '/'),
  extname: vi.fn((p) => p.includes('.') ? '.' + p.split('.').pop() : ''),
  basename: vi.fn((p) => p.split('/').pop() || p)
}));

describe('PapyrBuilder', () => {
  let builder: PapyrBuilder;
  let mockConfig: BuildConfig;

  beforeEach(() => {
    mockConfig = {
      sourceDir: '/test/notes',
      outputDir: '/test/output',
      patterns: {
        include: ['**/*.md'],
        exclude: ['node_modules/**']
      },
      processing: {
        generateExcerpts: true,
        calculateReadingTime: true,
        extractKeywords: true
      },
      output: {
        formats: ['json'],
        separateFiles: true
      }
    };

    builder = new PapyrBuilder(mockConfig);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create builder with default config values', () => {
      const minimalConfig: BuildConfig = {
        sourceDir: '/test',
        outputDir: '/output'
      };
      
      const testBuilder = new PapyrBuilder(minimalConfig);
      expect(testBuilder).toBeInstanceOf(PapyrBuilder);
    });

    it('should merge provided config with defaults', () => {
      const customConfig: BuildConfig = {
        sourceDir: '/custom',
        outputDir: '/custom-output',
        patterns: {
          include: ['**/*.markdown']
        }
      };

      const testBuilder = new PapyrBuilder(customConfig);
      expect(testBuilder).toBeInstanceOf(PapyrBuilder);
    });
  });

  describe('discoverFiles', () => {
    beforeEach(() => {
      // Mock file system
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ 
        isDirectory: () => true,
        isFile: () => false
      } as any);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'note1.md',
        'note2.md',
        'folder',
        'README.txt'
      ] as any);
    });

    it('should discover markdown files', async () => {
      // Mock nested directory structure
      vi.mocked(fs.statSync)
        .mockReturnValueOnce({ isDirectory: () => true, isFile: () => false } as any) // sourceDir
        .mockReturnValueOnce({ isDirectory: () => false, isFile: () => true } as any) // note1.md
        .mockReturnValueOnce({ isDirectory: () => false, isFile: () => true } as any) // note2.md
        .mockReturnValueOnce({ isDirectory: () => true, isFile: () => false } as any) // folder
        .mockReturnValueOnce({ isDirectory: () => false, isFile: () => true } as any); // README.txt

      const files = await builder.discoverFiles();
      
      expect(files).toHaveLength(2); // Only .md files
      expect(files[0].filePath).toContain('note1.md');
      expect(files[1].filePath).toContain('note2.md');
    });

    it('should handle empty directory', async () => {
      vi.mocked(fs.readdirSync).mockReturnValue([] as any);
      
      const files = await builder.discoverFiles();
      expect(files).toHaveLength(0);
    });

    it('should handle non-existent source directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await expect(builder.discoverFiles()).rejects.toThrow();
    });
  });

  describe('processFiles', () => {
    beforeEach(() => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath.toString().includes('note1.md')) {
          return '# Note 1\n\nThis is the first note with [[note2]] link.';
        }
        if (filePath.toString().includes('note2.md')) {
          return '# Note 2\n\nThis is the second note.';
        }
        return '';
      });
    });

    it('should process markdown files', async () => {
      const sourceFiles = [
        {
          filePath: '/test/notes/note1.md',
          relativePath: 'note1.md',
          baseDir: '/test/notes'
        },
        {
          filePath: '/test/notes/note2.md',
          relativePath: 'note2.md', 
          baseDir: '/test/notes'
        }
      ];

      const result = await builder.processFiles(sourceFiles);
      
      expect(result.notes).toHaveLength(2);
      expect(result.notes[0].title).toBe('Note 1');
      expect(result.notes[1].title).toBe('Note 2');
      expect(result.graph).toBeDefined();
      expect(result.searchIndex).toBeDefined();
    });

    it('should handle processing errors gracefully', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });

      const sourceFiles = [
        {
          filePath: '/test/notes/bad.md',
          relativePath: 'bad.md',
          baseDir: '/test/notes'
        }
      ];

      const result = await builder.processFiles(sourceFiles);
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('File read error');
    });
  });

  describe('build', () => {
    beforeEach(() => {
      // Mock successful file system operations
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ 
        isDirectory: () => true,
        isFile: () => false
      } as any);
      vi.mocked(fs.readdirSync).mockReturnValue(['note1.md'] as any);
      vi.mocked(fs.readFileSync).mockReturnValue('# Test Note\n\nTest content.');
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined as any);
    });

    it('should complete full build process', async () => {
      const result = await builder.build();
      
      expect(result.success).toBe(true);
      expect(result.notes).toBeDefined();
      expect(result.graph).toBeDefined();
      expect(result.searchIndex).toBeDefined();
      expect(result.analytics).toBeDefined();
      expect(result.buildInfo).toBeDefined();
    });

    it('should handle build errors', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = await builder.build();
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should generate build info', async () => {
      const result = await builder.build();
      
      expect(result.buildInfo).toBeDefined();
      expect(result.buildInfo!.timestamp).toBeDefined();
      expect(result.buildInfo!.version).toBeDefined();
      expect(result.buildInfo!.fileCount).toBeDefined();
    });
  });

  describe('writeOutput', () => {
    beforeEach(() => {
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined as any);
      vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    it('should write JSON output', async () => {
      const mockResult = {
        success: true,
        notes: [],
        graph: { nodes: new Map(), edges: [], orphans: new Set() },
        searchIndex: { documents: new Map(), index: {} as any },
        analytics: {} as any,
        buildInfo: {
          timestamp: new Date(),
          version: '1.0.0',
          fileCount: 0,
          processingTime: 100
        }
      };

      await builder.writeOutput(mockResult);
      
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle write errors', async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });

      const mockResult = {
        success: true,
        notes: [],
        graph: { nodes: new Map(), edges: [], orphans: new Set() },
        searchIndex: { documents: new Map(), index: {} as any },
        buildInfo: {
          timestamp: new Date(),
          version: '1.0.0',
          fileCount: 0,
          processingTime: 100
        }
      };

      await expect(builder.writeOutput(mockResult)).rejects.toThrow('Write error');
    });
  });

  describe('watch mode', () => {
    it('should start watch mode', async () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn()
      };
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);

      await builder.startWatch();
      
      expect(fs.watch).toHaveBeenCalled();
    });

    it('should stop watch mode', async () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn()
      };
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);

      await builder.startWatch();
      builder.stopWatch();
      
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe('configuration validation', () => {
    it('should validate required config properties', () => {
      expect(() => {
        new PapyrBuilder({} as BuildConfig);
      }).toThrow();
    });

    it('should accept valid configuration', () => {
      const validConfig: BuildConfig = {
        sourceDir: '/valid/path',
        outputDir: '/valid/output'
      };

      expect(() => {
        new PapyrBuilder(validConfig);
      }).not.toThrow();
    });
  });
});
