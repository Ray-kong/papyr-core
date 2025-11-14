import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  processMarkdownContent,
  processMarkdownContentToWeb,
  processMarkdownContents,
  processMarkdownContentsToWeb
} from '../src/fileProcessor.js';
import * as parseMarkdownModule from '../src/parseMarkdown.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FileProcessor', () => {
  describe('processMarkdownContent', () => {
    it('should extract relative path correctly', async () => {
      const testCases = [
        { filePath: '/base/notes/file.md', baseDir: '/base', expected: 'notes/file.md' },
        { filePath: '/base/file.md', baseDir: '/base', expected: 'file.md' },
        { filePath: '/base/deep/nested/file.md', baseDir: '/base', expected: 'deep/nested/file.md' }
      ];

      for (const testCase of testCases) {
        const result = await processMarkdownContent('# Test', testCase.filePath, testCase.baseDir);
        expect(result.relativePath).toBe(testCase.expected);
      }
    });

    it('should normalize Windows-style paths', async () => {
      const windowsFilePath = ['C:', 'notes', 'folder', 'file.md'].join('\\');
      const windowsBaseDir = ['C:', 'notes'].join('\\');
      const result = await processMarkdownContent('# Test', windowsFilePath, windowsBaseDir);

      expect(result.relativePath).toBe('folder/file.md');
    });

    it('should trim trailing separators in base directory', async () => {
      const result = await processMarkdownContent('# Test', '/base/dir/file.md', '/base/dir/');

      expect(result.relativePath).toBe('file.md');
    });

    it('should treat empty base as project root', async () => {
      const result = await processMarkdownContent('# Test', '/notes/deep/file.md', '');

      expect(result.relativePath).toBe('notes/deep/file.md');
    });

    it('should return empty relative path when file equals base directory', async () => {
      const result = await processMarkdownContent('# Test', '/notes', '/notes');

      expect(result.relativePath).toBe('');
    });

    it('should handle base prefixes without separators', async () => {
      const result = await processMarkdownContent('# Test', 'notesArticle.md', 'notes');

      expect(result.relativePath).toBe('Article.md');
    });

    it('should fall back to trimming leading separators when outside base', async () => {
      const result = await processMarkdownContent('# Test', '/external/isolated.md', '/notes');

      expect(result.relativePath).toBe('external/isolated.md');
    });
  });

  describe('processMarkdownContentToWeb', () => {
    it('should reuse relative path normalization', async () => {
      const windowsFilePath = ['C:', 'notes', 'file.md'].join('\\');
      const windowsBaseDir = ['C:', 'notes', ''].join('\\');
      const result = await processMarkdownContentToWeb('# Test', windowsFilePath, windowsBaseDir);

      expect(result.relativePath).toBe('file.md');
    });

  });

  describe('processMarkdownContentsToWeb', () => {
    it('should calculate processing statistics', async () => {
      const contents = [
        {
          content: '# Note 1\n\nContent 1.',
          filePath: '/notes/note1.md',
          baseDir: '/notes'
        },
        {
          content: '# Note 2\n\nContent 2.',
          filePath: '/notes/note2.md',
          baseDir: '/notes'
        }
      ];

      const result = await processMarkdownContentsToWeb(contents);

      expect(result.statistics.totalFiles).toBe(2);
      expect(result.statistics.totalErrors).toBe(0);
      expect(result.statistics.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty input', async () => {
      const result = await processMarkdownContentsToWeb([]);

      expect(result.files).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.statistics.totalFiles).toBe(0);
      expect(result.statistics.totalErrors).toBe(0);
    });

    it('should preserve file paths and metadata', async () => {
      const contents = [
        {
          content: `---
title: Custom Title
author: Test Author
---

# Heading

Content here.`,
          filePath: '/deep/nested/path/note.md',
          baseDir: '/deep'
        }
      ];

      const result = await processMarkdownContentsToWeb(contents);

      expect(result.files).toHaveLength(1);
      const file = result.files[0];

      expect(file.filePath).toBe('/deep/nested/path/note.md');
      expect(file.relativePath).toBe('nested/path/note.md');
    });

    it('should handle special characters in file paths', async () => {
      const specialPaths = [
        '/notes/file with spaces.md',
        '/notes/file-with-dashes.md',
        '/notes/file_with_underscores.md',
        '/notes/file.with.dots.md'
      ];

      for (const filePath of specialPaths) {
        const result = await processMarkdownContent('# Test', filePath, '/notes');
        expect(result.filePath).toBe(filePath);
        expect(result.relativePath).toBeDefined();
      }
    });

    it('should convert parsed notes to web-ready notes', async () => {
      const contents = [
        {
          content: `---
title: Demo Note
tags:
  - tag-one
  - tag-two
---

Long-form content to ensure we produce multiple words for reading time calculation.`,
          filePath: '/notes/demo.md',
          baseDir: '/notes'
        }
      ];

      const result = await processMarkdownContentsToWeb(contents);
      const [file] = result.files;

      expect(file.note.title).toBe('Demo Note');
      expect(file.note.tags).toEqual(['tag-one', 'tag-two']);
      expect(file.note.wordCount).toBeGreaterThan(5);
      expect(file.note.readingTime).toBeGreaterThan(0);
      expect(file.note.description).toBeDefined();
    });

    it('should record errors when parsing fails', async () => {
      const originalParse = parseMarkdownModule.parseMarkdown;
      const parseSpy = vi.spyOn(parseMarkdownModule, 'parseMarkdown');
      parseSpy.mockImplementationOnce(async () => {
        throw new Error('explode');
      });
      parseSpy.mockImplementation(async (...args) => originalParse(...args));

      const contents = [
        { content: '# Bad', filePath: '/notes/bad.md', baseDir: '/notes' },
        { content: '# Good', filePath: '/notes/good.md', baseDir: '/notes' }
      ];

      const result = await processMarkdownContentsToWeb(contents);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].filePath).toBe('/notes/bad.md');
      expect(result.files).toHaveLength(1);
      expect(result.statistics.totalErrors).toBe(1);
      expect(result.statistics.totalFiles).toBe(2);
      expect(result.files[0].relativePath).toBe('good.md');
    });

    it('should wrap non-error throwables into Error instances when converting to web', async () => {
      const originalParse = parseMarkdownModule.parseMarkdown;
      const parseSpy = vi.spyOn(parseMarkdownModule, 'parseMarkdown');
      parseSpy.mockImplementationOnce(async () => {
        throw 'explode-string';
      });
      parseSpy.mockImplementation(async (...args) => originalParse(...args));

      const contents = [
        { content: '# Bad', filePath: '/notes/bad.md', baseDir: '/notes' },
        { content: '# Good', filePath: '/notes/good.md', baseDir: '/notes' }
      ];

      const result = await processMarkdownContentsToWeb(contents);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].filePath).toBe('/notes/bad.md');
      expect(result.errors[0].error).toBeInstanceOf(Error);
      expect(result.errors[0].error.message).toBe('explode-string');
    });
  });

  describe('processMarkdownContents', () => {
    it('should sort files by relative path', async () => {
      const contents = [
        { content: '# B', filePath: '/notes/b.md', baseDir: '/notes' },
        { content: '# A', filePath: '/notes/a.md', baseDir: '/notes' },
        { content: '# C', filePath: '/notes/sub/c.md', baseDir: '/notes' }
      ];

      const result = await processMarkdownContents(contents);
      const paths = result.files.map(file => file.relativePath);

      expect(paths).toEqual(['a.md', 'b.md', 'sub/c.md']);
    });

    it('should capture parse errors per file without stopping processing', async () => {
      const originalParse = parseMarkdownModule.parseMarkdown;
      const parseSpy = vi.spyOn(parseMarkdownModule, 'parseMarkdown');
      parseSpy.mockImplementationOnce(async () => {
        throw new Error('boom');
      });
      parseSpy.mockImplementation(async (...args) => originalParse(...args));

      const contents = [
        { content: '# Bad', filePath: '/notes/error.md', baseDir: '/notes' },
        { content: '# Good', filePath: '/notes/good.md', baseDir: '/notes' }
      ];

      const result = await processMarkdownContents(contents);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].filePath).toBe('/notes/error.md');
      expect(result.statistics.totalErrors).toBe(1);
      expect(result.statistics.totalFiles).toBe(2);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].relativePath).toBe('good.md');
    });

    it('should wrap non-error throwables into Error instances', async () => {
      const originalParse = parseMarkdownModule.parseMarkdown;
      const parseSpy = vi.spyOn(parseMarkdownModule, 'parseMarkdown');
      parseSpy.mockImplementationOnce(async () => {
        throw 'not-an-error';
      });
      parseSpy.mockImplementation(async (...args) => originalParse(...args));

      const contents = [
        { content: '# Bad', filePath: '/notes/error.md', baseDir: '/notes' },
        { content: '# Good', filePath: '/notes/good.md', baseDir: '/notes' }
      ];

      const result = await processMarkdownContents(contents);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].filePath).toBe('/notes/error.md');
      expect(result.errors[0].error).toBeInstanceOf(Error);
      expect(result.errors[0].error.message).toBe('not-an-error');
    });
  });
});
