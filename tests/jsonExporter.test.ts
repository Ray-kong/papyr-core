import { describe, it, expect, beforeEach } from 'vitest';
import { 
  exportToJSON,
  exportWebReadyToJSON,
  toJSONString,
  type ExportOptions,
  type ExportedData,
  type WebReadyExportedData
} from '../src/jsonExporter.js';
import { type ProcessingResult, type WebReadyResult } from '../src/fileProcessor.js';
import { type NoteGraph, type SearchIndex, type WebReadyNote, type ParsedNote } from '../src/types.js';

describe('JsonExporter', () => {
  let mockProcessingResult: ProcessingResult;
  let mockWebReadyResult: WebReadyResult;
  let mockGraph: NoteGraph;
  let mockSearchIndex: SearchIndex;

  beforeEach(() => {
    // Mock parsed notes
    const mockParsedNotes: ParsedNote[] = [
      {
        title: 'Note One',
        content: 'Content of note one',
        metadata: { tags: ['tag1'] },
        linksTo: ['Note Two'],
        slug: 'note-one'
      },
      {
        title: 'Note Two', 
        content: 'Content of note two',
        metadata: { tags: ['tag2'] },
        linksTo: [],
        slug: 'note-two'
      }
    ];

    // Mock web-ready notes
    const mockWebReadyNotes: WebReadyNote[] = [
      {
        title: 'Note One',
        html: '<p>Content of note one</p>',
        metadata: { tags: ['tag1'] },
        linksTo: ['Note Two'],
        slug: 'note-one',
        tags: ['tag1'],
        wordCount: 10,
        readingTime: 1
      },
      {
        title: 'Note Two',
        html: '<p>Content of note two</p>',
        metadata: { tags: ['tag2'] },
        linksTo: [],
        slug: 'note-two',
        tags: ['tag2'],
        wordCount: 8,
        readingTime: 1
      }
    ];

    mockProcessingResult = {
      files: [
        { filePath: '/notes/note1.md', relativePath: 'note1.md', note: mockParsedNotes[0] },
        { filePath: '/notes/note2.md', relativePath: 'note2.md', note: mockParsedNotes[1] }
      ],
      errors: [],
      statistics: {
        totalFiles: 2,
        totalErrors: 0,
        processingTime: 100
      }
    };

    mockWebReadyResult = {
      files: [
        { filePath: '/notes/note1.md', relativePath: 'note1.md', note: mockWebReadyNotes[0] },
        { filePath: '/notes/note2.md', relativePath: 'note2.md', note: mockWebReadyNotes[1] }
      ],
      errors: [],
      statistics: {
        totalFiles: 2,
        totalErrors: 0,
        processingTime: 150
      }
    };

    mockGraph = {
      nodes: new Map([
        ['note-one', { id: 'note-one', title: 'Note One', linkCount: 1, inbound: [], outbound: ['note-two'] }],
        ['note-two', { id: 'note-two', title: 'Note Two', linkCount: 1, inbound: ['note-one'], outbound: [] }]
      ]),
      edges: [{ source: 'note-one', target: 'note-two' }],
      orphans: new Set()
    };

    mockSearchIndex = {
      documents: new Map([
        ['note-one', { id: 'note-one', title: 'Note One', content: 'Content of note one', slug: 'note-one' }],
        ['note-two', { id: 'note-two', title: 'Note Two', content: 'Content of note two', slug: 'note-two' }]
      ]),
      index: {} as any // FlexSearch index
    };
  });

  describe('exportToJSON', () => {
    it('should export processing result to JSON format', () => {
      const result = exportToJSON(mockProcessingResult, mockGraph, mockSearchIndex);

      expect(result.notes).toHaveLength(2);
      expect(result.graph.nodes).toHaveLength(2);
      expect(result.graph.edges).toHaveLength(1);
      expect(result.searchIndex.documents).toHaveLength(2);
      expect(result.statistics.totalFiles).toBe(2);
    });

    it('should include metadata when requested', () => {
      const options: ExportOptions = { includeMetadata: true };
      const result = exportToJSON(mockProcessingResult, mockGraph, mockSearchIndex, options);

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.exportedAt).toBeDefined();
      expect(result.metadata!.version).toBeDefined();
    });

    it('should exclude metadata by default', () => {
      const result = exportToJSON(mockProcessingResult, mockGraph, mockSearchIndex);

      expect(result.metadata).toBeUndefined();
    });

    it('should handle empty results', () => {
      const emptyResult: ProcessingResult = {
        files: [],
        errors: [],
        statistics: { totalFiles: 0, totalErrors: 0, processingTime: 0 }
      };
      const emptyGraph: NoteGraph = {
        nodes: new Map(),
        edges: [],
        orphans: new Set()
      };
      const emptySearchIndex: SearchIndex = {
        documents: new Map(),
        index: {} as any
      };

      const result = exportToJSON(emptyResult, emptyGraph, emptySearchIndex);

      expect(result.notes).toHaveLength(0);
      expect(result.graph.nodes).toHaveLength(0);
      expect(result.graph.edges).toHaveLength(0);
      expect(result.searchIndex.documents).toHaveLength(0);
    });

    it('should calculate graph statistics', () => {
      const result = exportToJSON(mockProcessingResult, mockGraph, mockSearchIndex);

      expect(result.graph.statistics).toBeDefined();
      expect(result.graph.statistics.totalNodes).toBe(2);
      expect(result.graph.statistics.totalEdges).toBe(1);
    });

    it('should include search index statistics', () => {
      const result = exportToJSON(mockProcessingResult, mockGraph, mockSearchIndex);

      expect(result.searchIndex.stats).toBeDefined();
      expect(result.searchIndex.stats.totalDocuments).toBe(2);
    });
  });

  describe('exportWebReadyToJSON', () => {
    it('should export web-ready result to JSON format', () => {
      const result = exportWebReadyToJSON(mockWebReadyResult, mockGraph, mockSearchIndex);

      expect(result.notes).toHaveLength(2);
      expect(result.notes[0].html).toBeDefined();
      expect(result.notes[0].wordCount).toBeDefined();
      expect(result.notes[0].readingTime).toBeDefined();
    });

    it('should preserve web-ready specific properties', () => {
      const result = exportWebReadyToJSON(mockWebReadyResult, mockGraph, mockSearchIndex);

      const noteOne = result.notes.find(n => n.slug === 'note-one');
      expect(noteOne.html).toBe('<p>Content of note one</p>');
      expect(noteOne.wordCount).toBe(10);
      expect(noteOne.readingTime).toBe(1);
      expect(noteOne.tags).toEqual(['tag1']);
    });

    it('should include metadata when requested', () => {
      const options: ExportOptions = { includeMetadata: true };
      const result = exportWebReadyToJSON(mockWebReadyResult, mockGraph, mockSearchIndex, options);

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.exportedAt).toBeDefined();
    });
  });

  describe('toJSONString', () => {
    let mockExportedData: ExportedData;

    beforeEach(() => {
      mockExportedData = exportToJSON(mockProcessingResult, mockGraph, mockSearchIndex);
    });

    it('should convert to JSON string with default formatting', () => {
      const jsonString = toJSONString(mockExportedData);

      expect(typeof jsonString).toBe('string');
      expect(() => JSON.parse(jsonString)).not.toThrow();
      
      const parsed = JSON.parse(jsonString);
      expect(parsed.notes).toHaveLength(2);
    });

    it('should format JSON with pretty printing when requested', () => {
      const jsonString = toJSONString(mockExportedData, true);

      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  '); // Indentation
      
      const parsed = JSON.parse(jsonString);
      expect(parsed.notes).toHaveLength(2);
    });

    it('should handle circular references gracefully', () => {
      // Create data with potential circular reference
      const circularData = { ...mockExportedData };
      (circularData as any).self = circularData;

      expect(() => toJSONString(circularData)).not.toThrow();
    });

    it('should handle undefined and null values', () => {
      const dataWithNulls = {
        ...mockExportedData,
        nullValue: null,
        undefinedValue: undefined
      };

      const jsonString = toJSONString(dataWithNulls);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed.nullValue).toBeNull();
      expect(parsed.undefinedValue).toBeUndefined();
    });

    it('should preserve data types correctly', () => {
      const jsonString = toJSONString(mockExportedData);
      const parsed = JSON.parse(jsonString);

      expect(typeof parsed.statistics.totalFiles).toBe('number');
      expect(typeof parsed.statistics.processingTime).toBe('number');
      expect(Array.isArray(parsed.notes)).toBe(true);
      expect(Array.isArray(parsed.graph.edges)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle processing errors in export', () => {
      const resultWithErrors: ProcessingResult = {
        ...mockProcessingResult,
        errors: [
          { filePath: '/notes/error.md', error: new Error('Parse error') }
        ],
        statistics: {
          ...mockProcessingResult.statistics,
          totalErrors: 1
        }
      };

      const result = exportToJSON(resultWithErrors, mockGraph, mockSearchIndex);

      expect(result.statistics.totalErrors).toBe(1);
      expect(result.notes).toHaveLength(2); // Should still export successful files
    });

    it('should handle malformed graph data', () => {
      const malformedGraph: NoteGraph = {
        nodes: new Map([
          ['invalid', { id: 'invalid', title: '', linkCount: -1, inbound: [], outbound: [] }]
        ]),
        edges: [],
        orphans: new Set(['nonexistent'])
      };

      expect(() => {
        exportToJSON(mockProcessingResult, malformedGraph, mockSearchIndex);
      }).not.toThrow();
    });

    it('should handle empty search index gracefully', () => {
      const emptySearchIndex: SearchIndex = {
        documents: new Map(),
        index: null as any
      };

      const result = exportToJSON(mockProcessingResult, mockGraph, emptySearchIndex);

      expect(result.searchIndex.documents).toHaveLength(0);
      expect(result.searchIndex.stats.totalDocuments).toBe(0);
    });
  });

  describe('performance with large datasets', () => {
    it('should handle large number of notes efficiently', () => {
      // Create large dataset
      const largeFiles = Array.from({ length: 1000 }, (_, i) => ({
        filePath: `/notes/note-${i}.md`,
        relativePath: `note-${i}.md`,
        note: {
          title: `Note ${i}`,
          content: `Content ${i}`,
          metadata: { tags: [`tag-${i % 10}`] },
          linksTo: [],
          slug: `note-${i}`
        } as ParsedNote
      }));

      const largeResult: ProcessingResult = {
        files: largeFiles,
        errors: [],
        statistics: { totalFiles: 1000, totalErrors: 0, processingTime: 1000 }
      };

      const largeGraph: NoteGraph = {
        nodes: new Map(largeFiles.map(f => [f.note.slug, {
          id: f.note.slug,
          title: f.note.title,
          linkCount: 0,
          inbound: [],
          outbound: []
        }])),
        edges: [],
        orphans: new Set()
      };

      const largeSearchIndex: SearchIndex = {
        documents: new Map(largeFiles.map(f => [f.note.slug, {
          id: f.note.slug,
          title: f.note.title,
          content: f.note.content,
          slug: f.note.slug
        }])),
        index: {} as any
      };

      const startTime = Date.now();
      const result = exportToJSON(largeResult, largeGraph, largeSearchIndex);
      const endTime = Date.now();

      expect(result.notes).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });
  });
});
