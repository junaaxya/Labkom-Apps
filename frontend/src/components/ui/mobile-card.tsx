import React from "react";
import { cn } from "@/lib/utils";

export interface MobileCardField {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}

export interface MobileCardAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "danger" | "secondary" | "warning" | "success";
  disabled?: boolean;
}

interface MobileCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  fields: MobileCardField[];
  actions?: MobileCardAction[];
  className?: string;
  onClick?: () => void;
}

const ACTION_VARIANT_CLASSES: Record<NonNullable<MobileCardAction["variant"]>, string> = {
  primary: "bg-[#4b607f] text-white hover:bg-[#3d5069]",
  danger: "bg-red-600 text-white hover:bg-red-700",
  secondary: "bg-white text-[#1a1a1a] hover:bg-[#e8d8c9]",
  warning: "bg-[#f3701e] text-white hover:bg-[#e05b0c]",
  success: "bg-green-600 text-white hover:bg-green-700",
};

export function MobileCard({
  title,
  subtitle,
  badge,
  fields,
  actions,
  className,
  onClick,
}: MobileCardProps) {
  return (
    <div
      className={cn(
        "neo-card bg-white overflow-hidden",
        onClick && "cursor-pointer active:scale-[0.99] transition-transform",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 p-4 border-b-2 border-[#1a1a1a]/10 bg-[#f5ede6]">
        <div className="min-w-0 flex-1">
          <div className="font-heading font-bold text-[#1a1a1a] text-base leading-tight truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-[#5a5a5a] mt-0.5 truncate">{subtitle}</div>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {fields.map((field, i) => (
          <div key={i} className={cn("min-w-0", field.fullWidth && "col-span-2")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5a5a5a] mb-0.5">
              {field.label}
            </p>
            <div className="text-sm font-medium text-[#1a1a1a] break-words">{field.value}</div>
          </div>
        ))}
      </div>

      {actions && actions.length > 0 && (
        <div className="px-4 pb-4 border-t-2 border-[#1a1a1a]/10 pt-3">
          <div className={cn(
            "grid gap-2",
            actions.length === 1 && "grid-cols-1",
            actions.length === 2 && "grid-cols-2",
            actions.length >= 3 && "grid-cols-2 sm:grid-cols-3"
          )}>
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                disabled={action.disabled}
                className={cn(
                  "neo-btn flex items-center justify-center gap-1.5 py-2.5 px-3 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]",
                  ACTION_VARIANT_CLASSES[action.variant ?? "secondary"]
                )}
              >
                {action.icon}
                <span className="truncate">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
