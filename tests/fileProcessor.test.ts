import { describe, it, expect, beforeEach } from 'vitest';
import { 
  processMarkdownContent,
  processMarkdownContentsToWeb,
  type ProcessedFile,
  type WebReadyFile
} from '../src/fileProcessor.js';

describe('FileProcessor', () => {
  describe('processMarkdownContent', () => {
    it('should process basic markdown content', async () => {
      const content = '# Test Note\n\nThis is test content.';
      const filePath = '/notes/test.md';
      const baseDir = '/notes';

      const result = await processMarkdownContent(content, filePath, baseDir);

      expect(result.filePath).toBe(filePath);
      expect(result.relativePath).toBe('test.md');
      expect(result.note.title).toBe('Test Note');
      expect(result.note.content).toContain('This is test content');
    });

    it('should handle markdown with frontmatter', async () => {
      const content = `---
title: Custom Title
tags: [tag1, tag2]
date: 2024-01-01
---

# Heading

Content with frontmatter.`;

      const result = await processMarkdownContent(content, '/notes/frontmatter.md', '/notes');

      expect(result.note.title).toBe('Custom Title');
      expect(result.note.metadata.tags).toEqual(['tag1', 'tag2']);
      expect(result.note.metadata.date).toBe('2024-01-01');
    });

    it('should handle markdown with wiki links', async () => {
      const content = '# Note with Links\n\nThis links to [[Other Note]] and [[Another Note]].';
      
      const result = await processMarkdownContent(content, '/notes/linked.md', '/notes');

      expect(result.note.linksTo).toContain('Other Note');
      expect(result.note.linksTo).toContain('Another Note');
    });

    it('should handle empty content', async () => {
      const result = await processMarkdownContent('', '/notes/empty.md', '/notes');

      expect(result.note.title).toBe('empty');
      expect(result.note.content).toBe('');
      expect(result.note.linksTo).toHaveLength(0);
    });

    it('should handle content without title', async () => {
      const content = 'Just some content without a heading.';
      
      const result = await processMarkdownContent(content, '/notes/no-title.md', '/notes');

      expect(result.note.title).toBe('no-title');
      expect(result.note.content).toContain('Just some content');
    });

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
    it('should process multiple markdown contents to web-ready format', async () => {
      const contents = [
        {
          content: '# First Note\n\nThis is the first note with [[Second Note]].',
          filePath: '/notes/first.md',
          baseDir: '/notes'
        },
        {
          content: '# Second Note\n\nThis is the second note.',
          filePath: '/notes/second.md',
          baseDir: '/notes'
        }
      ];

      const result = await processMarkdownContentsToWeb(contents);

      expect(result.files).toHaveLength(2);
      expect(result.statistics.totalFiles).toBe(2);
      expect(result.statistics.totalErrors).toBe(0);
      
      const firstNote = result.files.find(f => f.relativePath === 'first.md');
      const secondNote = result.files.find(f => f.relativePath === 'second.md');
      
      expect(firstNote).toBeDefined();
      expect(secondNote).toBeDefined();
      expect(firstNote!.note.title).toBe('First Note');
      expect(secondNote!.note.title).toBe('Second Note');
      expect(firstNote!.note.html).toContain('<h1>First Note</h1>');
    });

    it('should handle processing errors gracefully', async () => {
      const contents = [
        {
          content: '# Valid Note\n\nThis is valid.',
          filePath: '/notes/valid.md',
          baseDir: '/notes'
        },
        {
          content: null as any, // This will cause an error
          filePath: '/notes/invalid.md',
          baseDir: '/notes'
        }
      ];

      const result = await processMarkdownContentsToWeb(contents);

      expect(result.statistics.totalFiles).toBe(2);
      expect(result.statistics.totalErrors).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].filePath).toBe('/notes/invalid.md');
      expect(result.files).toHaveLength(1); // Only the valid file
    });

    it('should calculate processing statistics', async () => {
      const startTime = Date.now();
      
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
      expect(result.statistics.processingTime).toBeLessThan(Date.now() - startTime + 100);
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
      expect(file.note.title).toBe('Custom Title');
      expect(file.note.metadata.author).toBe('Test Author');
    });

    it('should handle complex markdown features', async () => {
      const contents = [
        {
          content: `# Complex Note

This note has:

- Lists
- **Bold text**
- *Italic text*
- \`inline code\`
- Links to [[Other Note]]
- And [[Another Note]]

\`\`\`javascript
console.log('code block');
\`\`\`

> Blockquote content

## Subheading

More content here.`,
          filePath: '/notes/complex.md',
          baseDir: '/notes'
        }
      ];

      const result = await processMarkdownContentsToWeb(contents);

      expect(result.files).toHaveLength(1);
      const note = result.files[0].note;
      
      expect(note.title).toBe('Complex Note');
      expect(note.html).toContain('<strong>Bold text</strong>');
      expect(note.html).toContain('<em>Italic text</em>');
      expect(note.html).toContain('<code>inline code</code>');
      expect(note.html).toContain('<blockquote>');
      expect(note.html).toContain('<h2>Subheading</h2>');
      expect(note.linksTo).toContain('Other Note');
      expect(note.linksTo).toContain('Another Note');
    });

    it('should handle concurrent processing', async () => {
      // Create a larger set of files to test concurrent processing
      const contents = Array.from({ length: 50 }, (_, i) => ({
        content: `# Note ${i}\n\nThis is note number ${i} with links to [[Note ${i + 1}]].`,
        filePath: `/notes/note-${i}.md`,
        baseDir: '/notes'
      }));

      const result = await processMarkdownContentsToWeb(contents);

      expect(result.files).toHaveLength(50);
      expect(result.statistics.totalFiles).toBe(50);
      expect(result.statistics.totalErrors).toBe(0);
      
      // Verify all notes were processed correctly
      result.files.forEach((file, index) => {
        expect(file.note.title).toBe(`Note ${index}`);
        expect(file.relativePath).toBe(`note-${index}.md`);
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed frontmatter', async () => {
      const content = `---
title: "Unclosed quote
invalid: yaml: content
---

# Note Content

Regular content.`;

      const result = await processMarkdownContent(content, '/notes/malformed.md', '/notes');

      // Should still process the content, even if frontmatter parsing fails
      expect(result.note.title).toBeDefined();
      expect(result.note.content).toContain('Regular content');
    });

    it('should handle very large content', async () => {
      const largeContent = '# Large Note\n\n' + 'A'.repeat(100000);
      
      const result = await processMarkdownContent(largeContent, '/notes/large.md', '/notes');

      expect(result.note.title).toBe('Large Note');
      expect(result.note.content.length).toBeGreaterThan(100000);
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
