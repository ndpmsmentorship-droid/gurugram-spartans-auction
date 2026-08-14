import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
      <nav className="mb-6 flex gap-4 border-b border-border pb-3 text-sm">
        <Link href="/admin/auction" className="font-medium hover:text-primary">
          Auction Console
        </Link>
        <Link href="/admin/players" className="font-medium hover:text-primary">
          Player Pool
        </Link>
        <Link href="/admin/owners" className="font-medium hover:text-primary">
          Team Owners
        </Link>
      </nav>
      {children}
    </div>
  );
}
