"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import ThemePicker from "./ThemePicker";

const links = [
  { href: "/dashboard/teams", label: "Teams", icon: TeamIcon },
  { href: "/dashboard/settings", label: "Notifications", icon: BellIcon },
  { href: "/dashboard/account", label: "Account", icon: UserIcon },
];

export default function Sidebar({
  displayName, email,
}: { displayName: string | null; email: string }) {
  const path = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface px-4 py-6 hidden md:flex flex-col">
      <Link href="/dashboard/teams" className="px-2 mb-6">
        <span className="text-base font-semibold tracking-tight">Office Reminder</span>
      </Link>
      <nav className="flex flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link key={href} href={href}
                  className={`nav-link ${active ? "nav-link-active" : ""}`}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-border space-y-3">
        <ThemePicker />
        <div className="px-2">
          <p className="text-sm font-medium truncate">{displayName ?? email}</p>
          <p className="text-xs text-subtle truncate">{email}</p>
        </div>
        <button onClick={logout} className="btn-ghost w-full justify-start">
          <LogoutIcon className="w-4 h-4" /> Log out
        </button>
      </div>
    </aside>
  );
}

function TeamIcon(p: any) {
  return (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
    <circle cx="7" cy="7" r="3" /><circle cx="14" cy="9" r="2.5" />
    <path d="M2 16c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" /><path d="M12 16c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5" />
  </svg>);
}
function BellIcon(p: any) {
  return (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
    <path d="M5 8a5 5 0 0 1 10 0v3l1.5 2.5h-13L5 11Z" /><path d="M8 16a2 2 0 0 0 4 0" />
  </svg>);
}
function UserIcon(p: any) {
  return (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
    <circle cx="10" cy="7" r="3.2" /><path d="M3.5 17c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5" />
  </svg>);
}
function LogoutIcon(p: any) {
  return (<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
    <path d="M12 15v2H4V3h8v2" /><path d="M9 10h10m0 0-3-3m3 3-3 3" />
  </svg>);
}
