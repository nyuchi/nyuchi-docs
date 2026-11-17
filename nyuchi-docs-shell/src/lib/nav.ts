// Pure helpers for the header navigation. No DOM, no Astro.

function normalise(path: string): string {
  const withSlash = path.endsWith("/") ? path : `${path}/`;
  return withSlash.split("?")[0].split("#")[0];
}

/**
 * True when `href` is the current page or an ancestor section of it, so the
 * header link for "/api/" stays marked on "/api/overview/". External links
 * are never active.
 */
export function isActivePath(current: string, href: string): boolean {
  if (!href.startsWith("/")) return false;
  const here = normalise(current);
  const target = normalise(href);
  if (target === "/") return here === "/";
  return here === target || here.startsWith(target);
}
