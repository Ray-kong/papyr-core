import { ParsedNote, ParseOptions, WebReadyNote } from './types'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkWikiLink from 'remark-wiki-link'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeHighlight from 'rehype-highlight'
import slugify from 'slugify'
import crypto from 'node:crypto'

export async function parseMarkdown(md: string, options: ParseOptions = {}): Promise<ParsedNote> {
  // 1. Extract frontmatter using gray-matter with error handling
  let content = md
  let metadata: Record<string, any> = {}
  
  try {
    const parsed = matter(md)
    content = parsed.content
    metadata = parsed.data
  } catch (error) {
    // If frontmatter parsing fails, treat the entire content as markdown
    content = md
    metadata = {}
  }
  
  // 2. Create a set to collect wiki links
  const linksTo = new Set<string>()
  
  // 3. Parse markdown with remark → rehype pipeline
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikiLink, {
      pageResolver: (name: string) => {
        // Remove hash fragments and normalize the wiki link to a slug format
        const cleanName = name.split('#')[0]
        return [slugify(cleanName, { lower: true, strict: true })]
      },
      hrefTemplate: (permalink: string) => {
        // Keep full permalink for hrefs but collect only page part for linksTo
        const cleanPermalink = permalink.split('#')[0]
        if (cleanPermalink) {
          linksTo.add(cleanPermalink)
        }
        // Return the href format with full permalink (including hash fragments)
        return `#/note/${permalink}`
      }
    })
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeStringify)
  
  // Process the markdown content
  const result = await processor.process(content)
  const html = String(result)
  
  // 4. Generate slug from path or metadata
  let slug = ''
  if (options.path) {
    // Derive slug from filename (without extension)
    // Remove file extension and convert to slug
    const filename = options.path.split('/').pop() || options.path
    const basename = filename.replace(/\.(md|markdown)$/i, '')
    slug = slugify(basename, { lower: true, strict: true })
  } else if (metadata.slug) {
    // Use slug from frontmatter if available
    slug = slugify(String(metadata.slug), { lower: true, strict: true })
  } else if (metadata.title) {
    // Generate slug from title
    slug = slugify(String(metadata.title), { lower: true, strict: true })
  } else {
    // Try to extract title from first heading in content
    const titleMatch = content.match(/^#\s+(.+)$/m)
    if (titleMatch) {
      slug = slugify(titleMatch[1], { lower: true, strict: true })
    } else if (md.trim()) {
      // Fallback: generate deterministic slug from content hash
      const hash = crypto.createHash('md5').update(md.trim()).digest('hex')
      slug = `untitled-${hash.slice(0, 8)}`
    }
  }
  
  // 5. Normalize metadata (convert Date objects to strings)
  const normalizedMetadata: Record<string, any> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (value instanceof Date) {
      normalizedMetadata[key] = value.toISOString().split('T')[0] // YYYY-MM-DD format
    } else {
      normalizedMetadata[key] = value
    }
  }
  
  // 6. Generate excerpt from first paragraph
  const excerptMatch = content.match(/^(?:[^\n]*\n)*?([^\n#].+?)(?:\n\n|$)/m)
  const excerpt = excerptMatch ? excerptMatch[1].replace(/\[\[.*?\]\]/g, '').trim() : ''
  
  // 7. Return the parsed note
  return {
    slug,
    html,
    metadata: normalizedMetadata,
    linksTo: Array.from(linksTo).filter(link => link.length > 0),
    raw: md,
    excerpt: excerpt || undefined
  }
}

/**
 * Convert a ParsedNote to a WebReadyNote with additional web-specific fields
 */
export function toWebReadyNote(note: ParsedNote): WebReadyNote {
  // Calculate word count from raw content or HTML
  const textContent = note.raw || note.html.replace(/<[^>]*>/g, '')
  const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length
  
  // Estimate reading time (average reading speed: 200-250 words per minute)
  const readingTime = Math.ceil(wordCount / 225)
  
  // Extract tags from metadata
  const tags = note.metadata?.tags || []
  const normalizedTags = Array.isArray(tags) ? tags : [tags].filter(Boolean)
  
  // Generate title from metadata or slug
  const title = note.metadata?.title || note.slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  
  // Generate description from excerpt or first paragraph
  const description = note.excerpt || note.metadata?.description || 
    textContent.substring(0, 160).replace(/\n/g, ' ').trim()
  
  // Extract keywords from tags and metadata
  const keywords = [
    ...normalizedTags,
    ...(note.metadata?.keywords || []),
    ...(note.metadata?.categories || [])
  ].filter(Boolean)
  
  return {
    slug: note.slug,
    html: note.html,
    metadata: note.metadata,
    linksTo: note.linksTo,
    excerpt: note.excerpt,
    title,
    tags: normalizedTags,
    createdAt: note.metadata?.createdAt || note.metadata?.date || note.metadata?.created,
    updatedAt: note.metadata?.updatedAt || note.metadata?.modified || note.metadata?.lastModified,
    readingTime,
    wordCount,
    description,
    keywords,
    ogImage: note.metadata?.ogImage || note.metadata?.image || note.metadata?.cover
  }
}
