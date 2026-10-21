export default function DashboardLoading() {
  return (
    <main className="admin-main dashboard-skeleton" aria-label="Loading mosque dashboard" aria-busy="true">
      <span className="skeleton-line" style={{ width: "35%", height: 26 }} />
      <span className="skeleton-line" style={{ width: "58%" }} />
      <div className="skeleton-block" />
      <div className="skeleton-block" />
      <div className="skeleton-block" />
    </main>
  );
}