import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicScreenData } from "@/lib/public-screen";
import { InactiveScreen, PrayerScreen } from "./screen-client";

export const instant = false;

type ScreenPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ScreenPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicScreenData(slug);
  return {
    title: data.status === "active" ? `${data.tenantName} Prayer Times` : "Screen not active",
    description: data.status === "active" ? `Prayer times and announcements for ${data.tenantName}.` : "This mosque screen is not active.",
  };
}

export default async function ScreenPage({ params }: ScreenPageProps) {
  const { slug } = await params;
  if (!/^[a-z0-9]{20,30}$/.test(slug)) notFound();
  const data = await getPublicScreenData(slug);
  if (data.status !== "active") return <InactiveScreen />;
  return <PrayerScreen screenId={slug} initialData={data} />;
}