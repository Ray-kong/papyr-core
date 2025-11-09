import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsEngine } from '../src/analytics.js';
import { type WebReadyNote, type NoteGraph, type GraphNode, type Slug } from '../src/types.js';

const createWebReadyNote = (options: {
  slug: string
  title?: string
  linksTo?: string[]
  tags?: string[]
  wordCount?: number
  readingTime?: number
  metadata?: Record<string, any>
}): WebReadyNote => {
  const {
    slug,
    title = slug,
    linksTo = [],
    tags = [],
    wordCount,
    readingTime,
    metadata = {}
  } = options;

  const typedSlug = slug as Slug;

  return {
    slug: typedSlug,
    title,
    html: `<p>${typedSlug}</p>`,
    metadata,
    linksTo,
    tags,
    wordCount,
    readingTime
  } as WebReadyNote;
};

const createGraphFromEdges = (
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>
): NoteGraph => {
  const nodes = new Map<string, GraphNode>();
  const backlinks = new Map<string, Set<string>>();

  nodeIds.forEach(id => {
    nodes.set(id, {
      id,
      label: id,
      metadata: {},
      linkCount: 0,
      backlinkCount: 0,
      forwardLinkCount: 0
    });
    backlinks.set(id, new Set());
  });

  edges.forEach(edge => {
    const node = nodes.get(edge.source);
    if (node) {
      node.forwardLinkCount += 1;
    }
    const backlinkSet = backlinks.get(edge.target);
    if (backlinkSet) {
      backlinkSet.add(edge.source);
    }
  });

  nodeIds.forEach(id => {
    const node = nodes.get(id)!;
    const backlinkSet = backlinks.get(id)!;
    node.backlinkCount = backlinkSet.size;
    node.linkCount = node.forwardLinkCount + node.backlinkCount;
  });

  const orphans = new Set<string>(
    nodeIds.filter(id => nodes.get(id)!.linkCount === 0)
  );

  return {
    nodes,
    edges,
    backlinks,
    orphans
  };
};

const buildComplexDataset = () => {
  const noteDefinitions = [
    {
      slug: 'alpha',
      linksTo: ['beta', 'gamma'],
      tags: ['knowledge', 'project'],
      wordCount: 500,
      readingTime: 4
    },
    {
      slug: 'beta',
      linksTo: ['gamma'],
      tags: ['knowledge', 'reference'],
      wordCount: 300,
      readingTime: 3
    },
    {
      slug: 'gamma',
      linksTo: ['alpha', 'delta'],
      tags: ['reference'],
      wordCount: 900,
      readingTime: 6
    },
    {
      slug: 'delta',
      linksTo: ['epsilon'],
      tags: ['project'],
      wordCount: 120,
      readingTime: 1
    },
    {
      slug: 'epsilon',
      linksTo: ['beta'],
      tags: ['project', 'reference'],
      wordCount: 60,
      readingTime: 1
    },
    {
      slug: 'zeta',
      linksTo: [],
      tags: ['lonely'],
      wordCount: 200,
      readingTime: 2
    }
  ];

  const notes = noteDefinitions.map(definition =>
    createWebReadyNote({
      slug: definition.slug,
      title: definition.slug,
      linksTo: definition.linksTo,
      tags: definition.tags,
      wordCount: definition.wordCount,
      readingTime: definition.readingTime,
      metadata: { tags: definition.tags }
    })
  );

  const edges = notes.flatMap(note =>
    note.linksTo.map(target => ({ source: note.slug, target }))
  );

  const graph = createGraphFromEdges(
    notes.map(note => note.slug),
    edges
  );

  return { notes, graph };
};

describe('AnalyticsEngine', () => {
  let analytics: AnalyticsEngine;
  let mockNotes: WebReadyNote[];
  let mockGraph: NoteGraph;

  beforeEach(() => {
    analytics = new AnalyticsEngine();
    
    mockNotes = [
      {
        slug: 'note1' as Slug,
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

    it('should include backlinks when averaging connections', () => {
      const notes = [
        createWebReadyNote({ slug: 'alpha', linksTo: ['beta'] }),
        createWebReadyNote({ slug: 'beta', linksTo: ['alpha'] })
      ];
      const graph = createGraphFromEdges(
        ['alpha', 'beta'],
        [
          { source: 'alpha', target: 'beta' },
          { source: 'beta', target: 'alpha' }
        ]
      );

      const result = analytics.calculateAnalytics(notes, graph);

      expect(result.basic.averageConnections).toBeCloseTo(2);
    });

    it('should return zeroed analytics for empty notes and graph', () => {
      const result = analytics.calculateAnalytics([], createGraphFromEdges([], []));

      expect(result.basic.totalNotes).toBe(0);
      expect(result.basic.totalLinks).toBe(0);
      expect(result.basic.orphanedNotes).toBe(0);
      expect(result.basic.totalWords).toBe(0);
      expect(result.graph.nodeCount).toBe(0);
      expect(result.graph.edgeCount).toBe(0);
      expect(result.graph.centrality.highest).toHaveLength(0);
      expect(result.graph.clusters).toHaveLength(0);
      expect(result.content.wordDistribution.min).toBe(0);
      expect(result.tags.totalTags).toBe(0);
    });

    it('should capture graph metrics, centrality, and cluster density', () => {
      const { notes, graph } = buildComplexDataset();
      const result = analytics.calculateAnalytics(notes, graph);
      const graphAnalytics = result.graph;

      expect(graphAnalytics.nodeCount).toBe(6);
      expect(graphAnalytics.edgeCount).toBe(7);
      expect(graphAnalytics.orphanCount).toBe(1);
      expect(graphAnalytics.connectedComponents).toBe(2);
      expect(graphAnalytics.averageDegree).toBeCloseTo(7 / 6, 5);
      expect(graphAnalytics.density).toBeCloseTo(7 / 30, 5);

      expect(graphAnalytics.centrality.highest[0]).toMatchObject({ id: 'gamma', score: 4 });
      const hubLeaders = graphAnalytics.centrality.hubs.slice(0, 2).map(item => item.id);
      expect(hubLeaders).toEqual(expect.arrayContaining(['alpha', 'gamma']));
      const authorityLeaders = graphAnalytics.centrality.authorities.slice(0, 2);
      expect(authorityLeaders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'beta', score: 2 }),
          expect.objectContaining({ id: 'gamma', score: 2 })
        ])
      );

      expect(graphAnalytics.clusters).toHaveLength(1);
      const cluster = graphAnalytics.clusters[0];
      expect(cluster.id).toBe('cluster-1');
      expect(cluster.members.length).toBe(5);
      expect(cluster.members).toEqual(
        expect.arrayContaining(['alpha', 'beta', 'gamma', 'delta', 'epsilon'])
      );
      expect(cluster.density).toBeCloseTo(0.35, 5);
    });

    it('should derive content analytics from word counts and reading times', () => {
      const { notes, graph } = buildComplexDataset();
      const content = analytics.calculateAnalytics(notes, graph).content;

      expect(content.wordDistribution.min).toBe(60);
      expect(content.wordDistribution.max).toBe(900);
      expect(content.wordDistribution.average).toBeCloseTo(2080 / 6, 5);
      expect(content.wordDistribution.median).toBe(250);
      expect(content.readingTimeDistribution.min).toBe(1);
      expect(content.readingTimeDistribution.max).toBe(6);
      expect(content.readingTimeDistribution.average).toBeCloseTo(17 / 6, 5);
      expect(content.linkDensity.average).toBeCloseTo(7 / 6, 5);
      expect(content.linkDensity.distribution['0']).toBe(1);
      expect(content.linkDensity.distribution['1']).toBe(3);
      expect(content.linkDensity.distribution['2']).toBe(2);
      expect(content.orphanageRate).toBeCloseTo(1 / 6, 5);
    });

    it('should summarize tag usage, distribution, and relationships', () => {
      const { notes, graph } = buildComplexDataset();
      const tags = analytics.calculateAnalytics(notes, graph).tags;

      expect(tags.totalTags).toBe(4);
      expect(tags.averageTagsPerNote).toBeCloseTo(9 / 6, 5);

      const topTagNames = tags.topTags.map(tag => tag.tag);
      expect(topTagNames.slice(0, 2)).toEqual(expect.arrayContaining(['project', 'reference']));
      const topTagCounts = Object.fromEntries(tags.topTags.map(tag => [tag.tag, tag.count]));
      expect(topTagCounts.project).toBe(3);
      expect(topTagCounts.reference).toBe(3);
      expect(tags.tagDistribution).toMatchObject({
        knowledge: 2,
        project: 3,
        reference: 3,
        lonely: 1
      });

      expect(tags.relatedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tag1: 'knowledge', tag2: 'project', cooccurrence: 1 }),
          expect.objectContaining({ tag1: 'knowledge', tag2: 'reference', cooccurrence: 1 }),
          expect.objectContaining({ tag1: 'project', tag2: 'reference', cooccurrence: 1 })
        ])
      );
    });

    it('should treat backlink-only nodes as standalone directed components', () => {
      const notes = [
        createWebReadyNote({ slug: 'hub', wordCount: 150, readingTime: 2 }),
        createWebReadyNote({ slug: 'leaf-a', linksTo: ['hub'], wordCount: 80, readingTime: 1 }),
        createWebReadyNote({ slug: 'leaf-b', linksTo: ['hub'], wordCount: 60, readingTime: 1 })
      ];
      const graph = createGraphFromEdges(
        ['hub', 'leaf-a', 'leaf-b'],
        [
          { source: 'leaf-a', target: 'hub' },
          { source: 'leaf-b', target: 'hub' }
        ]
      );

      const graphAnalytics = analytics.calculateAnalytics(notes, graph).graph;

      expect(graphAnalytics.connectedComponents).toBe(3);
      expect(graphAnalytics.centrality.authorities[0]).toEqual(
        expect.objectContaining({ id: 'hub', score: 2 })
      );
    });

    it('should calculate median correctly for odd distributions', () => {
      const notes = [
        createWebReadyNote({ slug: 'one', wordCount: 100, readingTime: 1 }),
        createWebReadyNote({ slug: 'two', wordCount: 200, readingTime: 2 }),
        createWebReadyNote({ slug: 'three', wordCount: 300, readingTime: 3 })
      ];
      const graph = createGraphFromEdges(
        ['one', 'two', 'three'],
        [
          { source: 'one', target: 'two' },
          { source: 'two', target: 'three' }
        ]
      );

      const content = analytics.calculateAnalytics(notes, graph).content;

      expect(content.wordDistribution.median).toBe(200);
    });
  });
});
