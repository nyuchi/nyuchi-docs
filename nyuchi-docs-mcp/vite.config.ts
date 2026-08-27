import { defineConfig } from "vite-plus";

export default defineConfig({
  // Type checking is OPT-IN in Vite+. Without these two lines `vp check` runs
  // oxlint only and reports "pass" on `const x: number = "nope"` — verified
  // against tsc, which flags TS2322 on that exact line. Adopting the unified
  // command without this block would delete the type gate while looking greener.
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
