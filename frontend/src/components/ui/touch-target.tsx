import { cn } from "@/lib/utils"

interface TouchTargetProps {
  children: React.ReactNode
  className?: string
  asChild?: boolean
}

/**
 * Wrapper that enforces 44px minimum touch target on mobile (WCAG 2.5.5).
 * On desktop (md+), dimensions revert to auto so layout is unaffected.
 */
function TouchTarget({ children, className }: TouchTargetProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[44px] min-h-[44px]",
        "md:min-w-0 md:min-h-0 md:w-auto md:h-auto",
        className
      )}
    >
      {children}
    </div>
  )
}

export { TouchTarget }
