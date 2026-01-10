# Papyr Core

[![npm version](https://img.shields.io/npm/v/papyr-core.svg)](https://www.npmjs.com/package/papyr-core)
[![npm downloads](https://img.shields.io/npm/dm/papyr-core.svg)](https://www.npmjs.com/package/papyr-core)
[![coverage](https://img.shields.io/badge/coverage-94.3%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.7%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.7%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.7%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-94.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-95.1%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-95.1%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-96.4%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-98.1%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-99.3%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-98.0%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-96.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-95.6%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-95.9%25-brightgreen?logo=vitest[![coverage](https://img.shields.io/badge/coverage-82.4%25-green?logo=vitest[![coverage](https://img.shields.io/badge/coverage-80.2%25-green?logo=vitest[![coverage](https://img.shields.io/badge/coverage-81.1%25-green?logo=vitest[![coverage](https://img.shields.io/badge/coverage-83.9%25-green?logo=vitest&style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)style=flat)](https://github.com/Ray-kong/papyr-core)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/Ray-kong/papyr-core/test-and-coverage.yml?branch=main)](https://github.com/Ray-kong/papyr-core/actions/workflows/test-and-coverage.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

A powerful core package for building markdown-based knowledge management systems. Papyr Core provides essential functionality for parsing, analyzing, and managing interconnected markdown documents.

## Features

- **Markdown Processing**: Parse markdown with frontmatter support
- **Graph Analysis**: Build and analyze document relationships
- **Wiki Links**: Support for `[[wiki-style]]` links between documents
- **Search**: Full-text search with FlexSearch
- **Analytics**: Document statistics and insights
- **Export**: JSON export capabilities
- **TypeScript**: Full TypeScript support with type definitions

## Installation

```bash
npm install papyr-core
```

## Quick Start

```typescript
import { PapyrBuilder, PapyrGraph, PapyrAnalytics } from 'papyr-core';

// Build a knowledge base from markdown files
const builder = new PapyrBuilder();
const data = await builder.buildFromDirectory('./notes');

// Analyze the graph
const graph = new PapyrGraph(data.graph);
const analytics = new PapyrAnalytics(data);

// Get insights
console.log('Total notes:', analytics.getTotalNotes());
console.log('Orphaned notes:', analytics.getOrphanedNotes());
console.log('Most linked notes:', analytics.getMostLinkedNotes());
```

## API Reference

### Core Classes

- **PapyrBuilder**: Build knowledge bases from markdown files
- **PapyrGraph**: Analyze document relationships and graph structure
- **PapyrAnalytics**: Generate insights and statistics
- **PapyrSearch**: Full-text search across documents
- **PapyrFileProcessor**: Process individual markdown files

### Key Methods

#### PapyrBuilder
- `buildFromDirectory(path: string)`: Build from a directory of markdown files
- `buildFromFiles(files: string[])`: Build from specific file paths
- `buildFromContent(content: string, filename?: string)`: Build from markdown content

#### PapyrGraph
- `getNeighbors(nodeId: string)`: Get connected documents
- `getPath(from: string, to: string)`: Find path between documents
- `getComponents()`: Get disconnected graph components

#### PapyrAnalytics
- `getTotalNotes()`: Count total documents
- `getOrphanedNotes()`: Find documents with no connections
- `getMostLinkedNotes(limit?: number)`: Get most referenced documents

## Configuration

The package supports various configuration options through the builder:

```typescript
const builder = new PapyrBuilder({
  includeFrontmatter: true,
  parseWikiLinks: true,
  generateGraph: true,
  generateSearchIndex: true
});
```

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Setup

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Development mode (watch for changes)
pnpm dev
```

### Project Structure

```
papyr-core/
├── src/           # Source code
├── tests/         # Test files
├── dist/          # Built output (generated)
├── package.json   # Package configuration
├── tsconfig.json  # TypeScript configuration
├── vite.config.ts # Build configuration
└── vitest.config.ts # Test configuration
```

## License

MIT License - see LICENSE file for details.

## Related Packages

- **papyr-react**: React components for building Papyr UIs
- **papyr-cli**: Command-line interface for Papyr
