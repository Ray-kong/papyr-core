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
import { type NoteGraph, type SearchIndex, type WebReadyNote, type ParsedNote, type Slug, type GraphNode, type GraphLink } from '../src/types.js';

describe('JsonExporter', () => {
  let mockProcessingResult: ProcessingResult;
  let mockWebReadyResult: WebReadyResult;
  let mockGraph: NoteGraph;
  let mockSearchIndex: SearchIndex;

  beforeEach(() => {
    // Mock parsed notes
    const mockParsedNotes: ParsedNote[] = [
      {
        slug: 'note1' as Slug,
        html: '<p>Content of note one</p>',
        metadata: { tags: ['tag1'] },
        linksTo: ['note2']
      },
      {
        slug: 'note2' as Slug, 
        html: '<p>Content of note two</p>',
        metadata: { tags: ['tag2'] },
        linksTo: []
      }
    ];

    // Mock web-ready notes
    const mockWebReadyNotes: WebReadyNote[] = [
      {
        slug: 'note1' as Slug,
        title: 'Note One',
        html: '<p>Content of note one</p>',
        metadata: { tags: ['tag1'] },
        linksTo: ['note2'],
        tags: ['tag1'],
        wordCount: 10,
        readingTime: 1
      },
      {
        slug: 'note2' as Slug,
        title: 'Note Two',
        html: '<p>Content of note two</p>',
        metadata: { tags: ['tag2'] },
        linksTo: [],
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
      nodes: new Map<string, GraphNode>(),
      edges: [],
      backlinks: new Map(),
      orphans: new Set()
    };

    mockSearchIndex = {
      documents: new Map(),
      index: {} as any
    };
  });

  describe('exportToJSON', () => {
    it('should export processing result to JSON format', () => {
      const result = exportToJSON(mockProcessingResult, mockGraph, mockSearchIndex);

      expect(result.notes).toHaveLength(2);
      expect(result.graph.nodes).toHaveLength(0);
      expect(result.graph.edges).toHaveLength(0);
      expect(result.searchIndex.documents).toHaveLength(0);
      expect(result.statistics.totalFiles).toBe(2);
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
        backlinks: new Map(),
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

    it('should include graph statistics and search index documents', () => {
      const enrichedGraph: NoteGraph = {
        nodes: new Map<string, GraphNode>([
          ['note1', {
            id: 'note1',
            label: 'Note 1',
            metadata: {},
            linkCount: 1,
            backlinkCount: 0,
            forwardLinkCount: 1
          }]
        ]),
        edges: [{ source: 'note1', target: 'note2' } as GraphLink],
        backlinks: new Map([['note2', new Set(['note1'])]]),
        orphans: new Set(['orphan'])
      };

      const indexNote: ParsedNote = {
        slug: 'note1' as Slug,
        html: '<p>Indexed</p>',
        raw: 'Indexed note content',
        metadata: { title: 'Indexed Note', tags: ['index'] },
        linksTo: [],
        embeds: [],
        headings: []
      };

      const searchIndex: SearchIndex = {
        documents: new Map([[indexNote.slug, indexNote]]),
        index: {} as any
      };

      const result = exportToJSON(mockProcessingResult, enrichedGraph, searchIndex);

      expect(result.graph.nodes).toHaveLength(1);
      expect(result.graph.statistics).toBeDefined();
      expect(result.graph.orphans).toContain('orphan');
      expect(result.searchIndex.documents).toHaveLength(1);
      expect(result.searchIndex.stats.totalDocuments).toBe(1);
      expect(result.searchIndex.documents[0].title).toBe('Indexed Note');
    });

    it('should omit metadata when includeMetadata is false', () => {
      const result = exportToJSON(mockProcessingResult, mockGraph, mockSearchIndex, { includeMetadata: false });

      expect(result.metadata).toBeUndefined();
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

      const noteOne = result.notes.find(n => n.slug === 'note1');
      expect(noteOne.html).toBe('<p>Content of note one</p>');
      expect(noteOne.wordCount).toBe(10);
      expect(noteOne.readingTime).toBe(1);
      expect(noteOne.tags).toEqual(['tag1']);
    });

    it('should omit metadata when includeMetadata is false for web-ready data', () => {
      const result = exportWebReadyToJSON(mockWebReadyResult, mockGraph, mockSearchIndex, { includeMetadata: false });

      expect(result.metadata).toBeUndefined();
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

    it('should support compact output when pretty is false', () => {
      const compactData = exportToJSON(mockProcessingResult, mockGraph, mockSearchIndex);
      const jsonString = toJSONString(compactData, false);

      expect(jsonString.includes('\n')).toBe(false);
      const parsed = JSON.parse(jsonString);
      expect(parsed.notes).toHaveLength(2);
    });
  });
});
