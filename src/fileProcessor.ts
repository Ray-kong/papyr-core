import { ParsedNote, WebReadyNote } from './types'
import { parseMarkdown, toWebReadyNote } from './parseMarkdown'

export interface ProcessedFile {
  filePath: string
  relativePath: string
  note: ParsedNote
}

export interface WebReadyFile {
  filePath: string
  relativePath: string
  note: WebReadyNote
}

export interface ProcessingResult {
  files: ProcessedFile[]
  errors: Array<{ filePath: string; error: Error }>
  statistics: {
    totalFiles: number
    totalErrors: number
    processingTime: number
  }
}

export interface WebReadyResult {
  files: WebReadyFile[]
  errors: Array<{ filePath: string; error: Error }>
  statistics: {
    totalFiles: number
    totalErrors: number
    processingTime: number
  }
}

/**
 * Process a markdown file content (no file system access)
 */
export async function processMarkdownContent(
  content: string, 
  filePath: string, 
  baseDir: string
): Promise<ProcessedFile> {
  const note = await parseMarkdown(content, { path: filePath })
  const relativePath = filePath.replace(baseDir, '').replace(/^\//, '')
  
  return {
    filePath,
    relativePath,
    note
  }
}

/**
 * Process markdown content and convert to web-ready format
 */
export async function processMarkdownContentToWeb(
  content: string, 
  filePath: string, 
  baseDir: string
): Promise<WebReadyFile> {
  const note = await parseMarkdown(content, { path: filePath })
  const webReadyNote = toWebReadyNote(note)
  const relativePath = filePath.replace(baseDir, '').replace(/^\//, '')
  
  return {
    filePath,
    relativePath,
    note: webReadyNote
  }
}

/**
 * Process multiple markdown contents (no file system access)
 */
export async function processMarkdownContents(
  contents: Array<{ content: string; filePath: string; baseDir: string }>
): Promise<ProcessingResult> {
  const startTime = Date.now()
  const files: ProcessedFile[] = []
  const errors: Array<{ filePath: string; error: Error }> = []
  
  for (const { content, filePath, baseDir } of contents) {
    try {
      const processed = await processMarkdownContent(content, filePath, baseDir)
      files.push(processed)
    } catch (error) {
      errors.push({
        filePath,
        error: error instanceof Error ? error : new Error(String(error))
      })
    }
  }
  
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  
  const processingTime = Date.now() - startTime
  
  return { 
    files, 
    errors,
    statistics: {
      totalFiles: files.length,
      totalErrors: errors.length,
      processingTime
    }
  }
}

/**
 * Process multiple markdown contents and convert to web-ready format
 */
export async function processMarkdownContentsToWeb(
  contents: Array<{ content: string; filePath: string; baseDir: string }>
): Promise<WebReadyResult> {
  const startTime = Date.now()
  const files: WebReadyFile[] = []
  const errors: Array<{ filePath: string; error: Error }> = []
  
  for (const { content, filePath, baseDir } of contents) {
    try {
      const processed = await processMarkdownContentToWeb(content, filePath, baseDir)
      files.push(processed)
    } catch (error) {
      errors.push({
        filePath,
        error: error instanceof Error ? error : new Error(String(error))
      })
    }
  }
  
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  
  const processingTime = Date.now() - startTime
  
  return { 
    files, 
    errors,
    statistics: {
      totalFiles: files.length,
      totalErrors: errors.length,
      processingTime
    }
  }
}