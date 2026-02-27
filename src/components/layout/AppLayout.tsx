import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col relative">
          {/* Immersive background for main content */}
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(43,74%,49%,0.03)_0%,_transparent_60%)]" />
            <div className="absolute inset-0 bg-grid-pattern opacity-20" />
          </div>
          <header className="sticky top-0 z-40 h-12 glass-strong flex items-center px-4 gap-4">
            <SidebarTrigger className="text-muted-foreground hover:text-primary transition-colors" />
          </header>
          <main className="flex-1 p-6 overflow-auto relative z-10">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
