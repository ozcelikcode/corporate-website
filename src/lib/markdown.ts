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
 *   runs on the decoded URL: it must start with an allowed prefix as written, and also
 *   after the characters browsers ignore (tab, newline) are removed, so `JaVa\tScRiPt:` and `&#106;avascript:` are caught.
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
type MdastNode = {
  type: string;
  url?: string;
  value?: string;
  position?: { start: { offset?: number | undefined } } | undefined;
  children?: MdastNode[];
};

/** Link-like nodes whose `url` ends up in an `href` or `src`. */
const URL_NODE_TYPES: ReadonlySet<string> = new Set(['link', 'image', 'definition']);
/** Characters a browser drops from a URL before reading it: tab, LF, CR anywhere. */
const URL_IGNORED_ANYWHERE = /[\t\n\r]/g;
const SAFE_URL = /^(?:\/(?![/\\])|#|https:|mailto:|tel:)/i;
const HTTP_URL = /^http:/i;

/** The raw URL must start with an allowed prefix, and so must what a browser makes of it. */
function isSafeContentUrl(url: string): boolean {
  return SAFE_URL.test(url) && SAFE_URL.test(url.replace(URL_IGNORED_ANYWHERE, ''));
}

/**
 * A bare `www.…` or `http://…` in running text becomes an `http:` autolink literal; it was never
 * written as a link, so it stays plain text (an explicit `[x](http://…)` or `<http://…>` still
 * fails). Literals start at their own text: an explicit link starts with `[` or `<`.
 */
function isHttpAutolinkLiteral(node: MdastNode, source: string): boolean {
  const offset = node.position?.start.offset;
  if (node.type !== 'link' || !HTTP_URL.test(node.url ?? '') || offset === undefined) return false;
  return source[offset] !== '[' && source[offset] !== '<';
}

function remarkSafeContent() {
  return (tree: MdastNode, file: RenderFile & { value?: unknown }): void => {
    const prefix = file.data.astro?.frontmatter?.[ID_PREFIX_KEY];
    const source = typeof file.value === 'string' ? file.value : '';
    const visit = (node: MdastNode): void => {
      if (node.children === undefined) return;
      node.children = node.children
        .filter((child) => child.type !== 'html')
        .map((child) =>
          isHttpAutolinkLiteral(child, source)
            ? { type: 'text', value: (child.children ?? []).map((part) => part.value).join('') }
            : child,
        );
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

/** GFM footnotes: the label heading, and the `user-content-` prefix on every other id and link. */
const FOOTNOTE_LABEL_ID = 'footnote-label';
const CLOBBER_PREFIX = 'user-content-';

/**
 * Footnote ids (`user-content-fn-1`, `…-fnref-1`) and their links would repeat across Markdown
 * blocks on one page; they move under the block's id prefix, like heading ids, and the label
 * heading and the `aria-describedby` that points to it follow.
 */
function scopeFootnoteIds(node: HastNode, prefix: string): void {
  const properties = node.properties;
  if (properties === undefined) return;
  const { id, href } = properties;
  if (typeof id === 'string' && id.startsWith(CLOBBER_PREFIX)) {
    properties.id = `${prefix}-${id.slice(CLOBBER_PREFIX.length)}`;
  }
  if (typeof href === 'string' && href.startsWith(`#${CLOBBER_PREFIX}`)) {
    properties.href = `#${prefix}-${href.slice(CLOBBER_PREFIX.length + 1)}`;
  }
  if (Array.isArray(properties.ariaDescribedBy)) {
    properties.ariaDescribedBy = properties.ariaDescribedBy.map((ref) =>
      ref === FOOTNOTE_LABEL_ID ? `${prefix}-${FOOTNOTE_LABEL_ID}` : ref,
    );
  }
}

function rehypePageHeadings() {
  return (tree: HastNode, file: RenderFile): void => {
    const prefix = file.data.astro?.frontmatter?.[ID_PREFIX_KEY];
    if (typeof prefix !== 'string') throw new Error('renderMarkdown needs a heading id prefix');
    let count = 0;
    const visit = (node: HastNode): void => {
      if (node.type === 'element') scopeFootnoteIds(node, prefix);
      const isFootnoteLabel = node.properties?.id === FOOTNOTE_LABEL_ID;
      if (node.type === 'element' && node.tagName !== undefined && HEADING_TAG.test(node.tagName)) {
        if (node.tagName === 'h1') node.tagName = DEMOTED_TAG;
        if (isFootnoteLabel) {
          node.properties = { ...node.properties, id: `${prefix}-${FOOTNOTE_LABEL_ID}` };
        } else {
          count += 1;
          node.properties = { ...node.properties, id: `${prefix}-${count}` };
        }
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
