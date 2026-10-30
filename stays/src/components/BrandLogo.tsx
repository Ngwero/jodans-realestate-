type Props = {
  className?: string
  compact?: boolean
}

const LOGO_SRC = '/jodans-logo.svg'

export function BrandLogo({ className = '', compact = false }: Props) {
  return (
    <span className={`brand-logo${compact ? ' compact' : ''} ${className}`.trim()}>
      <img src={LOGO_SRC} alt="Jodans Concepts" />
    </span>
  )
}
