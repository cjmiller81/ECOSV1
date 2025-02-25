"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home, CircleDollarSign } from "lucide-react";

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean;
}

export function SidebarNav({ className, isCollapsed, ...props }: SidebarNavProps) {
  const pathname = usePathname();

  const routes = [
    {
      label: "Dashboard",
      icon: Home,
      href: "/",
      active: pathname === "/",
    },
    {
      label: "Position",
      icon: CircleDollarSign,
      href: "/position",
      active: pathname === "/position",
    },
  ];

  return (
    <ScrollArea className="h-full py-6">
      <div className={cn("space-y-1 px-2", isCollapsed && "px-1")}>
        {routes.map((route) => (
          <Button
            key={route.href}
            variant={route.active ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start",
              route.active && "bg-muted",
              isCollapsed ? "px-2" : "px-4"
            )}
            asChild
          >
            <Link href={route.href} className="flex items-center gap-2">
              <route.icon className="h-4 w-4" />
              {!isCollapsed && <span>{route.label}</span>}
            </Link>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}