import type { Metadata } from "next";
import { StaffLoginPage } from "@/components/admin/StaffLoginPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accesso amministratore – Il Quiz",
};

export default function AdminLoginPage() {
  return <StaffLoginPage area="admin" />;
}
