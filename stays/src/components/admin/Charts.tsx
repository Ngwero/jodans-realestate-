type Slice = { name: string; count: number; color: string }

const COLORS = ['#003087', '#E30613', '#0f6b3c', '#9a5b00', '#5b6472', '#0070E0']

export function DonutChart({
  slices,
  size = 180,
  thickness = 28,
  centerLabel,
  centerSub,
}: {
  slices: { name: string; count: number }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
}) {
  const total = slices.reduce((s, x) => s + x.count, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  const colored: Slice[] = slices.map((s, i) => ({
    ...s,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div className="chart-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="chart-donut">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e8eef6"
          strokeWidth={thickness}
        />
        {colored.map((s) => {
          const len = (s.count / total) * c
          const el = (
            <circle
              key={s.name}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )
          offset += len
          return el
        })}
        <text x="50%" y="48%" textAnchor="middle" className="chart-donut-value">
          {centerLabel ?? total.toLocaleString()}
        </text>
        {centerSub && (
          <text x="50%" y="58%" textAnchor="middle" className="chart-donut-sub">
            {centerSub}
          </text>
        )}
      </svg>
      <ul className="chart-legend">
        {colored.map((s) => (
          <li key={s.name}>
            <i style={{ background: s.color }} />
            <span>{s.name}</span>
            <strong>
              {s.count.toLocaleString()}
              <em>{Math.round((s.count / total) * 100)}%</em>
            </strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BarChart({
  rows,
  height = 200,
}: {
  rows: { name: string; count: number }[]
  height?: number
}) {
  const max = Math.max(...rows.map((r) => r.count), 1)
  const barW = 28
  const gap = 14
  const pad = 28
  const width = Math.max(rows.length * (barW + gap) + pad * 2, 240)
  const chartH = height - 40

  return (
    <div className="chart-bar-scroll">
      <svg width={width} height={height} className="chart-bar" role="img">
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad + chartH * (1 - t)
          return (
            <g key={t}>
              <line x1={pad} x2={width - 8} y1={y} y2={y} className="chart-grid" />
            </g>
          )
        })}
        {rows.map((r, i) => {
          const h = (r.count / max) * chartH
          const x = pad + i * (barW + gap)
          const y = pad + chartH - h
          return (
            <g key={r.name}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 2)}
                rx={6}
                className="chart-bar-fill"
              />
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="chart-bar-label">
                {r.name.length > 8 ? `${r.name.slice(0, 7)}…` : r.name}
              </text>
              <title>
                {r.name}: {r.count.toLocaleString()}
              </title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function HBarChart({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <ul className="admin-bars chart-hbars">
      {rows.map((d) => (
        <li key={d.name}>
          <div className="admin-bar-meta">
            <span>{d.name}</span>
            <strong>{d.count.toLocaleString()}</strong>
          </div>
          <div className="admin-bar-track">
            <i style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
