// Verifies the public manifest shape of nyuchi-docs-search.
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };

describe('package manifest', () => {
  it('declares the expected entry exports', () => {
    expect(pkg.name).toBe('nyuchi-docs-search');
    expect(pkg.svelte).toBe('./dist/index.js');
    expect(pkg.exports['.']).toMatchObject({
      svelte: './dist/index.js',
      import: './dist/index.js',
    });
    expect(pkg.exports['./SearchModal.svelte']).toMatchObject({
      svelte: './dist/SearchModal.svelte',
    });
    expect(pkg.exports['./plugin']).toMatchObject({
      import: './dist/plugin.js',
    });
  });

  it('declares Starlight + Svelte 5 as peer deps', () => {
    expect(pkg.peerDependencies['@astrojs/starlight']).toMatch(/0\.39/);
    expect(pkg.peerDependencies['svelte']).toMatch(/\^5/);
  });

  it('declares no runtime dependencies (pure Svelte 5)', () => {
    expect(Object.keys(pkg.dependencies ?? {})).toHaveLength(0);
  });
});
