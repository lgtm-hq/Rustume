/**
 * Source patterns shared by the tests that read the Typst templates.
 *
 * One home for the themed-chip call signature, imported by BOTH the vitest
 * registry lockstep (`docLayout.test.ts`) and the e2e parity audit
 * (`templateContrastMatrix.ts`), so the two detectors cannot drift apart.
 */

/**
 * A themed `render-item-tag-chips` call: `accent` AND `bg` passed, which is
 * the helper's gate for painting the sheet's `.doc-sheet__tag-chip`
 * treatment (`_common.typ`).
 */
export const THEMED_CHIP_CALL_RE =
  /render-item-tag-chips\([\s\S]{0,400}?accent: accent-color,[\s\S]{0,100}?bg: bg-color/;
