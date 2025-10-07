import * as fs from 'fs';
import * as path from 'path';
import { 
  processMarkdownContentsToWeb,
  buildNoteGraph,
  generateSearchIndex,
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

/**
 * PapyrBuilder - Automated build pipeline for Papyr projects
 * 
 * Handles the complete build process from markdown files to web-ready data,
 * including file discovery, processing, analytics, and output generation.
 */
export class PapyrBuilder {
  private config: BuildConfig;
  private fileWatcher?: fs.FSWatcher;

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

    this.config = {
      ...restConfig,
      patterns: {
        include: mergePatterns(['**/*.md'], patterns?.include),
        exclude: mergePatterns(['node_modules/**', '.git/**'], patterns?.exclude)
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
        buildErrors.push(...webResult.errors.map(err => ({
          file: err.filePath || 'unknown',
          error: err.error.message || 'Unknown error',
          line: undefined,
          column: undefined
        })));
      }

      // Build note graph
      console.log('🕸️  Building note graph...');
      const graph = buildNoteGraph(notes);

      // Generate search index
      console.log('🔍 Generating search index...');
      const searchIndex = generateSearchIndex(notes);

      // Calculate analytics
      console.log('📊 Calculating analytics...');
      const analytics = this.calculateAnalytics(notes, graph);

      analytics.basic.buildTime = buildTime;

      const buildTime = Date.now() - startTime;

      // Create build info
      const buildInfo: BuildInfo = {
        timestamp: new Date().toISOString(),
        duration: buildTime,
        version: '1.0.0', // TODO: Get from package.json
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
        buildInfo
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
          
          // Check exclusion patterns first
          if (this.shouldExcludeFile(relativePath)) {
            console.log(`⚠️  Excluding: ${relativePath}`);
            continue;
          }
          
          if (entry.isDirectory()) {
            // Recursively walk subdirectories
            await walkDirectory(fullPath);
          } else if (entry.isFile()) {
            // Check if file should be included
            if (this.shouldIncludeFile(relativePath)) {
              try {
                const content = await fs.promises.readFile(fullPath, 'utf-8');
                const stats = await fs.promises.stat(fullPath);
                
                console.log(`✅ Including: ${relativePath}`);
                files.push({
                  content,
                  filePath: relativePath,
                  relativePath,
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
              console.log(`ℹ️  Skipping: ${relativePath} (pattern mismatch)`);
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
    const patterns = this.config.patterns?.include || ['**/*.md'];
    return patterns.some(pattern => this.matchesPattern(filePath, pattern));
  }

  /**
   * Check if a file should be excluded based on exclusion patterns
   */
  private shouldExcludeFile(filePath: string): boolean {
    const patterns = this.config.patterns?.exclude || [];
    return patterns.some(pattern => this.matchesPattern(filePath, pattern));
  }

  /**
   * Simple glob pattern matching
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Special handling for common patterns
    if (pattern === '**/*.md') {
      // This should match any .md file at any level (including root)
      return filePath.endsWith('.md');
    }
    
    // Convert glob pattern to regex
    // Handle ** (matches any number of directories including zero)
    // Handle * (matches any characters except path separator)
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    const regex = new RegExp(`^${regexPattern}$`);
    const matches = regex.test(filePath);
    
    console.log(`🔍 Pattern match: "${filePath}" vs "${pattern}" -> ${matches ? '✅' : '❌'} (regex: ${regexPattern})`);
    return matches;
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

    if (separateFiles) {
      // Output as separate files
      await this.saveToFile('notes.json', result.notes);
      await this.saveToFile('graph.json', this.serializeForJSON(result.graph));
      await this.saveToFile('search-index.json', this.serializeForJSON(result.searchIndex));
      await this.saveToFile('analytics.json', result.analytics);
      await this.saveToFile('build-info.json', result.buildInfo);
    }

    // Always create combined data file
    const combinedData = {
      notes: result.notes,
      graph: this.serializeForJSON(result.graph),
      searchIndex: this.serializeForJSON(result.searchIndex),
      analytics: result.analytics,
      buildInfo: result.buildInfo
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
    // TODO: Implement additional export formats
    switch (format) {
      case 'csv':
        // Implement CSV export
        break;
      case 'markdown':
        // Implement Markdown export
        break;
      case 'yaml':
        // Implement YAML export
        break;
    }
  }

  /**
   * Serialize complex objects for JSON output
   */
  private serializeForJSON(obj: any): any {
    if (obj instanceof Map) {
      return Object.fromEntries(
        Array.from(obj.entries()).map(([key, value]) => [key, this.serializeForJSON(value)])
      );
    } else if (obj instanceof Set) {
      return Array.from(obj).map(value => this.serializeForJSON(value));
    } else if (obj && typeof obj === 'object') {
      const result: any = Array.isArray(obj) ? [] : {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.serializeForJSON(value);
      }
      return result;
    }
    return obj;
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
