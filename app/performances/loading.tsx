/**
 * Performances loading skeleton
 */

export default function PerformancesLoading() {
  return (
    <div className="classes-loading">
      <div className="classes-loading-hero" />
      <div className="container">
        <div className="classes-loading-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="classes-loading-card" key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
