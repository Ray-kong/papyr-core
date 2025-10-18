import { ParsedNote, ParseOptions, WebReadyNote, Slug, Frontmatter, Heading } from './types'
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
import { visit } from 'unist-util-visit'

export async function parseMarkdown(md: string, options: ParseOptions = {}): Promise<ParsedNote> {
  // 1. Extract frontmatter using gray-matter with error handling
  let content = md
  let metadata: Record<string, unknown> = {}
  
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
  const collectedHeadings: Heading[] = []
  const headingSlugCounts = new Map<string, number>()

  const collectHeadingsPlugin = () => (tree: unknown) => {
    visit(tree as any, 'heading', (node: any) => {
      if (!node || typeof node.depth !== 'number') {
        return
      }

      const depth = Math.min(Math.max(node.depth, 1), 6) as Heading['level']
      const text = extractHeadingText(node).trim()
      if (!text) {
        return
      }

      let baseSlug = slugify(text, { lower: true, strict: true })
      if (!baseSlug) {
        baseSlug = `heading-${collectedHeadings.length + 1}`
      }

      const existing = headingSlugCounts.get(baseSlug) ?? 0
      headingSlugCounts.set(baseSlug, existing + 1)
      const finalSlug = existing === 0 ? baseSlug : `${baseSlug}-${existing}`

      if (!node.data) {
        node.data = {}
      }
      if (!node.data.hProperties) {
        node.data.hProperties = {}
      }
      node.data.hProperties.id = finalSlug

      collectedHeadings.push({
        level: depth,
        text,
        slug: finalSlug
      })
    })
  }

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(collectHeadingsPlugin)
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
  const normalizedMetadata: Frontmatter = {}
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

  const filteredLinks = Array.from(linksTo).filter(link => link.length > 0)
  const collectedEmbeds: string[] = []
  
  // Ensure the slug is a string before branding it
  if (typeof slug !== 'string') {
    throw new TypeError('Generated slug must be a string')
  }
  const typedSlug = slug as Slug

  // 7. Return the parsed note
  return {
    slug: typedSlug,
    html,
    metadata: normalizedMetadata,
    linksTo: filteredLinks,
    embeds: collectedEmbeds,
    headings: collectedHeadings,
    raw: md,
    excerpt: excerpt || undefined
  }
}

/**
 * Convert a ParsedNote to a WebReadyNote with additional web-specific fields
 */
export function toWebReadyNote(note: ParsedNote): WebReadyNote {
  const textContent = note.raw || note.html.replace(/<[^>]*>/g, '')
  const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length
  const readingTime = Math.ceil(wordCount / 225)

  const metadata = note.metadata ?? {}
  const metadataRecord = metadata as Record<string, unknown>

  const normalizedTags = normalizeStringArray(metadata.tags)
  const metadataKeywords = normalizeStringArray(metadataRecord['keywords'])
  const metadataCategories = normalizeStringArray(metadataRecord['categories'])

  const title = typeof metadata.title === 'string' && metadata.title.length > 0
    ? metadata.title
    : titleFromSlug(note.slug)

  const excerptText = note.excerpt && note.excerpt.length > 0 ? note.excerpt : undefined
  const metadataDescription = firstString(
    metadataRecord['description'],
    metadataRecord['summary']
  )
  const fallbackDescription = textContent.substring(0, 160).replace(/\n/g, ' ').trim()
  const description = metadataDescription ?? excerptText ?? fallbackDescription

  const keywordSet = new Set<string>([
    ...normalizedTags,
    ...metadataKeywords,
    ...metadataCategories
  ].filter(tag => tag.length > 0))

  const createdAt = firstString(
    metadataRecord['createdAt'],
    metadataRecord['date'],
    metadata.created
  )

  const updatedAt = firstString(
    metadataRecord['updatedAt'],
    metadataRecord['modified'],
    metadataRecord['lastModified'],
    metadata.updated
  )

  const ogImage = firstString(
    metadataRecord['ogImage'],
    metadataRecord['image'],
    metadataRecord['cover']
  )

  return {
    slug: note.slug,
    html: note.html,
    metadata: note.metadata,
    linksTo: note.linksTo,
    embeds: note.embeds,
    headings: note.headings,
    excerpt: note.excerpt,
    title,
    tags: normalizedTags,
    createdAt,
    updatedAt,
    readingTime,
    wordCount,
    description,
    keywords: Array.from(keywordSet),
    ogImage
  }
}

function extractHeadingText(node: any): string {
  if (!node) {
    return ''
  }

  if (typeof node.value === 'string') {
    return node.value
  }

  if (Array.isArray(node.children)) {
    return node.children
      .map((child: any) => extractHeadingText(child))
      .join('')
  }

  return ''
}

function normalizeStringArray(value: unknown): string[] {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item : String(item ?? '')).trim())
      .filter(item => item.length > 0)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? [trimmed] : []
  }

  return []
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }
  return undefined
}

function titleFromSlug(slug: Slug): string {
  return String(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}
