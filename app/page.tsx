import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";

export const instant = false;

export default async function HomePage() {
  const session = await auth();
  if (session?.user) notFound();
  redirect("/login");
}