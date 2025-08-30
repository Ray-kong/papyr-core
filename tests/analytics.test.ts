import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsEngine } from '../src/analytics.js';
import { type WebReadyNote, type NoteGraph } from '../src/types.js';

describe('AnalyticsEngine', () => {
  let analytics: AnalyticsEngine;
  let mockNotes: WebReadyNote[];
  let mockGraph: NoteGraph;

  beforeEach(() => {
    analytics = new AnalyticsEngine();
    
    // Create mock notes
    mockNotes = [
      {
        slug: 'note1',
        title: 'Note One',
        html: '<p>This is note one content</p>',
        metadata: { tags: ['tag1', 'tag2'] },
        linksTo: ['note2'],
        tags: ['tag1', 'tag2'],
        wordCount: 10,
        readingTime: 1
      },
      {
        slug: 'note2', 
        title: 'Note Two',
        html: '<p>This is note two with more content here</p>',
        metadata: { tags: ['tag2', 'tag3'] },
        linksTo: ['note3'],
        tags: ['tag2', 'tag3'],
        wordCount: 15,
        readingTime: 2
      },
      {
        slug: 'note3',
        title: 'Note Three',
        html: '<p>Short note</p>',
        metadata: { tags: ['tag1'] },
        linksTo: [],
        tags: ['tag1'],
        wordCount: 5,
        readingTime: 1
      },
      {
        slug: 'orphan',
        title: 'Orphaned Note',
        html: '<p>No connections</p>',
        metadata: { tags: [] },
        linksTo: [],
        tags: [],
        wordCount: 3,
        readingTime: 1
      }
    ] as WebReadyNote[];

    // Create mock graph
    mockGraph = {
      nodes: new Map([
        ['note1', { id: 'note1', title: 'Note One', linkCount: 1, inbound: ['note2'], outbound: ['note2'] }],
        ['note2', { id: 'note2', title: 'Note Two', linkCount: 2, inbound: ['note1'], outbound: ['note3'] }],
        ['note3', { id: 'note3', title: 'Note Three', linkCount: 1, inbound: ['note2'], outbound: [] }],
        ['orphan', { id: 'orphan', title: 'Orphaned Note', linkCount: 0, inbound: [], outbound: [] }]
      ]),
      edges: [
        { source: 'note1', target: 'note2' },
        { source: 'note2', target: 'note3' }
      ],
      orphans: new Set(['orphan'])
    };
  });

  describe('calculateAnalytics', () => {
    it('should calculate comprehensive analytics', () => {
      const result = analytics.calculateAnalytics(mockNotes, mockGraph);
      
      expect(result).toHaveProperty('basic');
      expect(result).toHaveProperty('graph');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('tags');
    });

    it('should calculate correct basic stats', () => {
      const result = analytics.calculateAnalytics(mockNotes, mockGraph);
      
      expect(result.basic.totalNotes).toBe(4);
      expect(result.basic.totalLinks).toBe(2);
      expect(result.basic.orphanedNotes).toBe(1);
      expect(result.basic.totalWords).toBe(33); // 10 + 15 + 5 + 3
      expect(result.basic.averageWordsPerNote).toBe(8.25);
      expect(result.basic.averageConnections).toBe(1); // (1+2+1+0)/4
    });

    it('should calculate graph analytics', () => {
      const result = analytics.calculateAnalytics(mockNotes, mockGraph);
      
      expect(result.graph.networkDensity).toBeGreaterThan(0);
      expect(result.graph.averageDegree).toBe(1);
      expect(result.graph.maxDegree).toBe(2);
      expect(result.graph.components).toBeGreaterThan(0);
      expect(result.graph.centralityScores).toBeDefined();
    });

    it('should calculate content analytics', () => {
      const result = analytics.calculateAnalytics(mockNotes, mockGraph);
      
      expect(result.content.avgWordCount).toBe(8.25);
      expect(result.content.totalReadingTime).toBe(5);
      expect(result.content.wordCountDistribution).toBeDefined();
      expect(result.content.contentLengthCategories.short).toBe(2); // notes with ≤5 words
      expect(result.content.contentLengthCategories.medium).toBe(2); // notes with 6-20 words
      expect(result.content.contentLengthCategories.long).toBe(0); // notes with >20 words
    });

    it('should calculate tag analytics', () => {
      const result = analytics.calculateAnalytics(mockNotes, mockGraph);
      
      expect(result.tags.totalTags).toBe(3); // tag1, tag2, tag3
      expect(result.tags.averageTagsPerNote).toBe(1.5); // (2+2+1+0)/4
      expect(result.tags.tagFrequency.get('tag1')).toBe(2);
      expect(result.tags.tagFrequency.get('tag2')).toBe(2);
      expect(result.tags.tagFrequency.get('tag3')).toBe(1);
      expect(result.tags.mostUsedTags).toContain('tag1');
      expect(result.tags.mostUsedTags).toContain('tag2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty note collection', () => {
      const emptyGraph: NoteGraph = {
        nodes: new Map(),
        edges: [],
        orphans: new Set()
      };
      
      const result = analytics.calculateAnalytics([], emptyGraph);
      
      expect(result.basic.totalNotes).toBe(0);
      expect(result.basic.averageConnections).toBe(0);
      expect(result.basic.averageWordsPerNote).toBe(0);
      expect(result.content.avgWordCount).toBe(0);
      expect(result.tags.averageTagsPerNote).toBe(0);
    });

    it('should handle notes without word counts', () => {
      const notesWithoutWordCount = mockNotes.map(note => ({
        ...note,
        wordCount: undefined
      })) as WebReadyNote[];
      
      const result = analytics.calculateAnalytics(notesWithoutWordCount, mockGraph);
      
      expect(result.basic.totalWords).toBe(0);
      expect(result.basic.averageWordsPerNote).toBe(0);
      expect(result.content.avgWordCount).toBe(0);
    });

    it('should handle notes without reading time', () => {
      const notesWithoutReadingTime = mockNotes.map(note => ({
        ...note,
        readingTime: undefined
      })) as WebReadyNote[];
      
      const result = analytics.calculateAnalytics(notesWithoutReadingTime, mockGraph);
      
      expect(result.content.totalReadingTime).toBe(0);
    });

    it('should handle notes without tags', () => {
      const notesWithoutTags = mockNotes.map(note => ({
        ...note,
        tags: [],
        metadata: { ...note.metadata, tags: [] }
      })) as WebReadyNote[];
      
      const result = analytics.calculateAnalytics(notesWithoutTags, mockGraph);
      
      expect(result.tags.totalTags).toBe(0);
      expect(result.tags.averageTagsPerNote).toBe(0);
      expect(result.tags.tagFrequency.size).toBe(0);
      expect(result.tags.mostUsedTags).toHaveLength(0);
    });
  });

  describe('performance and scalability', () => {
    it('should handle large collections efficiently', () => {
      // Create a large collection of mock notes
      const largeNotes: WebReadyNote[] = Array.from({ length: 1000 }, (_, i) => ({
        slug: `note-${i}`,
        title: `Note ${i}`,
        html: `<p>Content for note ${i}</p>`,
        metadata: { tags: [`tag-${i % 10}`] },
        linksTo: i > 0 ? [`note-${i - 1}`] : [],
        tags: [`tag-${i % 10}`],
        wordCount: Math.floor(Math.random() * 100) + 1,
        readingTime: Math.floor(Math.random() * 10) + 1
      })) as WebReadyNote[];

      const largeGraph: NoteGraph = {
        nodes: new Map(largeNotes.map(note => [
          note.slug, 
          { 
            id: note.slug, 
            title: note.title, 
            linkCount: note.linksTo.length,
            inbound: [],
            outbound: note.linksTo
          }
        ])),
        edges: largeNotes.flatMap(note => 
          note.linksTo.map(target => ({ source: note.slug, target }))
        ),
        orphans: new Set()
      };

      const startTime = Date.now();
      const result = analytics.calculateAnalytics(largeNotes, largeGraph);
      const endTime = Date.now();

      expect(result.basic.totalNotes).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
