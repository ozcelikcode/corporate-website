/**
 * Markdown from content fields (rich-text bodies, FAQ answers) to HTML, through Astro's own
 * pipeline. One processor is created on first use and shared by every call; code blocks stay
 * plain (no syntax highlighting, so no inline colour styles reach the page).
 */
import { createMarkdownProcessor, type MarkdownRenderer } from '@astrojs/markdown-remark';

let processor: Promise<MarkdownRenderer> | undefined;

export async function renderMarkdown(source: string): Promise<string> {
  processor ??= createMarkdownProcessor({ syntaxHighlight: false });
  const { code } = await (await processor).render(source);
  return code;
}
