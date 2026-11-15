import type { Metadata } from "next";
import { PanelShell } from "@/components/admin/PanelShell";
import { requireStaffPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cassa – Il Quiz",
};

export default async function CassaPanelLayout({ children }: LayoutProps<"/cassa">) {
  const session = await requireStaffPage("cassa");
  return (
    <PanelShell variant="cassa" username={session.subject}>
      {children}
    </PanelShell>
  );
}
