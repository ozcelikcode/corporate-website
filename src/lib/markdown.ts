/**
 * Markdown from content fields (rich-text bodies, FAQ answers) to HTML, through Astro's own
 * pipeline. One processor is created on first use and shared by every call; code blocks stay
 * plain (no syntax highlighting, so no inline colour styles reach the page).
 *
 * Page heading rules, applied by one inline rehype plugin:
 * - Content never adds an h1 (the page owns its single h1): `#`, setext `===` and raw `<h1>`
 *   all become h2. User rehype plugins run before Astro parses raw HTML, so raw tags are
 *   rewritten in the raw node's text.
 * - Heading ids are `<idPrefix>-<n>` in document order. Astro always adds slug ids (no option
 *   turns them off) but keeps an id that is already set, so numbering first means slugs from two
 *   blocks never collide with each other or with page ids such as `#main`.
 */
import { createMarkdownProcessor, type MarkdownRenderer } from '@astrojs/markdown-remark';

/** The slice of the hast tree this plugin reads; anything else passes through untouched. */
type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
};
type RenderFile = { data: { astro?: { frontmatter?: Record<string, unknown> } } };

const HEADING_TAG = /^h[1-6]$/;
const DEMOTED_TAG = 'h2';
/** `<h1` or `</h1` followed by whitespace, `>` or `/`: never `<h10>` or `<header>`. */
const RAW_H1_TAG = /<(\/?)h1(?=[\s/>])/gi;
/** Render options carry the id prefix in the frontmatter slot (the only per-call channel). */
const ID_PREFIX_KEY = 'headingIdPrefix';

function rehypePageHeadings() {
  return (tree: HastNode, file: RenderFile): void => {
    const prefix = file.data.astro?.frontmatter?.[ID_PREFIX_KEY];
    if (typeof prefix !== 'string') throw new Error('renderMarkdown needs a heading id prefix');
    let count = 0;
    const visit = (node: HastNode): void => {
      if (node.type === 'raw' && node.value !== undefined) {
        node.value = node.value.replace(RAW_H1_TAG, `<$1${DEMOTED_TAG}`);
      }
      if (node.type === 'element' && node.tagName !== undefined && HEADING_TAG.test(node.tagName)) {
        if (node.tagName === 'h1') node.tagName = DEMOTED_TAG;
        count += 1;
        node.properties = { ...node.properties, id: `${prefix}-${count}` };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

let processor: Promise<MarkdownRenderer> | undefined;

/** `idPrefix` must be unique on the page (e.g. per section and item). */
export async function renderMarkdown(source: string, idPrefix: string): Promise<string> {
  processor ??= createMarkdownProcessor({
    syntaxHighlight: false,
    rehypePlugins: [rehypePageHeadings],
  });
  const { code } = await (await processor).render(source, {
    frontmatter: { [ID_PREFIX_KEY]: idPrefix },
  });
  return code;
}
