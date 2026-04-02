/** Figma node 47:40 “Desktop - 2” — metadata from MCP get_metadata */
export const FIGMA_LANDING = {
  frameWidth: 1440,
  frameHeight: 1024,
  /** Horizontal rule sits at y=91; navbar row is everything above it */
  navHeight: 91,
  /** Design canvas below the rule (scale target) */
  get bodyWidth() {
    return this.frameWidth
  },
  get bodyHeight() {
    return this.frameHeight - this.navHeight
  },
} as const
