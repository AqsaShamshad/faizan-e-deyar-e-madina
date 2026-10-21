import { DashboardContent } from "../dashboard-content";

export const instant = false;

export default async function TenantDashboardPage({ params }: PageProps<"/dashboard/[tenantId]">) {
  const { tenantId } = await params;
  return <DashboardContent requestedTenantId={tenantId} />;
}