import { cn } from "@/lib/utils"

interface ResponsiveListProps {
  mobileCard: React.ReactNode
  desktopTable: React.ReactNode
  showTable?: boolean
  className?: string
}

function ResponsiveList({
  mobileCard,
  desktopTable,
  showTable = false,
  className,
}: ResponsiveListProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className={cn("md:hidden", showTable && "hidden")}>
        {mobileCard}
      </div>
      <div className={cn("hidden md:block", showTable && "block")}>
        {desktopTable}
      </div>
    </div>
  )
}

export { ResponsiveList }
