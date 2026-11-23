import type { APIRoute } from 'astro';
import { BUILD } from '../lib/env.ts';
import { robotsTxt } from '../lib/seo.ts';

const CONTENT_TYPE = 'text/plain; charset=utf-8';

export const GET: APIRoute = () =>
  new Response(robotsTxt({ isProduction: BUILD.isProduction, siteUrl: BUILD.siteUrl }), {
    headers: { 'Content-Type': CONTENT_TYPE },
  });
