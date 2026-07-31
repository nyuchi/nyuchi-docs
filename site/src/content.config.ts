import { z } from 'astro:content';
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// `visibility: internal` gates a page behind the site's WorkOS OIDC login
// (site/src/worker/gate.ts) and behind bearer-token auth on the docs MCP
// server (nyuchi-docs-mcp-worker). Everything defaults to `public` — mark
// a page internal explicitly, never the other way around.
//
// scripts/generate-internal-paths.mjs reads this frontmatter directly (via
// a regex, not the Astro content loader) to build the manifest both
// workers consume — keep the field name and default in sync with that
// script if either changes.
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        visibility: z.enum(['public', 'internal']).default('public'),
      }),
    }),
  }),
};
