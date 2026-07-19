// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import svelte from '@astrojs/svelte';
import { starlightDocsSearch } from 'nyuchi-docs-search/plugin';

// https://astro.build/config
export default defineConfig({
  site: 'https://docs.nyuchi.com',
  integrations: [
    svelte(),
    starlight({
      title: 'Nyuchi Docs',
      description:
        'Nyuchi engineering documentation — how things are done at Nyuchi, the product guide for the Nyuchi platform, and how to use the Mzizi tools.',
      plugins: [
        starlightDocsSearch({
          aiUrl: import.meta.env.PUBLIC_SHAMWARI_AI_URL,
          source: 'nyuchi',
        }),
      ],
      customCss: ['./src/styles/theme.css'],
      components: {
        Header: './src/components/Header.astro',
        Footer: './src/components/Footer.astro',
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
            {
              label: 'API',
              items: [
                'platform/api/overview',
                'platform/api/authentication',
                'platform/api/security',
              ],
            },
          ],
        },
        {
          label: 'Analytics',
          collapsed: true,
          items: [
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
            {
              label: 'Getting started',
              items: [
                'integrations/quickstart',
                'integrations/authentication',
                'integrations/api-gateway',
                'integrations/docs-mcp',
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
            {
              label: 'Nyuchi API',
              items: [
                'integrations/nyuchi-api/overview',
                'integrations/nyuchi-api/commerce',
                'integrations/nyuchi-api/pay',
                'integrations/nyuchi-api/logistics',
                'integrations/nyuchi-api/lingo',
                'integrations/nyuchi-api/news',
                'integrations/nyuchi-api/weather',
              ],
            },
          ],
        },
        {
          label: 'Mukoko Weather',
          collapsed: true,
          items: [
            'mukoko-weather/user-guide',
            'mukoko-weather/weather-stations',
          ],
        },
        {
          label: 'Mukoko Kweli',
          collapsed: true,
          items: [
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
          items: ['identity/overview', 'identity/authkit'],
        },
        {
          label: 'Console',
          items: ['console/overview'],
        },
        {
          label: 'Mzizi Tools',
          items: ['mzizi-tools/overview'],
        },
        {
          label: 'Deployment',
          items: ['deployment/overview'],
        },
        {
          label: 'Conventions',
          items: ['conventions/overview'],
        },
      ],
    }),
  ],
});
