import {
  type WebReadyNote,
  type NoteGraph,
  type AnalyticsResult,
  type BasicStats,
  type GraphAnalytics,
  type ContentAnalytics,
  type TagAnalytics
} from './types.js';

/**
 * AnalyticsEngine - Comprehensive analytics for Papyr note collections
 * 
 * Provides deep insights into note collections, including graph metrics,
 * content analysis, tag relationships, and network analysis.
 */
export class AnalyticsEngine {
  
  /**
   * Calculate comprehensive analytics for a note collection
   */
  calculateAnalytics(notes: WebReadyNote[], graph: NoteGraph): AnalyticsResult {
    console.log('📊 Calculating comprehensive analytics...');
    
    const basic = this.calculateBasicStats(notes, graph);
    const graphAnalytics = this.calculateGraphAnalytics(notes, graph);
    const content = this.calculateContentAnalytics(notes);
    const tags = this.calculateTagAnalytics(notes);

    return {
      basic,
      graph: graphAnalytics,
      content,
      tags
    };
  }

  /**
   * Calculate basic statistics
   */
  private calculateBasicStats(notes: WebReadyNote[], graph: NoteGraph): BasicStats {
    const totalWords = notes.reduce((sum, note) => sum + (note.wordCount || 0), 0);
    const totalConnections = Array.from(graph.nodes.values())
      .reduce((sum, node) => sum + node.linkCount, 0);

    return {
      totalNotes: notes.length,
      totalLinks: graph.edges.length,
      orphanedNotes: graph.orphans.size,
      averageConnections: notes.length > 0 ? totalConnections / notes.length : 0,
      totalWords,
      averageWordsPerNote: notes.length > 0 ? totalWords / notes.length : 0,
      buildTime: 0 // Will be set by builder
    };
  }

  /**
   * Calculate advanced graph analytics
   */
  private calculateGraphAnalytics(notes: WebReadyNote[], graph: NoteGraph): GraphAnalytics {
    const nodes = Array.from(graph.nodes.values());
    const nodeCount = nodes.length;
    const edgeCount = graph.edges.length;
    
    // Calculate graph density
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
    
    // Calculate average degree
    const totalDegree = nodes.reduce((sum, node) => sum + node.linkCount, 0);
    const averageDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    
    // Calculate connected components
    const connectedComponents = this.findConnectedComponents(graph);
    
    // Calculate centrality measures
    const centrality = this.calculateCentralityMeasures(graph);
    
    // Find clusters
    const clusters = this.findClusters(graph);

    return {
      nodeCount,
      edgeCount,
      orphanCount: graph.orphans.size,
      connectedComponents: connectedComponents.length,
      averageDegree,
      density,
      centrality,
      clusters
    };
  }

  /**
   * Calculate content analytics
   */
  private calculateContentAnalytics(notes: WebReadyNote[]): ContentAnalytics {
    const wordCounts = notes.map(note => note.wordCount || 0).filter(count => count > 0);
    const readingTimes = notes.map(note => note.readingTime || 0).filter(time => time > 0);
    const linkCounts = notes.map(note => note.linksTo.length);

    return {
      wordDistribution: {
        min: Math.min(...wordCounts),
        max: Math.max(...wordCounts),
        average: wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length,
        median: this.calculateMedian(wordCounts)
      },
      readingTimeDistribution: {
        min: Math.min(...readingTimes),
        max: Math.max(...readingTimes),
        average: readingTimes.reduce((sum, time) => sum + time, 0) / readingTimes.length
      },
      linkDensity: {
        average: linkCounts.reduce((sum, count) => sum + count, 0) / linkCounts.length,
        distribution: this.calculateDistribution(linkCounts)
      },
      orphanageRate: notes.length > 0 ? (notes.filter(note => note.linksTo.length === 0).length / notes.length) : 0
    };
  }

  /**
   * Calculate tag analytics
   */
  private calculateTagAnalytics(notes: WebReadyNote[]): TagAnalytics {
    const allTags: string[] = [];
    const tagCounts = new Map<string, number>();
    const tagCooccurrence = new Map<string, Map<string, number>>();

    // Collect all tags
    notes.forEach(note => {
      const tags = note.tags || [];
      allTags.push(...tags);
      
      // Count individual tags
      tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });

      // Track tag co-occurrence
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const tag1 = tags[i];
          const tag2 = tags[j];
          
          if (!tagCooccurrence.has(tag1)) {
            tagCooccurrence.set(tag1, new Map());
          }
          if (!tagCooccurrence.has(tag2)) {
            tagCooccurrence.set(tag2, new Map());
          }
          
          const tag1Map = tagCooccurrence.get(tag1)!;
          const tag2Map = tagCooccurrence.get(tag2)!;
          
          tag1Map.set(tag2, (tag1Map.get(tag2) || 0) + 1);
          tag2Map.set(tag1, (tag2Map.get(tag1) || 0) + 1);
        }
      }
    });

    // Calculate top tags
    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: (count / notes.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Calculate tag distribution
    const tagDistribution: Record<string, number> = {};
    Array.from(tagCounts.entries()).forEach(([tag, count]) => {
      tagDistribution[tag] = count;
    });

    // Find related tags
    const relatedTags: Array<{ tag1: string; tag2: string; cooccurrence: number }> = [];
    tagCooccurrence.forEach((cooccurrenceMap, tag1) => {
      cooccurrenceMap.forEach((count, tag2) => {
        if (tag1 < tag2) { // Avoid duplicates
          relatedTags.push({ tag1, tag2, cooccurrence: count });
        }
      });
    });
    relatedTags.sort((a, b) => b.cooccurrence - a.cooccurrence);

    return {
      totalTags: tagCounts.size,
      averageTagsPerNote: notes.length > 0 ? allTags.length / notes.length : 0,
      topTags,
      tagDistribution,
      relatedTags: relatedTags.slice(0, 10)
    };
  }

  /**
   * Find connected components in the graph
   */
  private findConnectedComponents(graph: NoteGraph): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];
    
    const dfs = (nodeId: string, component: string[]) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      component.push(nodeId);
      
      // Find all connected nodes
      graph.edges.forEach(edge => {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          dfs(edge.target, component);
        }
        if (edge.target === nodeId && !visited.has(edge.source)) {
          dfs(edge.source, component);
        }
      });
    };

    graph.nodes.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        const component: string[] = [];
        dfs(nodeId, component);
        if (component.length > 0) {
          components.push(component);
        }
      }
    });

    return components;
  }

  /**
   * Calculate centrality measures
   */
  private calculateCentralityMeasures(graph: NoteGraph): GraphAnalytics['centrality'] {
    const nodes = Array.from(graph.nodes.values());
    
    // Degree centrality (already available as linkCount)
    const degreeCentrality = nodes
      .map(node => ({ id: node.id, score: node.linkCount }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Simple hub and authority scores based on link patterns
    const hubs = nodes
      .map(node => ({ id: node.id, score: node.forwardLinkCount }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const authorities = nodes
      .map(node => ({ id: node.id, score: node.backlinkCount }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return {
      highest: degreeCentrality,
      hubs,
      authorities
    };
  }

  /**
   * Find clusters in the graph
   */
  private findClusters(graph: NoteGraph): Array<{ id: string; members: string[]; density: number }> {
    const components = this.findConnectedComponents(graph);
    
    return components
      .filter(component => component.length > 2) // Only consider clusters with 3+ nodes
      .map((component, index) => {
        // Calculate internal density
        const internalEdges = graph.edges.filter(edge => 
          component.includes(edge.source) && component.includes(edge.target)
        ).length;
        
        const maxPossibleEdges = component.length * (component.length - 1) / 2;
        const density = maxPossibleEdges > 0 ? internalEdges / maxPossibleEdges : 0;
        
        return {
          id: `cluster-${index + 1}`,
          members: component,
          density
        };
      })
      .sort((a, b) => b.density - a.density)
      .slice(0, 5); // Top 5 densest clusters
  }

  /**
   * Calculate median value
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Calculate distribution of values
   */
  private calculateDistribution(values: number[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    values.forEach(value => {
      const key = value.toString();
      distribution[key] = (distribution[key] || 0) + 1;
    });
    
    return distribution;
  }
}