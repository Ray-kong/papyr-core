# Papyr Core

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/Ray-kong/papyr-core/issues)
- **Documentation**: [GitHub Wiki](https://github.com/Ray-kong/papyr-core/wiki)

## Related Packages

- **papyr-react**: React components for building Papyr UIs
- **papyr-cli**: Command-line interface for Papyr
