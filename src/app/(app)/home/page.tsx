import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start — TMS 2.0",
};

export default function HomePage() {
  redirect("/dashboard");
}
