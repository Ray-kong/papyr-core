import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsEngine } from '../src/analytics.js';
import { type WebReadyNote, type NoteGraph, type GraphNode } from '../src/types.js';

describe('AnalyticsEngine', () => {
  let analytics: AnalyticsEngine;
  let mockNotes: WebReadyNote[];
  let mockGraph: NoteGraph;

  beforeEach(() => {
    analytics = new AnalyticsEngine();
    
    mockNotes = [
      {
        slug: 'note1',
        title: 'Note One',
        html: '<p>Content</p>',
        metadata: { tags: ['tag1'] },
        linksTo: ['note2'],
        tags: ['tag1']
      } as WebReadyNote
    ];

    const mockNode: GraphNode = {
      id: 'note1',
      label: 'Note One',
      linkCount: 1,
      backlinkCount: 0,
      forwardLinkCount: 1,
      metadata: {}
    };

    mockGraph = {
      nodes: new Map([['note1',
         mockNode]]),
      edges: [],
      backlinks: new Map(),
      orphans: new Set()
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
      
      expect(result.basic.totalNotes).toBe(1);
      expect(result.basic.totalLinks).toBe(0);
      expect(result.basic.orphanedNotes).toBe(0); // The note is in the graph, so it's not orphaned
    });
  });
});
