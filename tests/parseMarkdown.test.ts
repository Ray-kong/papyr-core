import { describe, it, expect } from 'vitest'
import { parseMarkdown, toWebReadyNote } from '../src/parseMarkdown'
import { Slug } from '../src/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('parseMarkdown', () => {
  const mockDir = join(__dirname, 'mocks')

  describe('Basic parsing', () => {
    it('should parse simple markdown with frontmatter', async () => {
      const content = readFileSync(join(mockDir, 'simple-note.md'), 'utf-8')
      const result = await parseMarkdown(content)

      expect(result.slug).toBe('simple-note')
      expect(result.metadata).toEqual({
        title: 'Simple Note',
        date: '2024-01-01',
        tags: ['test', 'simple']
      })
      expect(result.html).toContain('<h1 id="simple-note">Simple Note</h1>')
      expect(result.html).toContain('<h2 id="features">Features</h2>')
      expect(result.html).toContain('<ul>')
      expect(result.linksTo).toEqual([])
    })

    it('should parse markdown without frontmatter', async () => {
      const content = readFileSync(join(mockDir, 'no-frontmatter.md'), 'utf-8')
      const result = await parseMarkdown(content)

      expect(result.slug).toBe('no-frontmatter-note')
      expect(result.metadata).toEqual({})
      expect(result.html).toContain('<h1 id="no-frontmatter-note">No Frontmatter Note</h1>')
      expect(result.linksTo).toEqual(['a-wiki-link'])
    })
  })

  describe('Wiki links', () => {
    it('should extract wiki links correctly', async () => {
      const content = readFileSync(join(mockDir, 'wiki-links-note.md'), 'utf-8')
      const result = await parseMarkdown(content)

      expect(result.slug).toBe('wiki-links-note')
      expect(result.linksTo).toEqual([
        'wiki-links',
        'getting-started',
        'advanced-features',
        'api-reference'
      ])
      expect(result.html).toContain('href="#/note/getting-started"')
      expect(result.html).toContain('href="#/note/advanced-features"')
      expect(result.html).toContain('href="#/note/api-reference"')
    })

    it('should support wiki link aliases using pipe syntax', async () => {
      const content = `
Link to [[Target Page|Kickoff Notes]] and [[areas/Productivity Systems|Productivity Overview]].
`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'target-page',
        'productivity-systems'
      ])
      expect(result.html).toContain('href="#/note/target-page"')
      expect(result.html).toContain('>Kickoff Notes<')
      expect(result.html).toContain('href="#/note/productivity-systems"')
    })

    it('should keep alias text separate from nested path slugs', async () => {
      const content = `
Link to [[Areas/Deep Work/Focus Ritual|Deep Focus Ritual]] and [[projects/papyr launch|Launch Plan Overview]].
`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'focus-ritual',
        'papyr-launch'
      ])
      expect(result.html).toContain('href="#/note/focus-ritual"')
      expect(result.html).toContain('>Deep Focus Ritual<')
      expect(result.html).toContain('href="#/note/papyr-launch"')
      expect(result.html).toContain('>Launch Plan Overview<')
    })

    it('should properly resolve aliases that include heading fragments', async () => {
      const content = `
Reference [[Reference Guide#Deep Dive|Installation Deep Dive]] and [[API Reference#Authentication|Auth Callouts]].
`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'reference-guide',
        'api-reference'
      ])
      expect(result.html).toContain('href="#/note/reference-guide#deep-dive"')
      expect(result.html).toContain('>Installation Deep Dive<')
      expect(result.html).toContain('href="#/note/api-reference#authentication"')
      expect(result.html).toContain('>Auth Callouts<')
    })

    it('should handle wiki links with special characters', async () => {
      const content = `---
title: Special Characters
---

This has [[Special Characters]] and [[Multiple Words]] in links.`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'special-characters',
        'multiple-words'
      ])
    })

    it('should handle wiki links with hash fragments', async () => {
      const content = `---
title: Hash Links
---

Reference [[Getting Started#Installation]] and [[API#Methods]].`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'getting-started',
        'api'
      ])
    })

    it('should resolve folder-qualified wiki links to the note slug', async () => {
      const content = `---
title: Folder Links
---

Link to [[areas/Productivity Systems]] and [[projects/papyr-roadmap]].`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'productivity-systems',
        'papyr-roadmap'
      ])
      expect(result.html).toContain('href="#/note/productivity-systems"')
      expect(result.html).toContain('href="#/note/papyr-roadmap"')
    })

    it('should handle same-note heading anchors', async () => {
      const content = `---
title: Anchors
---

See [[#Local Section]] for details.

## Local Section

Content here.`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([])
      expect(result.html).toContain('href="#local-section"')
    })

    it('should handle cross-note heading anchors', async () => {
      const content = `---
title: Cross Anchors
---

Refer to [[Reference Guide#Deep Dive]].`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual(['reference-guide'])
      expect(result.html).toContain('href="#/note/reference-guide#deep-dive"')
    })
  })

  describe('Markdown links', () => {
    it('should extract relative markdown links that reference other notes', async () => {
      const content = `
[Install guide](Download%20and%20install%20Obsidian.md)
[Sync tips](./sync-your-notes-across-devices.md#mobile)
[Credits reference](../credits.md)
[Ignore assets](images/cover.png)
`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'download-and-install-obsidian',
        'sync-your-notes-across-devices',
        'credits'
      ])
    })

    it('should capture Obsidian protocol links with file parameters', async () => {
      const content = `
[Publish intro](obsidian://open?vault=Help&file=Introduction%20to%20Obsidian%20Publish)
[Sync intro](obsidian://open?vault=Help&path=Introduction%20to%20Obsidian%20Sync.md)
`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'introduction-to-obsidian-publish',
        'introduction-to-obsidian-sync'
      ])
    })

    it('should ignore pure anchor or external markdown links', async () => {
      const content = `
[Jump](#section)
[External](https://example.com/docs)
`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([])
    })

    it('should capture reference-style markdown links', async () => {
      const content = `
[Install guide][install]

[install]: ./Download%20and%20install%20Obsidian.md

[Theme reference][theme]

[theme]: themes.md
`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'download-and-install-obsidian',
        'themes'
      ])
    })

    it('should prefer first reference definition when duplicates exist', async () => {
      const content = `
[Install guide][install]

[install]: ./Download%20and%20install%20Obsidian.md
[install]: ./duplicate.md
`

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'download-and-install-obsidian'
      ])
    })
  })

  describe('Slug generation', () => {
    it('should use slug from frontmatter when available', async () => {
      const content = `---
slug: custom-slug
title: Different Title
---

Content here.`

      const result = await parseMarkdown(content)

      expect(result.slug).toBe('custom-slug')
    })

    it('should generate slug from title when no slug in frontmatter', async () => {
      const content = `---
title: My Custom Title
---

Content here.`

      const result = await parseMarkdown(content)

      expect(result.slug).toBe('my-custom-title')
    })

    it('should generate slug from path when provided', async () => {
      const content = `---
title: Different Title
---

Content here.`

      const result = await parseMarkdown(content, { path: '/path/to/my-file.md' })

      expect(result.slug).toBe('my-file')
    })

    it('should prioritize path over frontmatter slug', async () => {
      const content = `---
slug: frontmatter-slug
title: Some Title
---

Content here.`

      const result = await parseMarkdown(content, { path: '/path/to/file-name.md' })

      expect(result.slug).toBe('file-name')
    })

    it('should handle empty slug gracefully', async () => {
      const content = `Content without frontmatter or path.`

      const result = await parseMarkdown(content)

      expect(result.slug).toMatch(/^untitled-[a-f0-9]{8}$/)  // Now generates fallback hash
    })
  })

  describe('Complex content', () => {
    it('should handle complex markdown with multiple features', async () => {
      const content = readFileSync(join(mockDir, 'complex-note.md'), 'utf-8')
      const result = await parseMarkdown(content)

      expect(result.slug).toBe('complex-note')
      expect(result.metadata).toEqual({
        title: 'Complex Note with Multiple Features',
        slug: 'complex-note',
        author: 'Test User',
        tags: ['complex', 'testing', 'features'],
        date: '2024-01-15'
      })
      expect(result.linksTo).toEqual([
        'wiki-links',
        'simple-note',
        'wiki-links-note',
        'api-reference',
        'reference-link'
      ])
      expect(result.html).toContain('<h1 id="complex-note-with-multiple-features">Complex Note with Multiple Features</h1>')
      expect(result.html).toContain('<table>')
      expect(result.html).toContain('<blockquote>')
      expect(result.html).toContain('<strong>bold text</strong>')
      expect(result.html).toContain('<em>italic text</em>')
      expect(result.html).toContain('<code>inline code</code>')
    })
  })

  describe('Code highlighting', () => {
    it('should apply syntax highlighting to code blocks', async () => {
      const content = `---
title: Code Test
---

\`\`\`javascript
function test() {
  return "hello";
}
\`\`\`

\`\`\`python
def test():
    return "hello"
\`\`\``

      const result = await parseMarkdown(content)

      expect(result.html).toContain('class="hljs language-javascript"')
      expect(result.html).toContain('class="hljs language-python"')
    })

    it('should collect code block metadata', async () => {
      const content = `---
title: Code Metadata
---

\`\`\`typescript highlight="2-3"
const value = 42
console.log(value)
\`\`\`

Regular text here.

    console.log('indent')
`

      const result = await parseMarkdown(content)

      expect(result.codeBlocks).toHaveLength(2)
      expect(result.codeBlocks[0]).toMatchObject({
        language: 'typescript',
        meta: 'highlight="2-3"'
      })
      expect(result.codeBlocks[0].value.trim()).toBe(
        'const value = 42\nconsole.log(value)'
      )
      expect(result.codeBlocks[1]).toMatchObject({
        language: null,
        meta: null
      })
      expect(result.codeBlocks[1].value.trim()).toBe(
        "console.log('indent')"
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle empty content', async () => {
      const result = await parseMarkdown('')

      expect(result.slug).toBe('')
      expect(result.html).toBe('')
      expect(result.metadata).toEqual({})
      expect(result.linksTo).toEqual([])
    })

    it('should handle content with only frontmatter', async () => {
      const content = `---
title: Only Frontmatter
---

`

      const result = await parseMarkdown(content)

      expect(result.slug).toBe('only-frontmatter')
      expect(result.metadata).toEqual({ title: 'Only Frontmatter' })
      expect(result.html).toBe('')
      expect(result.linksTo).toEqual([])
    })

    it('should handle malformed frontmatter gracefully', async () => {
      const content = `---
title: Test
invalid: yaml: here
---

Content here.`

      const result = await parseMarkdown(content)

      // Should still parse the content even with malformed frontmatter
      expect(result.html).toContain('Content here')
    })

    it('should handle content with only whitespace', async () => {
      const result = await parseMarkdown('   \n\n  \t  ')

      expect(result.slug).toBe('')
      expect(result.html).toBe('')
      expect(result.metadata).toEqual({})
      expect(result.linksTo).toEqual([])
    })

    it('should handle extremely long content', async () => {
      const longContent = 'a'.repeat(100000)
      const content = `---
title: Long Content
---

# Long Note

${longContent}`

      const result = await parseMarkdown(content)

      expect(result.slug).toBe('long-content')
      expect(result.metadata.title).toBe('Long Content')
      expect(result.html).toContain('<h1 id="long-note">Long Note</h1>')
      expect(result.html).toContain(longContent)
    })

    it('should handle unicode characters in content and links', async () => {
      const content = `---
title: Unicode Test 🦄
---

# Unicode Characters

This has [[Café & Résumé]] and [[漢字]] links.

Content with émojis 🎉 and unicode: αβγδε`

      const result = await parseMarkdown(content)

      expect(result.slug).toBe('unicode-test')  // Emojis stripped by slugify strict mode
      expect(result.linksTo).toContain('cafe-and-resume')  // Unicode normalized by slugify
      // Chinese characters may be filtered out by slugify strict mode
      expect(result.linksTo.length).toBeGreaterThan(0)
      expect(result.html).toContain('émojis 🎉')
      expect(result.html).toContain('αβγδε')
    })

    it('should handle nested wiki links in complex structures', async () => {
      const content = `---
title: Nested Test
---

> Quote with [[nested link]] inside
> - List item with [[another link]]
>   - Sub-item with [[third link]]

| Column | Links |
|--------|-------|
| Row 1  | [[table link]] |

\`\`\`markdown
This code block has [[fake link]] that should not be processed
\`\`\``

      const result = await parseMarkdown(content)

      expect(result.linksTo).toEqual([
        'nested-link',
        'another-link',
        'third-link',
        'table-link'
      ])
      // Code block link should not be processed
      expect(result.linksTo).not.toContain('fake-link')
    })

    it('should handle Date objects in frontmatter', async () => {
      // This tests the Date normalization logic
      const content = `---
title: Date Test
date: 2024-01-15T10:30:00Z
publishDate: 2024-01-01
---

Content with dates.`

      const result = await parseMarkdown(content)

      expect(result.metadata.title).toBe('Date Test')
      expect(result.metadata.date).toBe('2024-01-15')
      expect(result.metadata.publishDate).toBe('2024-01-01')
    })

    it('should handle empty wiki links', async () => {
      const content = `---
title: Empty Links
---

This has [[]] and [[   ]] empty links.`

      const result = await parseMarkdown(content)

      // Empty links should not be included
      expect(result.linksTo).toEqual([])
    })

    it('should handle wiki links with only hash fragments', async () => {
      const content = `---
title: Hash Only
---

Reference [[#section1]] and [[#section2]].`

      const result = await parseMarkdown(content)

      // Hash-only links are filtered out (empty strings removed)
      expect(result.linksTo).toEqual([])
    })

    it('should reuse heading fallback slugs for self anchor wiki links', async () => {
      const content = `# ???

Link to [[#???]].`

      const result = await parseMarkdown(content)

      expect(result.html).toContain('href="#heading-1"')
      expect(result.headings[0]?.slug).toBe('heading-1')
    })

    it('should not guess fallback slugs for cross-note wiki links', async () => {
      const content = `---
title: Question Note
---

# ???

See [[Question Note#???]] for details.`

      const result = await parseMarkdown(content)

      expect(result.html).toContain('href="#/note/question-note"')
      expect(result.html).not.toContain('#/note/question-note#')
      expect(result.linksTo).toContain('question-note')
    })

    it('should handle malformed wiki link syntax', async () => {
      const content = `---
title: Malformed Links
---

These are not wiki links: [[[triple]]], [[unclosed, [[nested [[links]]]].`

      const result = await parseMarkdown(content)

      // Malformed wiki links are normalized by slugify
      expect(result.linksTo).toContain('triple')
      expect(result.linksTo).toContain('unclosed-nested-links')
    })

    it('should handle duplicate wiki links', async () => {
      const content = `---
title: Duplicates
---

Multiple references to [[same-link]] and [[same-link]] again.
Also [[Same Link]] with different case.`

      const result = await parseMarkdown(content)

      // Should deduplicate and normalize
      expect(result.linksTo).toEqual(['same-link'])
    })

    describe('Embeds', () => {
      it('should extract embed targets from transclusions', async () => {
        const content = `
# Embeds

Embedding ![[Second Note]] and ![[folder/Third Note#Section]] plus ![[Fourth Note|Alias Text]].
`

        const result = await parseMarkdown(content)

        expect(result.embeds).toEqual([
          'second-note',
          'third-note',
          'fourth-note'
        ])
        expect(result.linksTo).toEqual([])
      })

      it('should ignore embed syntax inside code blocks', async () => {
        const content = `
\`\`\`md
![[Ignored Note]]
\`\`\`

Actual embed: ![[Included Note]]
`

        const result = await parseMarkdown(content)

        expect(result.embeds).toEqual(['included-note'])
      })
    })

    it('should handle complex path scenarios', async () => {
      const content = `---
title: Path Test
slug: ignored-slug
---

Content here.`

      // Test various path formats
      const result1 = await parseMarkdown(content, { path: '/path/with spaces.md' })
      expect(result1.slug).toBe('with-spaces')

      const result2 = await parseMarkdown(content, { path: 'relative-path.md' })
      expect(result2.slug).toBe('relative-path')

      const result3 = await parseMarkdown(content, { path: '/path/to/UPPERCASE-FILE.MD' })
      expect(result3.slug).toBe('uppercase-file')

      const result4 = await parseMarkdown(content, { path: '/path/to/file-with-no-extension' })
      expect(result4.slug).toBe('file-with-no-extension')
    })

    it('should handle content with only headings for slug generation', async () => {
      const content = `# My Great Title

Some content here.`

      const result = await parseMarkdown(content)

      expect(result.slug).toBe('my-great-title')
      expect(result.excerpt).toBe('Some content here.')
    })

    it('should generate deterministic fallback slug for content without titles', async () => {
      const content = `Just some content without any titles or headings.

More content here.`

      const result = await parseMarkdown(content)

      expect(result.slug).toMatch(/^untitled-[a-f0-9]{8}$/)
      expect(result.excerpt).toBe('Just some content without any titles or headings.')
    })

    it('should handle markdown with broken HTML', async () => {
      const content = `---
title: Broken HTML
---

# Test

<div>Unclosed div
<span>Nested unclosed span

Content continues...`

      const result = await parseMarkdown(content)

      expect(result.slug).toBe('broken-html')
      expect(result.html).toContain('<h1 id="test">Test</h1>')
      // Should handle broken HTML gracefully
      expect(result.html).toContain('Content continues')
    })
  })
})

describe('toWebReadyNote', () => {
  it('should derive enriched fields from metadata, excerpt, and raw content', () => {
    const note = {
      slug: 'enriched-note' as Slug,
      html: '<p>This is <strong>rich</strong> content.</p>',
      metadata: {
        title: 'Enriched Note',
        tags: [' tag-one ', 42, null],
        keywords: 'Alpha Keyword ',
        categories: { ignored: true },
        description: 'Explicit description',
        createdAt: '2024-01-01',
        updatedAt: '2024-02-01',
        ogImage: 'cover.png'
      },
      linksTo: ['ref-one'],
      embeds: [],
      headings: [],
      raw: 'This is rich content with several meaningful words for reading time calculation.',
      excerpt: 'Custom excerpt'
    }

    const webNote = toWebReadyNote(note)

    expect(webNote.title).toBe('Enriched Note')
    expect(webNote.tags).toEqual(['tag-one', '42'])
    expect(webNote.description).toBe('Explicit description')
    expect(webNote.createdAt).toBe('2024-01-01')
    expect(webNote.updatedAt).toBe('2024-02-01')
    expect(webNote.ogImage).toBe('cover.png')
    expect(webNote.keywords).toEqual(expect.arrayContaining(['Alpha Keyword', 'tag-one', '42']))
    expect(webNote.readingTime).toBe(1)
    expect(webNote.wordCount).toBeGreaterThan(0)
  })

  it('should fall back to slug-derived title and text-based description when metadata is sparse', () => {
    const note = {
      slug: 'sparse-note' as Slug,
      html: '<p>Plain text body without raw override.</p>',
      metadata: {},
      linksTo: [],
      embeds: [],
      headings: [],
      raw: undefined,
      excerpt: ''
    }

    const webNote = toWebReadyNote(note)

    expect(webNote.title).toBe('Sparse Note')
    expect(webNote.tags).toEqual([])
    expect(webNote.description).toBe('Plain text body without raw override.')
    expect(webNote.createdAt).toBeUndefined()
    expect(webNote.updatedAt).toBeUndefined()
    expect(webNote.keywords).toEqual([])
  })
})
