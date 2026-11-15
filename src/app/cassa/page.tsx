import type { Metadata } from "next";
import { StaffLoginPage } from "@/components/admin/StaffLoginPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accesso cassa – Il Quiz",
  robots: { index: false, follow: false },
};

export default function CassaLoginPage() {
  return <StaffLoginPage area="cassa" />;
}
