/** @type {import('next').NextConfig} */

// Image hosts the site genuinely loads from. Kept in one place so the CSP
// and next/image cannot drift apart — a host added to one and not the other
// is a broken image or a silently-permissive policy.
const IMAGE_HOSTS = ['media.formula1.com', 'upload.wikimedia.org', 'flagcdn.com']

// CSP.
//
// Built by MEASUREMENT, not by guesswork: the policy was first shipped
// Report-Only, every route was loaded in a real browser with
// securitypolicyviolation captured, and each directive below is either
// what produced zero violations or a documented loosening.
//
// TWO DELIBERATE LOOSENINGS, both stated rather than slipped in:
//
//  1. script-src 'unsafe-inline'. Next.js inlines hydration payloads and
//     the bootstrap in <script> tags on every prerendered page. The only
//     way to drop this is a per-request nonce, which requires middleware —
//     and middleware would make every page dynamic again, undoing the
//     static+ISR migration that removed the self-fetch. Nonces and
//     prerendering are mutually exclusive here, and prerendering is worth
//     more: it removed an SSRF surface outright. Modern browsers ignore
//     'unsafe-inline' when a hash or nonce is present, so this is not
//     hiding a stricter policy — there is no stricter policy available to
//     a fully static Next 14 app.
//
//  2. style-src 'unsafe-inline'. The design language is built on inline
//     style props — clamp() type scales, per-team livery colours, GSAP and
//     framer-motion transforms. React renders every style={{...}} prop as a
//     style attribute, and next/font injects a <style> block. Removing it
//     would mean rewriting the entire visual layer against CSS custom
//     properties. Note this is the weaker of the two: style injection is
//     not script execution.
//
// Everything else is locked: no external scripts, no framing, no plugins,
// no form posts off-origin, no <base> rewriting, and connect-src is
// same-origin only because the browser talks exclusively to /api/* (the
// openf1 proxy) and never to api.openf1.org directly.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  // Measured: the ONLY script violation across all 15 routes was
  // script-src-elem (Next's inline <script> blocks). There were ZERO
  // script-src-attr violations — the site has no inline event handlers at
  // all — so they can be forbidden outright. Modern browsers honour this;
  // older ones fall back to script-src above and still work.
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  // data: for next/image blur placeholders and inline SVG data URIs;
  // blob: for canvas-derived sources.
  `img-src 'self' data: blob: ${IMAGE_HOSTS.map((h) => `https://${h}`).join(' ')}`,
  // next/font/google self-hosts at build time — nothing is fetched from
  // fonts.gstatic.com at runtime.
  "font-src 'self'",
  // the intro video, served from /public
  "media-src 'self'",
  // /api/openf1, /api/season-data, /api/openf1-status — all same-origin
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // frame-ancestors above is the modern control; X-Frame-Options is kept
  // for older agents that do not implement it.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The site uses none of these. Denying by default means a future
  // dependency cannot quietly start using one.
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'autoplay=(self)',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'usb=()',
      'xr-spatial-tracking=()',
      'interest-cohort=()',
    ].join(', '),
  },
  // Enforced by Vercel at the edge already, but stated here so the policy
  // travels with the app rather than depending on the host.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig = {
  // Don't advertise the framework in response headers.
  poweredByHeader: false,
  images: {
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({ protocol: 'https', hostname })),
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
module.exports = nextConfig
