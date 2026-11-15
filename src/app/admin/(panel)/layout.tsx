import type { Metadata } from "next";
import { PanelShell } from "@/components/admin/PanelShell";
import { requireStaffPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pannello amministratore – Il Quiz",
};

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireStaffPage("admin");
  return (
    <PanelShell variant="admin" username={session.subject}>
      {children}
    </PanelShell>
  );
}
