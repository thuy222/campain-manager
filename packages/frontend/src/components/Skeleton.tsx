type SkeletonRowsProps = {
  rows?: number;
  columns?: number;
};

export function SkeletonTable({ rows = 5, columns = 5 }: SkeletonRowsProps) {
  return (
    <table aria-busy="true" aria-label="Loading campaigns">
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i}>
              <span className="skeleton skeleton-text" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: columns }).map((_, c) => (
              <td key={c}>
                <span className="skeleton skeleton-text" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SkeletonStats() {
  return (
    <div className="stats-panel" aria-busy="true" aria-label="Loading stats">
      <div className="stats-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="stats-figure" key={i}>
            <span className="skeleton skeleton-text skeleton-text-sm" />
            <span className="skeleton skeleton-text skeleton-text-lg" />
          </div>
        ))}
      </div>
      <span className="skeleton skeleton-bar" />
      <span className="skeleton skeleton-bar" />
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="detail-grid" aria-busy="true" aria-label="Loading campaign">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt>
            <span className="skeleton skeleton-text skeleton-text-sm" />
          </dt>
          <dd>
            <span className="skeleton skeleton-text" />
          </dd>
        </div>
      ))}
    </div>
  );
}
