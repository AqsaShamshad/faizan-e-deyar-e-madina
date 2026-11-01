import { redirect } from "next/navigation";

export const instant = false;

export default function AzanTimmingPage() {
  redirect("/dashboard/monthly-calendar");
}
