// Browser-only. Marks the document once it has scrolled, so the header can
// gain its bottom border and blurred background (the Mzizi header's scrolled
// state). Plain DOM, no framework. The attribute is the whole contract; the
// styling lives in shell.css.

export const SCROLLED_ATTRIBUTE = "data-mzizi-scrolled";
export const SCROLL_THRESHOLD_PX = 4;

export function initScrollState(win: Window = window): () => void {
  const root = win.document.documentElement;
  let frame = 0;

  const apply = () => {
    frame = 0;
    root.toggleAttribute(SCROLLED_ATTRIBUTE, win.scrollY > SCROLL_THRESHOLD_PX);
  };
  const schedule = () => {
    if (frame) return;
    frame = win.requestAnimationFrame(apply);
  };

  apply();
  win.addEventListener("scroll", schedule, { passive: true });
  return () => {
    win.removeEventListener("scroll", schedule);
    if (frame) win.cancelAnimationFrame(frame);
  };
}
