import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface CardProps {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
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
        'glow-card flex flex-col rounded-xl shadow-xl',
        'border border-slate-200 dark:border-sky-900/30 shadow-sm bg-white dark:bg-[#071628]',
        className
      )}
    >
      {(title || action) && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 dark:border-sky-900/30 px-4 py-3 bg-sky-50 dark:bg-[#030C18]/50 rounded-t-xl">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-wide text-slate-800 dark:text-sky-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-sky-600 dark:text-sky-400/50">{subtitle}</p>}
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
        {children}
      </div>
    </div>
  )
}
