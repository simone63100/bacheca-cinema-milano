/** "Bijoux" ricamato come sull'accappatoio d'hotel: riempimento navy, filo tratteggiato, leggero rumore. */
export function Monogram({ className = "mono" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 62" role="img" aria-label="Bijoux">
      <g filter="url(#thread)">
        <text x="90" y="48" textAnchor="middle" style={{ fontFamily: "var(--font-pinyon), cursive" }} fontSize="52" fill="#1a2647">
          Bijoux
        </text>
        <text
          x="90"
          y="48"
          textAnchor="middle"
          style={{ fontFamily: "var(--font-pinyon), cursive" }}
          fontSize="52"
          fill="none"
          stroke="#f9e2e6"
          strokeWidth=".7"
          strokeDasharray="1.6 1.4"
        >
          Bijoux
        </text>
      </g>
    </svg>
  );
}
