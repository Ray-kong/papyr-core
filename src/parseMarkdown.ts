import { ParsedNote, ParseOptions, WebReadyNote, Slug, Frontmatter, Heading, CodeBlock } from './types'
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
  const collectedCodeBlocks: CodeBlock[] = []
  const selfAnchorPlaceholders = new Map<string, string>()
  const referenceDefinitions = new Map<string, string>()
  const collectedEmbeds: string[] = []
  const embedLookup = new Set<string>()

  const normalizeHeadingKey = (value: string): string => value.trim().toLowerCase()

  const resolveAnchorSlug = (
    anchorText: string,
    options: { allowHeadingFallback?: boolean } = {}
  ): string => {
    const { allowHeadingFallback = false } = options
    const trimmed = anchorText.trim()
    if (!trimmed) {
      return ''
    }

    const slugified = slugify(trimmed, { lower: true, strict: true })
    if (slugified) {
      return slugified
    }

    if (allowHeadingFallback) {
      const normalizedAnchor = normalizeHeadingKey(trimmed)
      const matchingHeading = collectedHeadings.find(
        heading => normalizeHeadingKey(heading.text) === normalizedAnchor
      )

      if (matchingHeading) {
        return matchingHeading.slug
      }

      return ''
    }

    return ''
  }

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

  const collectCodeBlocksPlugin = () => (tree: unknown) => {
    visit(tree as any, 'code', (node: any) => {
      if (!node || typeof node.value !== 'string') {
        return
      }

      collectedCodeBlocks.push({
        language: typeof node.lang === 'string' ? node.lang : null,
        meta: typeof node.meta === 'string' ? node.meta : null,
        value: node.value
      })
    })
  }

  const collectMarkdownLinksPlugin = () => (tree: unknown) => {
    referenceDefinitions.clear()

    visit(tree as any, 'definition', (node: any) => {
      if (
        !node ||
        typeof node.identifier !== 'string' ||
        typeof node.url !== 'string'
      ) {
        return
      }
      const identifier = node.identifier.toLowerCase()
      if (!referenceDefinitions.has(identifier)) {
        referenceDefinitions.set(identifier, node.url)
      }
    })

    visit(tree as any, 'link', (node: any) => {
      if (!node || typeof node.url !== 'string') {
        return
      }

      const slug = extractNoteSlugFromLink(node.url)
      if (slug) {
        linksTo.add(slug)
      }
    })

    visit(tree as any, 'linkReference', (node: any) => {
      if (!node || typeof node.identifier !== 'string') {
        return
      }

      const identifier = node.identifier.toLowerCase()
      const url = referenceDefinitions.get(identifier)
      if (!url) {
        return
      }

      const slug = extractNoteSlugFromLink(url)
      if (slug) {
        linksTo.add(slug)
      }
    })
  }

  const addEmbedSlug = (slug: string): void => {
    if (!slug || embedLookup.has(slug)) {
      return
    }

    embedLookup.add(slug)
    collectedEmbeds.push(slug)
  }

  const collectEmbedsPlugin = () => (tree: unknown) => {
    visit(tree as any, 'text', (node: any, _index?: number, parent?: any) => {
      if (!node || typeof node.value !== 'string') {
        return
      }

      if (parent?.type === 'code' || parent?.type === 'inlineCode') {
        return
      }

      const value = node.value as string
      if (!value.includes('![[')) {
        return
      }

      const embedPattern = /!\[\[([^\]]+?)\]\]/g
      let match: RegExpExecArray | null

      while ((match = embedPattern.exec(value)) !== null) {
        const rawTarget = match[1]
        const slug = extractEmbedSlug(rawTarget)
        if (slug) {
          addEmbedSlug(slug)
        }
      }
    })
  }

  const SELF_ANCHOR_PREFIX = '__papyr_self_anchor__#'
  const SELF_ANCHOR_LINK_PREFIX = '#__papyr_anchor__'

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(collectHeadingsPlugin)
    .use(collectCodeBlocksPlugin)
    .use(collectMarkdownLinksPlugin)
    .use(collectEmbedsPlugin)
    .use(remarkWikiLink, {
      aliasDivider: '|',
      pageResolver: (name: string) => {
        const rawName = name.trim()
        if (!rawName) {
          return []
        }

        if (rawName.startsWith('#')) {
          let anchorText = rawName
          while (anchorText.startsWith('#')) {
            anchorText = anchorText.slice(1)
          }
          anchorText = anchorText.trim()
          if (!anchorText) {
            return []
          }

          const placeholderId = `self-${selfAnchorPlaceholders.size}`
          selfAnchorPlaceholders.set(placeholderId, anchorText)
          return [`${SELF_ANCHOR_PREFIX}${placeholderId}`]
        }

        const hashIndex = rawName.indexOf('#')
        const notePart = hashIndex >= 0 ? rawName.slice(0, hashIndex) : rawName
        const anchorPart = hashIndex >= 0 ? rawName.slice(hashIndex + 1) : ''

        const segments = notePart
          .replace(/\\/g, '/')
          .split('/')
          .map(segment => segment.trim())
          .filter(Boolean)

        const target = segments.length > 0 ? segments[segments.length - 1] : notePart.trim()
        if (!target) {
          return []
        }

        const noteSlug = slugify(target, { lower: true, strict: true })
        const anchorValue = anchorPart.trim()
        const anchorSlug = anchorValue ? resolveAnchorSlug(anchorValue) : ''

        const combined = anchorSlug ? `${noteSlug}#${anchorSlug}` : noteSlug
        return [combined]
      },
      hrefTemplate: (permalink: string) => {
        if (permalink.startsWith(SELF_ANCHOR_PREFIX)) {
          const placeholderId = permalink.slice(SELF_ANCHOR_PREFIX.length)
          return `${SELF_ANCHOR_LINK_PREFIX}${placeholderId}`
        }

        const [noteSlug, anchorSlug] = permalink.split('#')
        if (noteSlug) {
          linksTo.add(noteSlug)
          return anchorSlug ? `#/note/${noteSlug}#${anchorSlug}` : `#/note/${noteSlug}`
        }

        return '#'
      }
    })
    .use(remarkRehype)
    .use(() => (tree: unknown) => {
      visit(tree as any, 'element', (node: any) => {
        if (!node || node.tagName !== 'a' || !node.properties) {
          return
        }

        const href = node.properties.href
        if (typeof href !== 'string' || !href.startsWith(SELF_ANCHOR_LINK_PREFIX)) {
          return
        }

        const placeholderId = href.slice(SELF_ANCHOR_LINK_PREFIX.length)
        const anchorText = selfAnchorPlaceholders.get(placeholderId)
        if (!anchorText) {
          node.properties.href = '#'
          return
        }

        const anchorSlug = resolveAnchorSlug(anchorText, { allowHeadingFallback: true })
        node.properties.href = anchorSlug ? `#${anchorSlug}` : '#'
      })
    })
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
    codeBlocks: collectedCodeBlocks,
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
    ...note,
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

function extractEmbedSlug(rawTarget: string): string | null {
  if (typeof rawTarget !== 'string') {
    return null
  }

  const trimmed = rawTarget.trim()
  if (!trimmed) {
    return null
  }

  const aliasDividerIndex = trimmed.indexOf('|')
  const aliasFree = (aliasDividerIndex >= 0 ? trimmed.slice(0, aliasDividerIndex) : trimmed).trim()
  if (!aliasFree || aliasFree.startsWith('#')) {
    return null
  }

  const anchorIndex = aliasFree.search(/[#^]/)
  const notePart = anchorIndex >= 0 ? aliasFree.slice(0, anchorIndex) : aliasFree
  const normalized = notePart.replace(/\\/g, '/')
  const segments = normalized
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)

  const target = segments.length > 0 ? segments[segments.length - 1] : notePart.trim()
  if (!target) {
    return null
  }

  const slug = slugify(target, { lower: true, strict: true })
  return slug || null
}

function extractNoteSlugFromLink(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed || trimmed.startsWith('#')) {
    return null
  }

  const lowerUrl = trimmed.toLowerCase()
  const hasScheme = /^[a-z][a-z0-9+.-]*:/.test(trimmed)

  if (hasScheme && !lowerUrl.startsWith('obsidian://')) {
    return null
  }

  if (lowerUrl.startsWith('obsidian://')) {
    try {
      const obsidianUrl = new URL(trimmed)
      const fileParam =
        obsidianUrl.searchParams.get('file') ??
        obsidianUrl.searchParams.get('path')
      if (!fileParam) {
        return null
      }

      const decodedPath = decodePathSegment(fileParam)
      const segments = decodedPath.replace(/\\/g, '/').split('/').filter(Boolean)
      const lastSegment = segments[segments.length - 1]
      if (!lastSegment) {
        return null
      }

      const sanitized = sanitizeLinkSegment(lastSegment)
      if (!sanitized) {
        return null
      }

      const slug = slugify(sanitized, { lower: true, strict: true })
      return slug || null
    } catch {
      return null
    }
  }

  const withoutQuery = trimmed.split('?')[0]
  const pathPart = withoutQuery.split('#')[0]
  const normalized = pathPart
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')

  if (!normalized) {
    return null
  }

  const segments = normalized
    .split('/')
    .map(seg => seg.trim())
    .filter(seg => seg.length > 0 && seg !== '.')

  if (segments.length === 0) {
    return null
  }

  const lastSegment = segments[segments.length - 1]
  if (lastSegment === '..') {
    return null
  }

  const decodedSegment = decodePathSegment(lastSegment)
  const sanitized = sanitizeLinkSegment(decodedSegment)
  if (!sanitized) {
    return null
  }

  const slug = slugify(sanitized, { lower: true, strict: true })
  return slug || null
}

function sanitizeLinkSegment(segment: string): string {
  const trimmed = segment.trim()
  if (!trimmed) {
    return ''
  }

  const extensionMatch = trimmed.match(/\.([^.]+)$/)
  if (extensionMatch) {
    const extension = extensionMatch[1]
    if (!/^(md|markdown)$/i.test(extension)) {
      return ''
    }
    return trimmed.slice(0, -extensionMatch[0].length)
  }

  return trimmed
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
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
