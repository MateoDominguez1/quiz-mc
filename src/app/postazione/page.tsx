import type { Metadata } from "next";
import { StaffLoginPage } from "@/components/admin/StaffLoginPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Postazione – Il Quiz",
};

export default function StationLoginPage() {
  return <StaffLoginPage area="postazione" />;
}
