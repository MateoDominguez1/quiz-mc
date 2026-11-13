import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pannello amministratore – Il Quiz del Giorno",
};

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdminPage();
  return <AdminShell username={session.username}>{children}</AdminShell>;
}
