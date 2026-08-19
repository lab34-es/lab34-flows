/**
 * colors@1.4 also patches String.prototype with background gray/grey and the
 * bright* variants, but the type definitions bundled with the package still
 * describe version 1.2 and stop at bgWhite. Declare the extra members the
 * codebase actually uses so they type-check; the augmentation merges with the
 * one colors itself declares.
 */
import 'colors';

declare global {
  interface String {
    bgGray: string;
    bgGrey: string;
  }
}
