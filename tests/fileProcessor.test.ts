import { describe, it, expect } from 'vitest';
import { 
  processMarkdownContent,
  processMarkdownContentsToWeb,
  type ProcessedFile,
  type WebReadyFile
} from '../src/fileProcessor.js';

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
      expect(result.statistics.processingTime).toBeGreaterThan(0);
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
  });
});
