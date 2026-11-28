// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { starlightDocsSearch } from '@nyuchi/nyuchi-docs-search/plugin';
import { starlightMziziShell } from '@bundu/ui/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://docs.nyuchi.com',
  // API documentation consolidated into the top-level API Docs section.
  redirects: {
    // Single-page sections are direct sidebar links; the bare root redirects.
    '/console': '/console/overview',
    '/conventions': '/conventions/overview',
    '/platform/api/overview': '/api/overview',
    '/platform/api/authentication': '/api/authentication',
    '/platform/api/security': '/api/security',
    '/integrations/api-gateway': '/api/overview',
    '/integrations/nyuchi-api/overview': '/api/overview',
    '/integrations/nyuchi-api/commerce': '/api/commerce',
    '/integrations/nyuchi-api/pay': '/api/pay',
    '/integrations/nyuchi-api/logistics': '/api/logistics',
    '/integrations/nyuchi-api/lingo': '/api/lingo',
    '/integrations/nyuchi-api/news': '/api/news',
    '/integrations/nyuchi-api/weather': '/api/weather',
  },
  integrations: [
    starlight({
      title: 'Nyuchi Docs',
      description:
        'Nyuchi engineering documentation — how things are done at Nyuchi, the product guide for the Nyuchi platform, and how to use the Mzizi tools.',
      plugins: [
        starlightDocsSearch({
          aiUrl: import.meta.env.PUBLIC_SHAMWARI_AI_URL,
          source: 'nyuchi',
        }),
        // The standard Mzizi shell from @bundu/ui (the same one docs.bundu.org
        // uses): header, sidebar, footer and the Starlight theme. The header links
        // are the sidebar's top-level sections (a subset: the header is one
        // row); the footer columns are the sections plus the ecosystem links
        // the old footer carried.
        starlightMziziShell({
          navLinks: [
            { label: 'Platform', href: '/platform/' },
            { label: 'API Docs', href: '/api/' },
            { label: 'Integrations', href: '/integrations/' },
            { label: 'Playbooks', href: '/playbooks/' },
            { label: 'Identity', href: '/identity/' },
          ],
          footerColumns: [
            {
              title: 'Docs',
              links: [
                { label: 'Platform', href: '/platform/' },
                { label: 'API Docs', href: '/api/' },
                { label: 'Analytics', href: '/analytics/' },
                { label: 'Integrations', href: '/integrations/' },
                { label: 'Playbooks', href: '/playbooks/' },
                { label: 'Engineering', href: '/engineering/' },
              ],
            },
            {
              title: 'Products',
              links: [
                { label: 'Mukoko Weather', href: '/mukoko-weather/' },
                { label: 'Mukoko Kweli', href: '/kweli/' },
                { label: 'Identity', href: '/identity/' },
                { label: 'Console', href: '/console/overview/' },
              ],
            },
            {
              title: 'Ecosystem',
              links: [
                { label: 'Website', href: 'https://nyuchi.com', external: true },
                {
                  label: 'Platform app',
                  href: 'https://platform.nyuchi.com',
                  external: true,
                },
                {
                  label: 'Bundu docs',
                  href: 'https://docs.bundu.org',
                  external: true,
                },
                {
                  label: 'GitHub',
                  href: 'https://github.com/nyuchi',
                  external: true,
                },
              ],
            },
          ],
          tagline: 'I am because we are.',
          legal: '© 2026 Nyuchi Africa (Pvt) Ltd · Part of the Bundu Foundation',
          // Nyuchi's brand mineral.
          accent: 'gold',
        }),
      ],
      customCss: ['./src/styles/theme.css'],
      components: {
        PageFrame: './src/components/PageFrame.astro',
      },
      logo: {
        light: './src/assets/icon-light.png',
        dark: './src/assets/icon-dark.png',
        replacesTitle: false,
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/nyuchi',
        },
      ],
      sidebar: [
        {
          label: 'Platform',
          collapsed: true,
          items: [
            'platform',
            {
              label: 'Getting started',
              items: [
                'platform/quickstart',
                'platform/key-concepts',
                'platform/support-chat',
                'platform/product-workspaces',
              ],
            },
            {
              label: 'Configuration',
              items: [
                'platform/configuration/settings',
                'platform/configuration/sign-in',
                'platform/configuration/user-management',
              ],
            },
            {
              label: 'Administration',
              items: [
                'platform/administration/roles-permissions',
                'platform/administration/audit-logs',
              ],
            },
          ],
        },
        {
          label: 'API Docs',
          collapsed: true,
          items: [
            'api',
            {
              label: 'Getting started',
              items: [
                'api/overview',
                'api/authentication',
                'api/api-keys',
                'api/security',
              ],
            },
            {
              label: 'Namespaces',
              items: [
                'api/commerce',
                'api/pay',
                'api/logistics',
                'api/lingo',
                'api/news',
                'api/weather',
              ],
            },
          ],
        },
        {
          label: 'Analytics',
          collapsed: true,
          items: [
            'analytics',
            {
              label: 'Getting started',
              items: ['analytics/quickstart', 'analytics/connect-data'],
            },
            {
              label: 'Dashboards',
              items: [
                'analytics/dashboards/create-dashboard',
                'analytics/dashboards/charts-visualizations',
                'analytics/dashboards/sharing-exports',
              ],
            },
            {
              label: 'Reports',
              items: [
                'analytics/reports/build-report',
                'analytics/reports/scheduled-reports',
              ],
            },
          ],
        },
        {
          label: 'Integrations',
          collapsed: true,
          items: [
            'integrations',
            {
              label: 'Getting started',
              items: [
                'integrations/quickstart',
                'integrations/authentication',
                'integrations/docs-mcp',
                'integrations/events-mcp',
              ],
            },
            {
              label: 'Connectors',
              items: [
                'integrations/connectors/crm',
                'integrations/connectors/data-warehouse',
                'integrations/connectors/messaging',
              ],
            },
            {
              label: 'Webhooks & events',
              items: [
                'integrations/webhooks/configure',
                'integrations/webhooks/event-types',
                'integrations/webhooks/retry-policies',
              ],
            },
          ],
        },
        {
          label: 'Playbooks',
          collapsed: true,
          items: [
            'playbooks',
            'playbooks/data',
            'playbooks/platform',
            'playbooks/api',
            'playbooks/open-data',
            'playbooks/analytics',
            'playbooks/releases',
            'playbooks/web',
            'playbooks/identity',
            'playbooks/notifications',
            'playbooks/agents',
            'playbooks/weather',
            'playbooks/news',
            {
              label: 'Operations',
              items: [
                'playbooks/roles-and-authority',
                'playbooks/trunk-rules',
                'playbooks/release-procedure',
                'playbooks/making-a-repo-public',
                'playbooks/security-triage',
                'playbooks/incident-response',
                'playbooks/dependency-policy',
                'playbooks/naming-and-where-things-live',
                'playbooks/known-sharp-edges',
                'playbooks/adopting-lint',
              ],
            },
          ],
        },
        {
          label: 'Engineering',
          collapsed: true,
          items: [
            'engineering',
            'engineering/guide',
            'engineering/contributing',
            'engineering/readme-standard',
            'engineering/org-settings',
            'engineering/dpia-preassessment',
          ],
        },
        {
          label: 'Mukoko Weather',
          collapsed: true,
          items: [
            'mukoko-weather',
            'mukoko-weather/user-guide',
            'mukoko-weather/weather-stations',
          ],
        },
        {
          label: 'Mukoko Kweli',
          collapsed: true,
          items: [
            'kweli',
            'kweli/overview',
            'kweli/verification',
            'kweli/cross-app-verification',
            'kweli/open-data',
            'kweli/data-quality',
            'kweli/design-system',
            'kweli/competitive-audit',
          ],
        },
        {
          label: 'Identity',
          collapsed: true,
          items: ['identity', 'identity/overview', 'identity/authkit'],
        },
        { label: 'Console', slug: 'console/overview' },
        {
          label: 'Tools',
          items: ['tools'],
        },
        {
          label: 'Mzizi Tools',
          items: [
            'mzizi-tools/overview',
            'mzizi-tools/dna-helix',
            'mzizi-tools/registry-health',
            'mzizi-tools/a2a',
          ],
        },
        {
          label: 'Deployment',
          items: ['deployment/overview', 'deployment/agentgateway'],
        },
        { label: 'Conventions', slug: 'conventions/overview' },
      ],
    }),
  ],
});
