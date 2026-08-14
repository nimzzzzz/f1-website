// Types for the plain-JS charset collector, so the guard test and the
// build's type check can both consume it without an escape hatch.
export declare function collectCharset(opts?: {
  margin?: boolean
  root?: string
}): { chars: Set<number>; provenance: { source: string; kind: string }[] }
export declare function unknownEntities(opts?: { root?: string }): string[]
export declare const KNOWN_ABSENT_UPSTREAM: number[]
export declare function toChars(cps: Iterable<number>): string
