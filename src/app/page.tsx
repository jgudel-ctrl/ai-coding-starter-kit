import { redirect } from "next/navigation";

export default function RootPage() {
  // TODO(/backend): Middleware entscheidet anhand der Session:
  // angemeldet -> rollenspezifische Startseite, sonst -> /login.
  redirect("/login");
}
