import * as fs from 'fs';
import * as path from 'path';
import { 
  processMarkdownContentsToWeb,
  buildNoteGraph,
  generateSearchIndex,
  exportSearchIndex,
  type BuildConfig,
  type BuildResult,
  type SourceFile,
  type BuildInfo,
  type BuildError,
  type WebReadyNote,
  type NoteGraph,
  type SearchIndex,
  type AnalyticsResult
} from './index.js';
import { AnalyticsEngine } from './analytics.js';
import { buildFolderHierarchy } from './folderHierarchy.js';
import { type FolderNode } from './types.js';

const DEFAULT_INCLUDE_PATTERNS = ['**/*.md'];
const DEFAULT_EXCLUDE_PATTERNS = ['**/node_modules/**', '**/.git/**'];
const MARKDOWN_EXTENSION_REGEX = /\.md\b/i;

const isMarkdownPattern = (pattern: string): boolean => MARKDOWN_EXTENSION_REGEX.test(pattern);

/**
 * PapyrBuilder - Automated build pipeline for Papyr projects
 * 
 * Handles the complete build process from markdown files to web-ready data,
 * including file discovery, processing, analytics, and output generation.
 */
export class PapyrBuilder {
  private config: BuildConfig;
  private fileWatcher?: fs.FSWatcher;
  private packageVersion: string;

  constructor(config: BuildConfig) {
    const {
      patterns,
      processing,
      output,
      watch,
      ...restConfig
    } = config;

    const mergePatterns = (defaults: string[], overrides?: string[]) => {
      if (!overrides || overrides.length === 0) {
        return defaults;
      }

      return Array.from(new Set([...defaults, ...overrides]));
    };

    const includeOverrides = patterns?.include ?? [];
    const hasIncludeOverrides = includeOverrides.length > 0;
    const hasNonMarkdownIncludes = includeOverrides.some(pattern => !isMarkdownPattern(pattern));
    const includePatterns = !hasIncludeOverrides
      ? [...DEFAULT_INCLUDE_PATTERNS]
      : hasNonMarkdownIncludes
        ? Array.from(new Set([...DEFAULT_INCLUDE_PATTERNS, ...includeOverrides]))
        : includeOverrides;

    this.config = {
      ...restConfig,
      patterns: {
        include: includePatterns,
        exclude: mergePatterns(DEFAULT_EXCLUDE_PATTERNS, patterns?.exclude)
      },
      processing: {
        generateExcerpts: true,
        calculateReadingTime: true,
        extractKeywords: true,
        processImages: false,
        ...processing
      },
      output: {
        formats: ['json'],
        separateFiles: true,
        compress: false,
        ...output
      },
      watch: watch ?? false
    };

    this.packageVersion = this.resolvePackageVersion();

    // Ensure output directory exists
    this.ensureOutputDirectory();
  }

  /**
   * Execute the complete build pipeline
   */
  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    const buildErrors: BuildError[] = [];

    console.log('🚀 Starting Papyr build process...');
    console.log(`📁 Source directory: ${this.config.sourceDir}`);
    console.log(`📁 Output directory: ${this.config.outputDir}`);

    try {
      // Discover source files
      const sourceFiles = await this.discoverSourceFiles();
      console.log(`📄 Found ${sourceFiles.length} markdown files`);

      // Process markdown files
      console.log('⚙️  Processing markdown files...');
      const webResult = await processMarkdownContentsToWeb(sourceFiles);
      const notes = webResult.files.map(file => file.note);
      
      // Collect processing errors
      if (webResult.errors && webResult.errors.length > 0) {
        buildErrors.push(
          ...webResult.errors.map(err => ({
            type: 'build' as const,
            code: 'PLUGIN_ERROR' as const,
            message: err.error?.message ?? 'Unknown error',
            file: err.filePath ?? 'unknown',
            cause: err.error
          }))
        );
      }

      // Build note graph
      console.log('🕸️  Building note graph...');
      const graph = buildNoteGraph(notes);

      // Generate search index
      console.log('🔍 Generating search index...');
      const searchIndex = generateSearchIndex(notes);

      // Build folder hierarchy
      console.log('📁 Building folder hierarchy...');
      const slugLookup = new Map<string, (typeof notes)[number]['slug']>();
      webResult.files.forEach(file => {
        const pathKey = file.relativePath ?? file.filePath;
        if (!pathKey) {
          return;
        }
        const normalizedPath = pathKey.replace(/\\/g, '/');
        slugLookup.set(normalizedPath, file.note.slug);
      });
      const folderHierarchy = buildFolderHierarchy(
        sourceFiles,
        path.basename(this.config.sourceDir),
        slugLookup
      );

      // Calculate analytics
      console.log('📊 Calculating analytics...');
      const analytics = this.calculateAnalytics(notes, graph);

      const buildTime = Date.now() - startTime;
      analytics.basic.buildTime = buildTime;

      // Create build info
      const buildInfo: BuildInfo = {
        timestamp: new Date().toISOString(),
        duration: buildTime,
        version: this.packageVersion,
        config: this.config,
        sources: {
          totalFiles: sourceFiles.length,
          processedFiles: notes.length,
          skippedFiles: sourceFiles.length - notes.length,
          errors: buildErrors
        }
      };

      const result: BuildResult = {
        notes,
        graph,
        searchIndex,
        analytics,
        buildInfo,
        folderHierarchy
      };

      // Output results
      await this.outputResults(result);

      console.log('\n✅ Build completed successfully!');
      console.log(`📊 Statistics:`);
      console.log(`   • ${analytics.basic.totalNotes} notes processed`);
      console.log(`   • ${analytics.basic.totalLinks} links found`);
      console.log(`   • ${analytics.basic.orphanedNotes} orphaned notes`);
      console.log(`   • ${analytics.basic.averageConnections.toFixed(1)} average connections`);
      console.log(`   • ${buildTime}ms build time`);
      console.log(`   • Top tags: ${analytics.tags.topTags.slice(0, 5).map(t => t.tag).join(', ')}`);
      console.log(`\n📁 Output saved to: ${this.config.outputDir}`);

      return result;

    } catch (error) {
      console.error('❌ Build failed:', error);
      throw error;
    }
  }

  /**
   * Enable file watching for development
   */
  watch(onChange: (result: BuildResult) => void): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }

    console.log(`👀 Watching ${this.config.sourceDir} for changes...`);

    this.fileWatcher = fs.watch(
      this.config.sourceDir,
      { recursive: true },
      async (eventType, filename) => {
        if (filename && filename.endsWith('.md')) {
          console.log(`📝 File changed: ${filename}`);
          try {
            const result = await this.build();
            onChange(result);
          } catch (error) {
            console.error('Build error during watch:', error);
          }
        }
      }
    );
  }

  /**
   * Stop watching files
   */
  stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
      console.log('⏹️  Stopped watching files');
    }
  }

  /**
   * Discover source files based on configuration patterns
   */
  private async discoverSourceFiles(): Promise<SourceFile[]> {
    const files: SourceFile[] = [];
    
    const walkDirectory = async (currentDir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(this.config.sourceDir, fullPath);
          const normalizedRelativePath = this.normalizeGlobPath(relativePath);
          
          // Check exclusion patterns first
          if (this.shouldExcludeFile(normalizedRelativePath)) {
            console.log(`⚠️  Excluding: ${normalizedRelativePath}`);
            continue;
          }
          
          if (entry.isDirectory()) {
            // Recursively walk subdirectories
            await walkDirectory(fullPath);
          } else if (entry.isFile()) {
            // Check if file should be included
            if (this.shouldIncludeFile(normalizedRelativePath)) {
              try {
                const content = await fs.promises.readFile(fullPath, 'utf-8');
                const stats = await fs.promises.stat(fullPath);

                console.log(`✅ Including: ${normalizedRelativePath}`);
                files.push({
                  content,
                  filePath: normalizedRelativePath,
                  relativePath: normalizedRelativePath,
                  baseDir: this.config.sourceDir,
                  stats: {
                    size: stats.size,
                    modified: stats.mtime,
                    created: stats.birthtime
                  }
                });
              } catch (error) {
                console.warn(`⚠️  Could not read file ${fullPath}:`, error);
              }
            } else {
              console.log(`ℹ️  Skipping: ${normalizedRelativePath} (pattern mismatch)`);
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not read directory ${currentDir}:`, error);
      }
    };

    console.log(`🔍 Discovering files in: ${this.config.sourceDir}`);
    await walkDirectory(this.config.sourceDir);
    
    console.log(`📋 File discovery summary: ${files.length} files found`);
    files.forEach((file, i) => console.log(`  ${i + 1}. ${file.relativePath}`));
    
    return files;
  }

  /**
   * Check if a file should be included based on inclusion patterns
   */
  private shouldIncludeFile(filePath: string): boolean {
    const normalizedPath = this.normalizeGlobPath(filePath);
    const patterns = this.config.patterns?.include || ['**/*.md'];
    return patterns.some(pattern => this.matchesPattern(normalizedPath, pattern));
  }

  /**
   * Check if a file should be excluded based on exclusion patterns
   */
  private shouldExcludeFile(filePath: string): boolean {
    const normalizedPath = this.normalizeGlobPath(filePath);
    const patterns = this.config.patterns?.exclude || [];
    return patterns.some(pattern => this.matchesPattern(normalizedPath, pattern));
  }

  /**
   * Simple glob pattern matching
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    const normalizedPath = this.normalizeGlobPath(filePath);
    let normalizedPattern = this.normalizeGlobPath(pattern).replace(/^\.\//, '');

    if (normalizedPattern.endsWith('/')) {
      normalizedPattern = `${normalizedPattern}**`;
    }

    // Special handling for common patterns
    if (normalizedPattern === '**/*.md') {
      // This should match any .md file at any level (including root)
      return normalizedPath.endsWith('.md');
    }

    let leadingDeepMatch = '';
    if (normalizedPattern.startsWith('**/')) {
      normalizedPattern = normalizedPattern.slice(3);
      leadingDeepMatch = '(?:^|.*/)';
    }

    // Convert glob pattern to regex while preserving globstars
    const globstarSentinel = '__PAPYR_GLOBSTAR__';
    const regexPattern = normalizedPattern
      .replace(/\*\*/g, globstarSentinel)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(new RegExp(globstarSentinel, 'g'), '.*');

    const regexSource = `^${leadingDeepMatch}${regexPattern}$`;
    const regex = new RegExp(regexSource);
    const matches = regex.test(normalizedPath);
    
    console.log(`🔍 Pattern match: "${normalizedPath}" vs "${normalizedPattern}" -> ${matches ? '✅' : '❌'} (regex: ${regex.source})`);
    return matches;
  }

  private normalizeGlobPath(input: string): string {
    return input.replace(/\\/g, '/');
  }

  /**
   * Calculate comprehensive analytics
   */
  private calculateAnalytics(notes: WebReadyNote[], graph: NoteGraph): AnalyticsResult {
    const engine = new AnalyticsEngine();
    return engine.calculateAnalytics(notes, graph);
  }

  /**
   * Output build results in configured formats
   */
  private async outputResults(result: BuildResult): Promise<void> {
    const formats = this.config.output?.formats || ['json'];
    const separateFiles = this.config.output?.separateFiles ?? true;
    const serializedSearchIndex = await exportSearchIndex(result.searchIndex);

    if (separateFiles) {
      // Output as separate files
      await this.saveToFile('notes.json', result.notes);
      await this.saveToFile('graph.json', this.serializeForJSON(result.graph));
      await this.saveToFile('search-index.json', serializedSearchIndex);
      await this.saveToFile('analytics.json', result.analytics);
      await this.saveToFile('build-info.json', result.buildInfo);
      await this.saveToFile('folder-hierarchy.json', this.serializeFolderHierarchy(result.folderHierarchy));
    }

    // Always create combined data file
    const combinedData = {
      notes: result.notes,
      graph: this.serializeForJSON(result.graph),
      searchIndex: serializedSearchIndex,
      analytics: result.analytics,
      buildInfo: result.buildInfo,
      folderHierarchy: this.serializeFolderHierarchy(result.folderHierarchy)
    };

    await this.saveToFile('papyr-data.json', combinedData);

    // Handle additional export formats
    for (const format of formats) {
      if (format !== 'json') {
        await this.exportToFormat(result, format);
      }
    }
  }

  /**
   * Export to different formats
   */
  private async exportToFormat(result: BuildResult, format: string): Promise<void> {
    switch (format) {
      case 'csv': {
        const notesCsv = this.buildNotesCsv(result.notes);
        await this.saveToFile('notes.csv', notesCsv);
        const graphCsv = this.buildGraphCsv(result.graph);
        await this.saveToFile('graph.csv', graphCsv);
        break;
      }
      case 'markdown': {
        const markdownExport = this.buildMarkdownExport(result);
        await this.saveToFile('papyr-data.md', markdownExport);
        break;
      }
      case 'yaml': {
        const serializedSearchIndex = await exportSearchIndex(result.searchIndex);
        const combinedData = {
          notes: result.notes,
          graph: this.serializeForJSON(result.graph),
          searchIndex: serializedSearchIndex,
          analytics: result.analytics,
          buildInfo: result.buildInfo,
          folderHierarchy: this.serializeFolderHierarchy(result.folderHierarchy)
        };
        const yamlExport = this.serializeToYaml(combinedData);
        await this.saveToFile('papyr-data.yaml', yamlExport);
        break;
      }
      default:
        console.warn(`⚠️  Unsupported export format: ${format}`);
        break;
    }
  }

  /**
   * Serialize complex objects for JSON output
   */
  private serializeForJSON(obj: any, seen: WeakSet<object> = new WeakSet()): any {
    if (obj && typeof obj === 'object') {
      if (seen.has(obj)) {
        return undefined;
      }
      seen.add(obj);

      if (obj instanceof Map) {
        return Object.fromEntries(
          Array.from(obj.entries()).map(([key, value]) => [key, this.serializeForJSON(value, seen)])
        );
      }

      if (obj instanceof Set) {
        return Array.from(obj).map(value => this.serializeForJSON(value, seen));
      }

      if (Array.isArray(obj)) {
        return obj.map(value => this.serializeForJSON(value, seen));
      }

      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const serialized = this.serializeForJSON(value, seen);
        if (serialized !== undefined) {
          result[key] = serialized;
        }
      }
      return result;
    }

    return obj;
  }

  private serializeFolderHierarchy(root: FolderNode): any {
    const seen = new WeakSet<FolderNode>();

    const serializeNode = (node: FolderNode): any => {
      if (seen.has(node)) {
        return undefined;
      }
      seen.add(node);

      return {
        name: node.name,
        path: node.path,
        depth: node.depth,
        notes: [...node.notes],
        children: node.children
          .map(child => serializeNode(child))
          .filter((child): child is NonNullable<typeof child> => child !== undefined)
      };
    };

    return serializeNode(root);
  }

  private resolvePackageVersion(): string {
    if (typeof process === 'undefined' || !process.versions?.node) {
      return 'unknown';
    }

    try {
      const packageUrl = new URL('../package.json', import.meta.url);
      const raw = fs.readFileSync(packageUrl, 'utf-8');
      const parsed = JSON.parse(raw) as { version?: string };
      if (parsed.version && typeof parsed.version === 'string') {
        return parsed.version.trim() || 'unknown';
      }
    } catch (error) {
      console.warn('⚠️  Could not resolve package version:', error);
    }

    return 'unknown';
  }

  private buildNotesCsv(notes: WebReadyNote[]): string {
    const headers = [
      'slug',
      'title',
      'description',
      'excerpt',
      'tags',
      'keywords',
      'links_to',
      'embeds',
      'created_at',
      'updated_at',
      'word_count',
      'reading_time'
    ];

    const rows = notes.map(note => [
      note.slug,
      note.title,
      note.description ?? '',
      note.excerpt ?? '',
      (note.tags ?? []).join('|'),
      (note.keywords ?? []).join('|'),
      (note.linksTo ?? []).join('|'),
      (note.embeds ?? []).join('|'),
      note.createdAt ?? '',
      note.updatedAt ?? '',
      note.wordCount ?? '',
      note.readingTime ?? ''
    ]);

    const lines = [
      headers.map(value => this.escapeCsvValue(value)).join(','),
      ...rows.map(row => row.map(value => this.escapeCsvValue(value)).join(','))
    ];

    return lines.join('\n');
  }

  private buildGraphCsv(graph: NoteGraph): string {
    const headers = ['source', 'target', 'label'];
    const rows = graph.edges.map(edge => [
      edge.source,
      edge.target,
      edge.label ?? ''
    ]);

    const lines = [
      headers.map(value => this.escapeCsvValue(value)).join(','),
      ...rows.map(row => row.map(value => this.escapeCsvValue(value)).join(','))
    ];

    return lines.join('\n');
  }

  private escapeCsvValue(value: unknown): string {
    const stringValue = String(value ?? '');
    if (/[",\n\r]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private buildMarkdownExport(result: BuildResult): string {
    const lines: string[] = [];

    lines.push('# Papyr Export');
    lines.push('');
    lines.push(`Generated: ${result.buildInfo.timestamp}`);
    lines.push(`Version: ${result.buildInfo.version}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`- Notes: ${result.notes.length}`);
    lines.push(`- Links: ${result.graph.edges.length}`);
    lines.push(`- Orphaned notes: ${result.analytics.basic.orphanedNotes}`);
    lines.push(`- Build time: ${result.buildInfo.duration}ms`);
    lines.push('');
    lines.push('## Notes');

    if (!result.notes.length) {
      lines.push('');
      lines.push('_No notes available._');
      return lines.join('\n');
    }

    result.notes.forEach(note => {
      const title = note.title || note.slug;
      const details: string[] = [];
      if (note.description) {
        details.push(note.description);
      }
      if (note.tags?.length) {
        details.push(`Tags: ${note.tags.join(', ')}`);
      }
      const detailText = details.length ? ` — ${details.join(' · ')}` : '';
      lines.push(`- **${title}** (\`${note.slug}\`)${detailText}`);
    });

    return lines.join('\n');
  }

  private serializeToYaml(value: unknown, indent = 0): string {
    const pad = ' '.repeat(indent);
    const isScalar = (input: unknown): boolean =>
      input === null ||
      input === undefined ||
      typeof input === 'string' ||
      typeof input === 'number' ||
      typeof input === 'boolean';

    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'string') {
      return JSON.stringify(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]';
      }
      return value
        .map(item => {
          const rendered = this.serializeToYaml(item, indent + 2);
          if (isScalar(item)) {
            return `${pad}- ${rendered}`;
          }
          return `${pad}-\n${rendered}`;
        })
        .join('\n');
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        return '{}';
      }
      return entries
        .map(([key, entryValue]) => {
          const rendered = this.serializeToYaml(entryValue, indent + 2);
          if (isScalar(entryValue)) {
            return `${pad}${key}: ${rendered}`;
          }
          return `${pad}${key}:\n${rendered}`;
        })
        .join('\n');
    }

    return JSON.stringify(value);
  }

  /**
   * Save data to file with logging
   */
  private async saveToFile(filename: string, data: any): Promise<void> {
    const filePath = path.join(this.config.outputDir, filename);
    const serializedData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    
    await fs.promises.writeFile(filePath, serializedData, 'utf-8');
    
    const stats = await fs.promises.stat(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`💾 Saved ${filename} (${sizeKB}KB)`);
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }
}
