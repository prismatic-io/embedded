import { useRouterState } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { prismaticNav, workspaceNav } from "@/lib/navigation";

function useCurrentTitle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const match = [...workspaceNav, ...prismaticNav].find(
    (item) => item.to === pathname,
  );
  return match?.title ?? "Acme SaaS";
}

export function AppHeader() {
  const title = useCurrentTitle();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <span className="text-sm font-medium">{title}</span>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 !h-4" />
        <UserMenu />
      </div>
    </header>
  );
}
