'use client'

import CircuitBackdrop from '@/components/media/CircuitBackdrop'

// The NOW section's backdrop — the shared CircuitBackdrop at full
// presence, eager (above the fold, warms behind the intro).
// QA override: /?backdrop=icon forces the line-art variant.
export default function NowBackdrop({
  circuitShortName,
  countryName,
}: {
  circuitShortName: string
  countryName: string
}) {
  const forceIcon =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('backdrop') === 'icon'
  return (
    <CircuitBackdrop
      circuitShortName={circuitShortName}
      countryName={countryName}
      eager
      forceIcon={forceIcon}
    />
  )
}
