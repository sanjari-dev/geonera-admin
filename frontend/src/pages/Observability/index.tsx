import { useState } from 'react'
import { LineChart, Activity, Database, Layers, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { clsx } from 'clsx'

const TABS = [
  { id: 'grafana', label: 'Grafana Dashboards', icon: LineChart, url: 'http://192.168.1.8:3000' },
  { id: 'jaeger', label: 'Jaeger Tracing', icon: Activity, url: 'http://192.168.1.8:16686' },
  { id: 'prometheus', label: 'Prometheus Queries', icon: Database, url: 'http://192.168.1.8:9090' },
]

export default function ObservabilityPage() {
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const [loadedIframes, setLoadedIframes] = useState<Record<string, boolean>>({})

  const handleLoad = (id: string) => {
    setLoadedIframes((prev) => ({ ...prev, [id]: true }))
  }

  const activeTabObj = TABS.find((t) => t.id === activeTab)

  return (
    <div className="flex h-full flex-col overflow-hidden p-5">
      <Card
        className="flex-1 min-h-0 flex flex-col bg-[#0B0F19] border-slate-800/80 shadow-2xl relative overflow-hidden"
        bodyClassName="flex-1 min-h-0 flex flex-col"
        noPadding
      >
        {/* Sleek Tab Navigation */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/60 px-5 relative z-30">
          <div className="flex items-end gap-1.5 pt-3">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'group relative flex items-center gap-2.5 rounded-t-xl px-5 py-3 text-sm font-medium transition-all duration-300',
                    isActive
                      ? 'bg-slate-800/50 text-indigo-400'
                      : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                  )}
                >
                  {/* Active Glowing Top Border */}
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)] rounded-t-full" />
                  )}
                  
                  <Icon size={16} className={clsx('transition-transform duration-300', isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300')} />
                  <span className="tracking-wide">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {activeTabObj && (
            <a
              href={activeTabObj.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 hover:text-white transition-all duration-300 mt-2 mb-1"
            >
              <ExternalLink size={12} />
              <span>Buka di Tab Baru</span>
            </a>
          )}
        </div>

        {/* Iframe Viewport Area */}
        <div className="flex-1 relative min-h-0 w-full bg-[#0A0D14]">
          {TABS.map((tab) => (
            <div
              key={tab.id}
              className={clsx(
                'absolute inset-0 h-full w-full',
                activeTab === tab.id ? 'z-10 opacity-100 visible' : 'z-0 opacity-0 invisible'
              )}
            >
              {!loadedIframes[tab.id] && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0A0D14]">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
                  <span className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-500 animate-pulse">
                    Establishing Secure Uplink...
                  </span>
                </div>
              )}
              <iframe
                src={tab.url}
                className="h-full w-full border-0"
                title={`Observability Console: ${tab.label}`}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                onLoad={() => handleLoad(tab.id)}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
