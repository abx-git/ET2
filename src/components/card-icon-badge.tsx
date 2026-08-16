"use client";

import {
  AlertTriangle,
  Bug,
  CircleCheck,
  CircleHelp,
  Info,
  Lightbulb,
  ShieldAlert,
  Star,
  type LucideIcon,
} from "lucide-react";

import { cardIconOption, type CardIconId } from "@/lib/card-icon";

const ICON_BY_ID: Record<CardIconId, LucideIcon> = {
  info: Info,
  question: CircleHelp,
  warning: AlertTriangle,
  idea: Lightbulb,
  decision: CircleCheck,
  important: Star,
  risk: ShieldAlert,
  bug: Bug,
};

export interface CardIconBadgeProps {
  icon: CardIconId | undefined;
  /** kompakt für Listen/Canvas-Titel */
  size?: "sm" | "md";
  className?: string;
}

/** Statusicon vor dem Kartentitel. */
export function CardIconBadge({ icon, size = "sm", className = "" }: CardIconBadgeProps) {
  const opt = cardIconOption(icon);
  if (!opt || !icon) return null;
  const Icon = ICON_BY_ID[icon];
  const px = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const iconPx = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full ring-1",
        px,
        opt.toneClass,
        className,
      ].join(" ")}
      title={opt.label}
      aria-label={opt.label}
    >
      <Icon className={iconPx} aria-hidden strokeWidth={2.25} />
    </span>
  );
}
