/**
 * Markdown from content fields (rich-text bodies, FAQ answers) to HTML, through Astro's own
 * pipeline. One processor is created on first use and shared by every call; code blocks stay
 * plain (no syntax highlighting, so no inline colour styles reach the page).
 *
 * Safety, applied by one inline remark plugin before anything is rendered:
 * - Raw HTML is dropped (every `html` node: tags, comments, scripts, forms, iframes). Editors
 *   write Markdown only.
 * - Every link, image and link definition URL must be a site path (`/…`, never `//` or `/\`),
 *   `https:`, `mailto:`, `tel:` or a `#fragment`. Anything else (`javascript:`, `data:`, `http:`,
 *   a relative path) fails the build with a message naming the section and the URL. The check
 *   runs on the decoded URL with the characters browsers ignore (tab, newline, leading
 *   control characters and spaces) removed, so `JaVa\tScRiPt:` and `&#106;avascript:` are caught.
 *
 * Page heading rules, applied by one inline rehype plugin:
 * - Content never adds an h1 (the page owns its single h1): `#` and setext `===` become h2.
 * - Heading ids are `<idPrefix>-<n>` in document order. Astro always adds slug ids (no option
 *   turns them off) but keeps an id that is already set, so numbering first means slugs from two
 *   blocks never collide with each other or with page ids such as `#main`.
 *
 * Links: every anchor's href in the rendered HTML goes through the caller's `rewriteHref` (the
 * page locale's `localizeHref`). This runs on the output; the serializer double-quotes every
 * attribute value, so one pattern finds each href.
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
/** Render options carry the id prefix in the frontmatter slot (the only per-call channel). */
const ID_PREFIX_KEY = 'headingIdPrefix';
/** `<a …href="…"`: other attributes may come first, and a quoted value may hold `>`. */
const ANCHOR_HREF = /(<a(?=\s)(?:[^>"]|"[^"]*")*?\shref=")([^"]*)"/g;

/** The slice of the mdast tree the safety plugin reads. */
type MdastNode = { type: string; url?: string; children?: MdastNode[] };

/** Link-like nodes whose `url` ends up in an `href` or `src`. */
const URL_NODE_TYPES: ReadonlySet<string> = new Set(['link', 'image', 'definition']);
/** Characters a browser drops from a URL before reading it: tab, LF, CR anywhere. */
const URL_IGNORED_ANYWHERE = /[\t\n\r]/g;
/** Leading and trailing C0 controls and spaces are trimmed too. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
const URL_EDGE_JUNK = /^[\u0000-\u0020]+|[\u0000-\u0020]+$/g;
const SAFE_URL = /^(?:\/(?![/\\])|#|https:|mailto:|tel:)/i;

function isSafeContentUrl(url: string): boolean {
  return SAFE_URL.test(url.replace(URL_IGNORED_ANYWHERE, '').replace(URL_EDGE_JUNK, ''));
}

function remarkSafeContent() {
  return (tree: MdastNode, file: RenderFile): void => {
    const prefix = file.data.astro?.frontmatter?.[ID_PREFIX_KEY];
    const visit = (node: MdastNode): void => {
      if (node.children === undefined) return;
      node.children = node.children.filter((child) => child.type !== 'html');
      for (const child of node.children) {
        if (URL_NODE_TYPES.has(child.type) && !isSafeContentUrl(child.url ?? '')) {
          throw new Error(
            `Unsafe URL in Markdown (section "${String(prefix)}"): ${JSON.stringify(child.url)}. ` +
              'Allowed: a site path starting with "/", https:, mailto:, tel: or #fragment.',
          );
        }
        visit(child);
      }
    };
    visit(tree);
  };
}

function rehypePageHeadings() {
  return (tree: HastNode, file: RenderFile): void => {
    const prefix = file.data.astro?.frontmatter?.[ID_PREFIX_KEY];
    if (typeof prefix !== 'string') throw new Error('renderMarkdown needs a heading id prefix');
    let count = 0;
    const visit = (node: HastNode): void => {
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

/**
 * `idPrefix` must be unique on the page (e.g. per section and item). `rewriteHref` gets each
 * link's href as serialized (HTML character references kept) and returns the one to render.
 */
export async function renderMarkdown(
  source: string,
  idPrefix: string,
  rewriteHref: (href: string) => string,
): Promise<string> {
  processor ??= createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [remarkSafeContent],
    rehypePlugins: [rehypePageHeadings],
  });
  const { code } = await (await processor).render(source, {
    frontmatter: { [ID_PREFIX_KEY]: idPrefix },
  });
  return code.replace(
    ANCHOR_HREF,
    (_anchor, start: string, href: string) => `${start}${rewriteHref(href)}"`,
  );
}
