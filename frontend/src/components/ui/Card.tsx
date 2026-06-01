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
        'glow-card geonera-card flex flex-col rounded-xl',
        className
      )}
    >
      {(title || action) && (
        <div className="geonera-card-header flex flex-shrink-0 items-center justify-between border-b px-4 py-3 rounded-t-xl">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-wide text-sky-950 dark:text-sky-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-sky-700 dark:text-sky-300/70">{subtitle}</p>}
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
