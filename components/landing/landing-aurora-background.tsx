'use client'

/**
 * Full-viewport animated gradient for the landing page.
 * Layers drifting blurred orbs + a slow mesh shift (CSS-only, respects reduced motion).
 */
export function LandingAuroraBackground() {
  return (
    <div
      className="landing-aurora-root pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Slow-moving mesh (position animated in globals.css) */}
      <div className="landing-aurora-mesh absolute inset-[-20%] opacity-90 dark:opacity-100" />

      {/* Drifting color orbs */}
      <div className="landing-aurora-orb landing-aurora-orb-1 absolute rounded-full blur-[100px] will-change-transform" />
      <div className="landing-aurora-orb landing-aurora-orb-2 absolute rounded-full blur-[90px] will-change-transform" />
      <div className="landing-aurora-orb landing-aurora-orb-3 absolute rounded-full blur-[110px] will-change-transform" />
      <div className="landing-aurora-orb landing-aurora-orb-4 absolute rounded-full blur-[80px] will-change-transform" />

      {/* Vignette + subtle starfield speckle */}
      <div className="landing-aurora-vignette absolute inset-0" />
      <div className="landing-aurora-noise absolute inset-0 opacity-[0.35] mix-blend-overlay dark:opacity-[0.22]" />
    </div>
  )
}
