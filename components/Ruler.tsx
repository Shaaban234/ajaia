/** Docs-style ruler for a US-letter page (8.5in at 96px/in) with 1-inch margin markers. Visual guide only. */
export default function Ruler({ zoom }: { zoom: number }) {
  const ticks = Array.from({ length: 8.5 * 8 + 1 }, (_, i) => i); // eighth-inch ticks
  return (
    <div className="ruler" aria-hidden>
      <div className="ruler-track" style={{ zoom: zoom / 100 } as React.CSSProperties}>
        <div className="ruler-margin left" /><div className="ruler-margin right" />
        {ticks.map((i) => {
          const inch = i % 8 === 0, half = i % 4 === 0;
          const n = i / 8 - 1;
          return (
            <span key={i} className={`tick ${inch ? "inch" : half ? "half" : ""}`} style={{ left: i * 12 }}>
              {inch && n > 0 && n < 8 && <b>{n}</b>}
            </span>
          );
        })}
        <span className="ruler-marker left" /><span className="ruler-marker right" />
      </div>
    </div>
  );
}
