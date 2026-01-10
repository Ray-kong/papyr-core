# Papyr Core

[![npm version](https://img.shields.io/npm/v/papyr-core.svg)](https://www.npmjs.com/package/papyr-core)
[![npm downloads](https://img.shields.io/npm/dm/papyr-core.svg)](https://www.npmjs.com/package/papyr-core)
[![coverage](https://img.shields.io/badge/coverage-93.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-93.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.3%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.7%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.7%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.7%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-95.1%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-95.1%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-96.4%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-98.1%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-99.3%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-98.0%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-96.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-95.6%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-95.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-82.4%25-green?logo=vitest[![coverage](https://img.shields.io/badge/coverage-80.2%25-green?logo=vitest[![coverage](https://img.shields.io/badge/coverage-81.1%25-green?logo=vitest[![coverage](https://img.shields.io/badge/coverage-83.9%25-green?logo=vitest&style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/Ray-kong/papyr-core/test-and-coverage.yml?branch=main)](https://github.com/Ray-kong/papyr-core/actions/workflows/test-and-coverage.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

A framework-agnostic core library for building markdown-based knowledge management systems. Papyr Core handles markdown parsing, graph analysis, full-text search, and folder hierarchy construction.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [PapyrBuilder](#papyrbuilder)
  - [Markdown Parsing](#markdown-parsing)
  - [Graph Building and Analysis](#graph-building-and-analysis)
  - [Search](#search)
  - [Folder Hierarchy](#folder-hierarchy)
  - [Analytics](#analytics)
  - [JSON Export](#json-export)
- [Module Exports](#module-exports)
- [Types](#types)
- [Development](#development)
- [License](#license)

## Installation

```bash
npm install papyr-core
# or
pnpm add papyr-core
# or
yarn add papyr-core
```

## Quick Start

```typescript
import { PapyrBuilder } from 'papyr-core'

// Build from a directory of markdown files
const builder = new PapyrBuilder()
const result = await builder.buildFromDirectory('./notes')

// Access the processed data
const { notes, graph, searchIndex, folderHierarchy } = result

// Search across all notes
import { searchNotes } from 'papyr-core/search'
const hits = searchNotes('query', searchIndex, { limit: 10 })

// Analyze the note graph
import { findOrphanedNotes, calculateCentrality } from 'papyr-core/graphAnalysis'
const orphans = findOrphanedNotes(graph)
const centrality = calculateCentrality(graph)
```

## API Reference

### PapyrBuilder

The main entry point for processing markdown content into a structured knowledge base.

```typescript
import { PapyrBuilder } from 'papyr-core'

const builder = new PapyrBuilder()

// Build from a directory
const result = await builder.buildFromDirectory('./notes')

// Build from an array of file paths
const result = await builder.buildFromFiles(['./note1.md', './note2.md'])

// Build from raw markdown content
const result = await builder.buildFromContent([
  { content: '# Hello\n\nThis is a note.', filename: 'hello.md' }
])
```

The builder returns a `PapyrBuildResult` containing:

- `notes`: Array of `WebReadyNote` objects with parsed HTML content
- `graph`: `NoteGraph` representing connections between notes
- `searchIndex`: `SearchIndex` for full-text search
- `folderHierarchy`: `FolderNode[]` tree structure of the file system

### Markdown Parsing

Parse markdown with frontmatter and wiki-link support.

```typescript
import { parseMarkdown } from 'papyr-core'

const result = parseMarkdown(`---
title: My Note
tags: [javascript, typescript]
---

# Introduction

Link to [[another-note]] using wiki syntax.
`)

// result.frontmatter: { title: 'My Note', tags: ['javascript', 'typescript'] }
// result.html: '<h1>Introduction</h1><p>Link to <a href="another-note">another-note</a>...</p>'
// result.headings: [{ level: 1, text: 'Introduction', slug: 'introduction' }]
// result.wikiLinks: ['another-note']
```

Features:
- YAML frontmatter extraction via gray-matter
- GitHub Flavored Markdown (tables, strikethrough, task lists)
- Wiki-link syntax: `[[note-slug]]` and `[[note-slug|display text]]`
- Syntax highlighting via rehype-highlight
- Automatic heading extraction with slugs

### Graph Building and Analysis

Build and analyze the relationship graph between notes.

```typescript
import { buildNoteGraph, getBacklinks, findShortestPath } from 'papyr-core/graph'
import {
  findOrphanedNotes,
  calculateCentrality,
  findHubs,
  getConnectedComponents,
  findBridgeNotes
} from 'papyr-core/graphAnalysis'

// Build graph from notes
const graph = buildNoteGraph(notes)

// Get all notes linking to a specific note
const backlinks = getBacklinks(graph, 'my-note')

// Find shortest path between two notes
const path = findShortestPath(graph, 'start-note', 'end-note')

// Find notes with no incoming or outgoing links
const orphans = findOrphanedNotes(graph)

// Calculate centrality scores (0-1, higher = more connected)
const centrality = calculateCentrality(graph)

// Find highly connected hub notes
const hubs = findHubs(graph, { minConnections: 5 })

// Get disconnected clusters of notes
const components = getConnectedComponents(graph)

// Find bridge notes connecting different clusters
const bridges = findBridgeNotes(graph)
```

Graph node properties:
- `id`: Note slug
- `label`: Note title
- `linkCount`: Number of outgoing links
- `backlinkCount`: Number of incoming links

### Search

Full-text search powered by FlexSearch.

```typescript
import { generateSearchIndex, searchNotes, importSearchIndex, exportSearchIndex } from 'papyr-core/search'

// Generate index from notes
const searchIndex = generateSearchIndex(notes)

// Search with options
const results = searchNotes('query', searchIndex, {
  limit: 20,
  fuzzy: true,
  highlight: true,
  boost: {
    title: 5,
    headings: 3,
    content: 1,
    metadata: 2
  }
})

// results[0]:
// {
//   slug: 'matching-note',
//   title: 'Matching Note',
//   excerpt: '...context around the match...',
//   score: 0.95,
//   matchedFields: ['title', 'content'],
//   highlights: [{ field: 'title', text: 'Matching Note' }]
// }

// Serialize for storage/transfer
const serialized = exportSearchIndex(searchIndex)

// Restore from serialized form
const restored = importSearchIndex(serialized)
```

### Folder Hierarchy

Build a tree structure representing the file system layout.

```typescript
import { buildFolderHierarchy } from 'papyr-core/folderHierarchy'

const notes = [
  { slug: 'readme', filePath: 'readme.md' },
  { slug: 'guides/getting-started', filePath: 'guides/getting-started.md' },
  { slug: 'guides/advanced', filePath: 'guides/advanced.md' }
]

const tree = buildFolderHierarchy(notes)

// tree:
// {
//   name: '',
//   path: '',
//   notes: ['readme'],
//   children: [{
//     name: 'guides',
//     path: 'guides',
//     notes: ['guides/getting-started', 'guides/advanced'],
//     children: []
//   }]
// }
```

### Analytics

Generate insights and statistics about your knowledge base.

```typescript
import { AnalyticsEngine } from 'papyr-core/analytics'

const analytics = new AnalyticsEngine(notes, graph)

// Graph analytics
const graphStats = analytics.getGraphAnalytics()
// {
//   totalNodes: 100,
//   totalEdges: 250,
//   averageDegree: 5,
//   density: 0.05,
//   orphanedNotes: ['isolated-note'],
//   hubNotes: [{ slug: 'index', connections: 45 }],
//   bridgeNotes: ['connector-note']
// }

// Content analytics
const contentStats = analytics.getContentAnalytics()
// {
//   totalNotes: 100,
//   totalWords: 50000,
//   averageWordCount: 500,
//   notesWithFrontmatter: 95,
//   notesWithHeadings: 88
// }

// Tag analytics
const tagStats = analytics.getTagAnalytics()
// {
//   uniqueTags: 25,
//   tagDistribution: { javascript: 30, typescript: 25, react: 20 },
//   untaggedNotes: ['untitled-note']
// }
```

### JSON Export

Export the entire knowledge base to JSON for static site generation or API responses.

```typescript
import { exportToJson } from 'papyr-core/jsonExporter'

const json = exportToJson({
  notes,
  graph,
  searchIndex,
  folderHierarchy
})

// Write to file for static site
await fs.writeFile('data.json', JSON.stringify(json))
```

## Module Exports

Papyr Core provides multiple entry points for tree-shaking:

```typescript
// Main entry - includes everything
import { PapyrBuilder, parseMarkdown, buildNoteGraph } from 'papyr-core'

// Runtime-safe imports (no Node.js dependencies)
import { searchNotes, type WebReadyNote, type NoteGraph } from 'papyr-core/runtime'

// Individual modules
import { buildNoteGraph, getBacklinks } from 'papyr-core/graph'
import { findOrphanedNotes, calculateCentrality } from 'papyr-core/graphAnalysis'
import { generateSearchIndex, searchNotes } from 'papyr-core/search'
import { buildFolderHierarchy } from 'papyr-core/folderHierarchy'
import { resolveLinks, validateLinks } from 'papyr-core/linkResolver'
import { exportToJson } from 'papyr-core/jsonExporter'
import { AnalyticsEngine } from 'papyr-core/analytics'
```

Use `papyr-core/runtime` in browser code to avoid bundling Node.js-specific modules.

## Types

Key TypeScript types exported from the package:

```typescript
interface WebReadyNote {
  slug: Slug
  title: string
  html: string
  filePath: string
  frontmatter: Record<string, unknown>
  headings: Heading[]
  wikiLinks: string[]
  tags: string[]
  createdAt?: string
  updatedAt?: string
}

interface NoteGraph {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
}

interface GraphNode {
  id: string
  label: string
  linkCount: number
  backlinkCount: number
}

interface GraphEdge {
  source: string
  target: string
}

interface SearchHit {
  slug: string
  title: string
  excerpt: string
  score: number
  matchedFields: string[]
  highlights?: { field: string; text: string }[]
}

interface FolderNode {
  name: string
  path: string
  notes: Slug[]
  children: FolderNode[]
}

interface Heading {
  level: number
  text: string
  slug: string
}
```

## Development

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended)

### Commands

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode for development
pnpm dev
```

### Project Structure

```
papyr-core/
├── src/
│   ├── index.ts           # Main entry point
│   ├── runtime/           # Browser-safe exports
│   ├── builder.ts         # PapyrBuilder class
│   ├── parseMarkdown.ts   # Markdown processing
│   ├── graph.ts           # Graph building
│   ├── graphAnalysis.ts   # Graph analysis functions
│   ├── search.ts          # Search index and queries
│   ├── folderHierarchy.ts # Folder tree construction
│   ├── linkResolver.ts    # Wiki-link resolution
│   ├── analytics.ts       # Analytics engine
│   ├── jsonExporter.ts    # JSON export
│   └── types.ts           # TypeScript definitions
├── dist/                  # Built output
└── package.json
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related

- [papyr-react](https://github.com/Ray-kong/papyr-react) - React components for building Papyr UIs
