import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ErrorBoundary } from './ErrorBoundary'

export interface CardProps {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** When true, inner body gets overflow-auto so content scrolls inside the card */
  scrollable?: boolean
  noPadding?: boolean
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  scrollable = false,
  noPadding = false,
}: CardProps) {
  return (
    <div
      className={twMerge(
        'glow-card flex flex-col rounded-xl border border-slate-800/80 bg-[#111520] shadow-xl',
        className
      )}
    >
      {(title || action) && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-950/20 rounded-t-xl">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div
        className={twMerge(
          clsx(
            'flex-1 min-h-0',
            scrollable && 'overflow-auto scrollbar-thin',
            !noPadding && !scrollable && 'p-4',
            scrollable && !noPadding && 'p-4'
          ),
          bodyClassName
        )}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  )
}
