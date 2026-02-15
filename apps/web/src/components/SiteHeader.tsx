"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "./ThemeToggle"
import { cn } from "@nasty-plot/ui"
import { PECHARUNT_SPRITE_URL } from "@/lib/constants"

const NAV_LINKS = [
  { href: "/teams", label: "Teams" },
  { href: "/pokemon", label: "Pokedex" },
  { href: "/battle", label: "Battle Hub" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b bg-background/80 backdrop-blur-md border-border sticky top-0 z-50 transition-colors duration-300">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-3 text-xl font-display font-bold text-foreground group"
        >
          <div className="relative flex items-center justify-center w-8 h-8 transition-transform group-hover:scale-110 duration-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PECHARUNT_SPRITE_URL}
              alt="Pecharunt"
              width={32}
              height={32}
              className="pixelated drop-shadow-[0_0_8px_rgba(var(--primary),0.5)] z-10"
            />
            <div className="absolute inset-0 bg-primary/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          <span className="text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.6)] transition-all group-hover:drop-shadow-[0_0_15px_rgba(var(--primary),0.8)]">
            Nasty Plot
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary relative py-1",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {link.label}
                {isActive && (
                  <span className="absolute -bottom-5 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_0_10px_var(--color-primary)]" />
                )}
              </Link>
            )
          })}
          <div className="ml-2 pl-4 border-l border-border/40">
            <ThemeToggle />
          </div>
        </nav>

        {/* Mobile nav */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 border-l-primary/20">
              <SheetHeader>
                <SheetTitle className="text-left flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Navigation
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-6">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                    <Button
                      variant={pathname.startsWith(link.href) ? "secondary" : "ghost"}
                      className="w-full justify-start font-medium"
                    >
                      {link.label}
                    </Button>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
