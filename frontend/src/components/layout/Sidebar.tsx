import { NavLink } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Cpu,
  LayoutDashboard,
  Settings2,
  TrendingUp,
  LineChart,
} from 'lucide-react'
import { clsx } from 'clsx'

const NAV = [
  { to: '/dashboard',   label: 'Dashboard',         icon: LayoutDashboard },
  { to: '/instruments', label: 'Instruments',        icon: Settings2 },
  { to: '/states',      label: 'State Monitor',      icon: Activity },
  { to: '/progress',    label: 'Ingestion Progress', icon: TrendingUp },
  { to: '/control',     label: 'Control Center',     icon: Cpu },
  { to: '/observability',label: 'Observability',     icon: LineChart },
]

export default function Sidebar() {
  return (
    <div className="flex h-full w-full flex-col bg-[#0A0D14] border-r border-slate-800/60 shadow-2xl relative z-20">
      {/* Logo */}
      <div className="flex h-16 flex-shrink-0 items-center gap-3.5 border-b border-slate-800/60 px-6 bg-gradient-to-b from-slate-900/40 to-transparent">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-indigo-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          <BarChart3 size={18} className="text-indigo-400 relative z-10" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-bold tracking-wide text-slate-100 uppercase">Geonera</p>
          <p className="text-[10px] font-medium tracking-widest text-indigo-400/80 uppercase">Cockpit</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-5 custom-scrollbar">
        <ul className="space-y-1.5 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'group relative flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ease-out overflow-hidden',
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active Indicator Glow */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-3/4 w-1 -translate-y-1/2 rounded-r-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                    )}
                    
                    {/* Hover Background Sweep */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-800/0 via-slate-800/10 to-slate-800/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                    
                    <Icon 
                      size={18} 
                      strokeWidth={isActive ? 2.5 : 2} 
                      className={clsx(
                        'relative z-10 transition-transform duration-300',
                        isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:scale-110 group-hover:text-slate-300'
                      )} 
                    />
                    <span className="relative z-10 tracking-wide">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-slate-800/60 px-6 py-4 bg-[#0A0D14]">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">System Online</p>
        </div>
        <p className="text-[10px] font-medium tracking-wider text-slate-600 font-mono">v1.0.0-rc.4</p>
      </div>
    </div>
  )
}
