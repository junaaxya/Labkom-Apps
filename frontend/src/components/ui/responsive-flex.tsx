import { cn } from "@/lib/utils"

interface ResponsiveFlexProps {
  children: React.ReactNode
  className?: string
}

function ResponsiveFlex({ children, className }: ResponsiveFlexProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row", className)}>
      {children}
    </div>
  )
}

export { ResponsiveFlex }
