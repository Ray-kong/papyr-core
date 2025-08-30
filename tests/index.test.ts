import { describe, it, expect } from 'vitest';

describe('Index Exports', () => {
  describe('Core exports', () => {
    it('should export parseMarkdown functions', async () => {
      const { parseMarkdown, toWebReadyNote } = await import('../src/index.js');
      
      expect(typeof parseMarkdown).toBe('function');
      expect(typeof toWebReadyNote).toBe('function');
    });

    it('should export graph functions', async () => {
      const { 
        buildNoteGraph, 
        getBacklinks, 
        getConnections,
        findShortestPath 
      } = await import('../src/index.js');
      
      expect(typeof buildNoteGraph).toBe('function');
      expect(typeof getBacklinks).toBe('function');
      expect(typeof getConnections).toBe('function');
      expect(typeof findShortestPath).toBe('function');
    });

    it('should export link resolver functions', async () => {
      const { 
        resolveLinks, 
        findOrphanedLinks,
        createLinkMaps,
        validateLinks,
        getReachableNotes
      } = await import('../src/index.js');
      
      expect(typeof resolveLinks).toBe('function');
      expect(typeof findOrphanedLinks).toBe('function');
      expect(typeof createLinkMaps).toBe('function');
      expect(typeof validateLinks).toBe('function');
      expect(typeof getReachableNotes).toBe('function');
    });

    it('should export graph analysis functions', async () => {
      const {
        findOrphanedNotes,
        findMostLinkedNotes,
        findMostReferencedNotes,
        calculateCentrality,
        getConnectedComponents,
        getGraphStatistics,
        findHubs,
        findAuthorities,
        getNeighborhood
      } = await import('../src/index.js');
      
      expect(typeof findOrphanedNotes).toBe('function');
      expect(typeof findMostLinkedNotes).toBe('function');
      expect(typeof findMostReferencedNotes).toBe('function');
      expect(typeof calculateCentrality).toBe('function');
      expect(typeof getConnectedComponents).toBe('function');
      expect(typeof getGraphStatistics).toBe('function');
      expect(typeof findHubs).toBe('function');
      expect(typeof findAuthorities).toBe('function');
      expect(typeof getNeighborhood).toBe('function');
    });

    it('should export search functions', async () => {
      const {
        generateSearchIndex,
        searchNotes,
        addNoteToIndex,
        removeNoteFromIndex,
        updateNoteInIndex,
        getSearchSuggestions
      } = await import('../src/index.js');
      
      expect(typeof generateSearchIndex).toBe('function');
      expect(typeof searchNotes).toBe('function');
      expect(typeof addNoteToIndex).toBe('function');
      expect(typeof removeNoteFromIndex).toBe('function');
      expect(typeof updateNoteInIndex).toBe('function');
      expect(typeof getSearchSuggestions).toBe('function');
    });

    it('should export file processor functions', async () => {
      const {
        processMarkdownContent,
        processMarkdownContentToWeb,
        processMarkdownContents,
        processMarkdownContentsToWeb
      } = await import('../src/index.js');
      
      expect(typeof processMarkdownContent).toBe('function');
      expect(typeof processMarkdownContentToWeb).toBe('function');
      expect(typeof processMarkdownContents).toBe('function');
      expect(typeof processMarkdownContentsToWeb).toBe('function');
    });

    it('should export JSON exporter functions', async () => {
      const {
        exportToJSON,
        exportWebReadyToJSON,
        toJSONString
      } = await import('../src/index.js');
      
      expect(typeof exportToJSON).toBe('function');
      expect(typeof exportWebReadyToJSON).toBe('function');
      expect(typeof toJSONString).toBe('function');
    });

    it('should export builder and analytics classes', async () => {
      const { PapyrBuilder, AnalyticsEngine } = await import('../src/index.js');
      
      expect(typeof PapyrBuilder).toBe('function'); // Constructor
      expect(typeof AnalyticsEngine).toBe('function'); // Constructor
    });
  });

  describe('Type exports', () => {
    it('should export core types', async () => {
      // Test that types are available by importing them
      // TypeScript will catch if these don't exist
      const module = await import('../src/index.js');
      
      // These are type-only exports, so we can't test them at runtime
      // But if the module imports successfully, the types are exported correctly
      expect(module).toBeDefined();
    });
  });

  describe('Integration test', () => {
    it('should be able to use exported functions together', async () => {
      const { parseMarkdown, buildNoteGraph, generateSearchIndex } = await import('../src/index.js');
      
      // Test basic integration
      const note1 = await parseMarkdown('# Note 1\n\nContent with [[Note 2]] link.');
      const note2 = await parseMarkdown('# Note 2\n\nContent of note 2.');
      
      const notes = [note1, note2];
      const graph = buildNoteGraph(notes);
      const searchIndex = generateSearchIndex(notes);
      
      expect(graph.nodes.size).toBe(2);
      expect(graph.edges.length).toBe(1);
      expect(searchIndex.documents.size).toBe(2);
    });

    it('should handle complete workflow', async () => {
      const { 
        processMarkdownContentsToWeb,
        buildNoteGraph,
        generateSearchIndex,
        exportWebReadyToJSON
      } = await import('../src/index.js');
      
      const contents = [
        {
          content: '# First Note\n\nThis links to [[Second Note]].',
          filePath: '/notes/first.md',
          baseDir: '/notes'
        },
        {
          content: '# Second Note\n\nThis is the second note.',
          filePath: '/notes/second.md',
          baseDir: '/notes'
        }
      ];

      // Process to web-ready format
      const webReadyResult = await processMarkdownContentsToWeb(contents);
      expect(webReadyResult.files).toHaveLength(2);

      // Build graph
      const notes = webReadyResult.files.map(f => f.note);
      const graph = buildNoteGraph(notes);
      expect(graph.nodes.size).toBe(2);

      // Generate search index
      const searchIndex = generateSearchIndex(notes);
      expect(searchIndex.documents.size).toBe(2);

      // Export to JSON
      const exportedData = exportWebReadyToJSON(webReadyResult, graph, searchIndex);
      expect(exportedData.notes).toHaveLength(2);
      expect(exportedData.graph.nodes).toHaveLength(2);
      expect(exportedData.searchIndex.documents).toHaveLength(2);
    });
  });

  describe('Error handling in exports', () => {
    it('should handle invalid input gracefully', async () => {
      const { parseMarkdown } = await import('../src/index.js');
      
      // Test with empty content
      const emptyNote = await parseMarkdown('');
      expect(emptyNote.title).toBeDefined();
      expect(emptyNote.content).toBe('');
    });

    it('should handle malformed markdown', async () => {
      const { parseMarkdown } = await import('../src/index.js');
      
      // Test with malformed markdown
      const malformedNote = await parseMarkdown('# Unclosed [link');
      expect(malformedNote.title).toBeDefined();
      expect(malformedNote.content).toBeDefined();
    });
  });

  describe('Performance of exports', () => {
    it('should import modules efficiently', async () => {
      const startTime = Date.now();
      
      await import('../src/index.js');
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should import quickly
    });

    it('should handle large-scale operations', async () => {
      const { processMarkdownContentsToWeb, buildNoteGraph } = await import('../src/index.js');
      
      // Create large dataset
      const contents = Array.from({ length: 100 }, (_, i) => ({
        content: `# Note ${i}\n\nContent for note ${i}.`,
        filePath: `/notes/note-${i}.md`,
        baseDir: '/notes'
      }));

      const startTime = Date.now();
      
      const result = await processMarkdownContentsToWeb(contents);
      const graph = buildNoteGraph(result.files.map(f => f.note));
      
      const endTime = Date.now();
      
      expect(result.files).toHaveLength(100);
      expect(graph.nodes.size).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
