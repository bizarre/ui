import type React from 'react'
import { useEffect, useState, useRef } from 'react'
import {
  Github,
  ExternalLink,
  Clock,
  TextCursorInput,
  Copy as CopyIcon,
  Check as CheckIcon,
  Link as LinkIcon
} from 'lucide-react'
import packageJson from '../../../package.json'

function BackgroundGrid({ visible }: { visible: boolean }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        opacity: visible ? 0.6 : 0,
        transition: 'opacity 160ms ease',
        backgroundImage:
          'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }}
    />
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center border border-zinc-300 rounded-[2px] bg-white text-zinc-700 px-1.5 h-6 text-[11px] font-medium tracking-tight transition-transform will-change-transform hover:-translate-y-0.5">
      {children}
    </span>
  )
}

function Divider() {
  return <div className="h-px w-full bg-zinc-200" />
}

type Accent = 'emerald' | 'violet' | 'zinc'

function accentBarClass(accent?: Accent) {
  switch (accent) {
    case 'emerald':
      return 'from-emerald-400/60 to-teal-400/60'
    case 'violet':
      return 'from-violet-500/60 to-blue-500/60'
    default:
      return 'from-zinc-300 to-zinc-300'
  }
}

function Panel({
  title,
  subtitle,
  icon,
  tag,
  accent,
  children
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  tag?: string
  accent?: Accent
  children?: React.ReactNode
}) {
  return (
    <section className="relative border border-zinc-200 rounded-[2px] bg-white">
      <div
        className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${accentBarClass(accent)}`}
      />
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          {icon ? (
            <div className="text-zinc-700" aria-hidden>
              {icon}
            </div>
          ) : null}
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-zinc-900 leading-none tracking-tight">
              {title}
            </h3>
            {subtitle ? (
              <p className="text-[11px] text-zinc-500 leading-snug">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {tag ? (
          <span className="text-[10px] leading-none text-zinc-600 border border-zinc-300 rounded-[2px] px-1.5 py-0.5 bg-zinc-50">
            {tag}
          </span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Terminal({
  lines,
  label = 'shell',
  showCaret = true
}: {
  lines: string[]
  label?: string
  showCaret?: boolean
}) {
  return (
    <div className="border border-zinc-200 rounded-[2px] bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="inline-block h-2 w-2 border border-zinc-300 rounded-[2px] bg-zinc-50" />
          <span className="inline-block h-2 w-2 border border-zinc-300 rounded-[2px] bg-zinc-50" />
          <span className="inline-block h-2 w-2 border border-zinc-300 rounded-[2px] bg-zinc-50" />
        </div>
        <div className="text-[10px] text-zinc-500">{label}</div>
      </div>
      <div className="font-mono text-[12px] leading-relaxed p-3 bg-zinc-50 text-zinc-800">
        {lines.map((l, i) => {
          const isLast = i === lines.length - 1
          return (
            <div key={i} className="flex items-center">
              <span className="select-none text-zinc-400 mr-2">$</span>
              <span className="break-all">{l}</span>
              {showCaret && isLast ? (
                <span className="ml-1 inline-block w-[7px] h-[12px] bg-zinc-500/70 animate-pulse" />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Placeholder({
  label,
  height = 420
}: {
  label: string
  height?: number
}) {
  return (
    <div
      className="border border-zinc-200 rounded-[2px] bg-zinc-50 grid place-items-center text-zinc-400 font-mono text-[11px] relative"
      style={{ height }}
    >
      {label}
    </div>
  )
}

function AnnotatedPlaceholder({
  label,
  height = 420,
  markers
}: {
  label: string
  height?: number
  markers: Array<{ xPercent: number; yPercent: number; label: string }>
}) {
  return (
    <div className="relative">
      <Placeholder label={label} height={height} />
      {markers.map((m, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2 h-5 w-5 grid place-items-center text-[10px] font-medium text-zinc-800 bg-white border border-zinc-300 rounded-[2px]"
          style={{ left: `${m.xPercent}%`, top: `${m.yPercent}%` }}
        >
          {i + 1}
        </div>
      ))}
    </div>
  )
}

function Code({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    },
    []
  )
  return (
    <div className="relative">
      <button
        onClick={() => {
          navigator.clipboard.writeText(code)
          setCopied(true)
          timeoutRef.current = window.setTimeout(() => setCopied(false), 1200)
        }}
        className="absolute top-2 right-2 inline-flex items-center gap-1 text-[11px] h-7 px-2 border border-zinc-200 rounded-[2px] bg-white hover:bg-zinc-50 transition-colors"
        aria-label="Copy code"
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5 text-zinc-600" />
        )}
        <span className="text-zinc-700">{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <div className="bg-zinc-50 border border-zinc-200 rounded-[2px] p-3 font-mono text-[12px] text-zinc-800 whitespace-pre overflow-x-auto">
        {code}
      </div>
    </div>
  )
}

function InlineCodeCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    },
    []
  )
  return (
    <div className="relative inline-flex items-center gap-2">
      <code className="inline-flex items-center bg-zinc-50 border border-zinc-200 rounded-[2px] px-2 py-1 font-mono text-[12px] text-zinc-800 whitespace-nowrap">
        {text}
      </code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(text)
          setCopied(true)
          timeoutRef.current = window.setTimeout(() => setCopied(false), 1200)
        }}
        className="inline-flex items-center gap-1 text-[11px] h-7 px-2 border border-zinc-200 rounded-[2px] bg-white hover:bg-zinc-50 transition-colors"
        aria-label="Copy"
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5 text-zinc-600" />
        )}
        <span className="text-zinc-700">{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  )
}

function SectionHeading({
  id,
  index,
  icon,
  title,
  badge
}: {
  id: string
  index: string
  icon: React.ReactNode
  title: string
  badge: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between mb-3 group">
      <h2 className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
        <span className="text-[10px] text-zinc-600 border border-zinc-300 rounded-[2px] px-1 py-0.5">
          {index}
        </span>
        {icon}
        {title}
        <button
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}#${id}`
            navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center h-6 px-1 text-[11px] border border-zinc-200 rounded-[2px] ml-1"
          aria-label="Copy link"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <LinkIcon className="h-3.5 w-3.5 text-zinc-600" />
          )}
        </button>
      </h2>
      {badge}
    </div>
  )
}

function Figure({
  number,
  title,
  children
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="w-full">
      {children}
      <div className="mt-2 text-[11px] text-zinc-600">
        <span className="font-mono">Figure {number}.</span> {title}
      </div>
    </div>
  )
}

function ApiTable({
  rows
}: {
  rows: Array<{ name: string; type: string; def?: string; desc: string }>
}) {
  return (
    <div className="border border-zinc-200 rounded-[2px] overflow-hidden">
      <div className="grid grid-cols-12 bg-zinc-50 border-b border-zinc-200 text-[11px] text-zinc-600">
        <div className="col-span-3 px-2 py-2">Prop</div>
        <div className="col-span-3 px-2 py-2">Type</div>
        <div className="col-span-2 px-2 py-2 text-right">Default</div>
        <div className="col-span-4 px-2 py-2">Description</div>
      </div>
      <div>
        {rows.map((r) => (
          <div
            key={r.name}
            className="grid grid-cols-12 text-[12px] border-b last:border-b-0 border-dashed border-zinc-200"
          >
            <div className="col-span-3 px-2 py-2 flex items-center gap-1">
              <code className="font-mono text-zinc-800">{r.name}</code>
              <button
                onClick={() => navigator.clipboard.writeText(r.name)}
                className="inline-flex items-center h-6 px-1 border border-zinc-200 rounded-[2px]"
                aria-label="Copy prop"
              >
                <CopyIcon className="h-3.5 w-3.5 text-zinc-600" />
              </button>
            </div>
            <div className="col-span-3 px-2 py-2">
              <code className="font-mono text-[11px] text-zinc-700">
                {r.type}
              </code>
            </div>
            <div className="col-span-2 px-2 py-2 text-right text-zinc-700">
              {r.def ?? '—'}
            </div>
            <div className="col-span-4 px-2 py-2 text-zinc-700">{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoTable({
  rows
}: {
  rows: Array<{ label: string; value: React.ReactNode }>
}) {
  return (
    <div className="border border-zinc-200 rounded-[2px] overflow-hidden">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`grid grid-cols-5 text-[12px] ${i !== rows.length - 1 ? 'border-b border-dashed border-zinc-200' : ''}`}
        >
          <div className="col-span-2 px-2 py-2 text-[11px] text-zinc-600">
            {r.label}
          </div>
          <div className="col-span-3 px-2 py-2 text-zinc-800">{r.value}</div>
        </div>
      ))}
    </div>
  )
}

function AnchorRail({ activeId }: { activeId: string }) {
  return (
    <nav className="hidden lg:flex lg:flex-col gap-1 text-[11px] text-zinc-600 sticky top-16">
      <a
        href="#overview"
        className={`px-2 py-1 border rounded-[2px] hover:bg-zinc-50 transition-colors ${
          activeId === 'overview'
            ? 'border-zinc-400 bg-zinc-50 text-zinc-800'
            : 'border-zinc-200'
        }`}
      >
        Overview
      </a>
      <a
        href="#inlay"
        className={`px-2 py-1 border rounded-[2px] hover:bg-zinc-50 transition-colors ${
          activeId === 'inlay'
            ? 'border-emerald-400/60 bg-emerald-50/40 text-zinc-800'
            : 'border-zinc-200'
        }`}
      >
        Inlay
      </a>
      <a
        href="#chrono"
        className={`px-2 py-1 border rounded-[2px] hover:bg-zinc-50 transition-colors ${
          activeId === 'chrono'
            ? 'border-violet-500/60 bg-violet-50/40 text-zinc-800'
            : 'border-zinc-200'
        }`}
      >
        Chrono
      </a>
    </nav>
  )
}

function useActiveSection(ids: string[]) {
  const [activeId, setActiveId] = useState(ids[0] || '')
  useEffect(() => {
    const observers: IntersectionObserver[] = []
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActiveId(id)
          })
        },
        { rootMargin: '-30% 0px -60% 0px', threshold: [0, 0.2, 0.5, 1] }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [ids])
  return activeId
}

function useScrollProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const handler = () => {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop
      const scrollHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight
      const p = scrollHeight > 0 ? scrollTop / scrollHeight : 0
      setProgress(p)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  return progress
}

function ApiEventsTabs({
  propsRows,
  eventRows,
  accent
}: {
  propsRows: Array<{ name: string; type: string; def?: string; desc: string }>
  eventRows: Array<{ name: string; type: string; def?: string; desc: string }>
  accent: 'emerald' | 'violet' | 'zinc'
}) {
  const [tab, setTab] = useState<'props' | 'events'>('props')
  const accentBorder =
    accent === 'emerald'
      ? 'border-emerald-300'
      : accent === 'violet'
        ? 'border-violet-300'
        : 'border-zinc-300'
  return (
    <div className="border border-zinc-200 rounded-[2px]">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-zinc-200">
        <button
          onClick={() => setTab('props')}
          className={`text-[11px] h-7 px-2 rounded-[2px] border ${tab === 'props' ? accentBorder + ' bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50'}`}
        >
          Props
        </button>
        <button
          onClick={() => setTab('events')}
          className={`text-[11px] h-7 px-2 rounded-[2px] border ${tab === 'events' ? accentBorder + ' bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50'}`}
        >
          Events
        </button>
      </div>
      <div className="p-2">
        <ApiTable
          rows={(tab === 'props' ? propsRows : eventRows).map((r) => ({
            ...r,
            type: r.type
          }))}
        />
      </div>
    </div>
  )
}

function SpecRail({
  sections
}: {
  sections: Array<{
    title: string
    rows: Array<{ label: string; value: React.ReactNode }>
  }>
}) {
  return (
    <div className="border border-zinc-200 rounded-[2px] overflow-hidden">
      {sections.map((s, i) => (
        <div
          key={i}
          className={`${i !== 0 ? 'border-t border-dashed border-zinc-200' : ''}`}
        >
          <div className="px-3 py-2 text-[11px] text-zinc-600 border-b border-zinc-200 bg-zinc-50">
            {s.title}
          </div>
          <InfoTable rows={s.rows} />
        </div>
      ))}
    </div>
  )
}

export default function Page() {
  const activeId = useActiveSection(['overview', 'inlay', 'chrono'])
  const progress = useScrollProgress()
  const [showGrid, setShowGrid] = useState(false)
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-zinc-200 z-50">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-violet-500"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>
      <BackgroundGrid visible={showGrid} />
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold tracking-tight">
              @bizarre/<span className="text-zinc-700">ui</span>
            </div>
            <div className="text-[11px] text-zinc-600 border border-zinc-300 rounded-[2px] px-1.5 py-0.5 bg-zinc-50">
              v{packageJson.version}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[11px] text-zinc-600">
              {activeId === 'overview'
                ? 'Overview'
                : activeId === 'inlay'
                  ? 'Inlay'
                  : 'Chrono'}
            </span>
            <button
              onClick={() => setShowGrid((v) => !v)}
              className={`inline-flex items-center gap-1 text-[11px] h-8 px-2 border rounded-[2px] ${showGrid ? 'border-zinc-400 bg-zinc-50' : 'border-zinc-200'} hover:bg-zinc-50`}
            >
              <span>Grid</span>
            </button>
            <a
              href="/storybook"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 h-8 border border-zinc-200 rounded-[2px] hover:bg-zinc-50"
            >
              <span>Storybook</span>
              <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
            </a>
            <a
              href="https://github.com/bizarre/ui"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 h-8 border border-zinc-200 rounded-[2px] hover:bg-zinc-50"
            >
              <Github className="h-3.5 w-3.5 text-zinc-700" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <section id="overview" className="mt-2">
          <div className="relative border border-zinc-200 rounded-[2px] bg-white p-4">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-zinc-200" />
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-zinc-600 border border-zinc-300 rounded-[2px] px-1 py-0.5">
                    00
                  </span>
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
                    @bizarre/ui
                  </h2>
                </div>
                <p className="text-sm text-zinc-700 mb-1">
                  Focused building blocks for edge‑case UX.
                </p>
                <p className="text-[11px] text-zinc-500">
                  Two modules, designed for speed and clarity.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <InlineCodeCopy
                    text={`import { Inlay, Chrono } from '@bizarre/ui'`}
                  />
                  <div className="flex gap-2">
                    <a
                      href="/storybook"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 h-8 border border-zinc-200 rounded-[2px] bg-white hover:bg-zinc-50 active:scale-[0.98]"
                    >
                      <span>Storybook</span>
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                    </a>
                    <a
                      href="https://github.com/bizarre/ui"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 h-8 border border-zinc-200 rounded-[2px] bg-white hover:bg-zinc-50 active:scale-[0.98]"
                    >
                      <Github className="h-3.5 w-3.5 text-zinc-700" />
                      <span>GitHub</span>
                    </a>
                  </div>
                </div>
              </div>
              <div className="md:col-span-5">
                <div className="border border-zinc-200 rounded-[2px]">
                  <div className="grid grid-cols-2 text-[11px] text-zinc-600 px-3 py-2 border-b border-dashed border-zinc-200">
                    <span>Version</span>
                    <span className="text-right text-[12px] text-zinc-800">
                      v{packageJson.version}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 text-[11px] text-zinc-600 px-3 py-2 border-b border-dashed border-zinc-200">
                    <span>Stack</span>
                    <span className="text-right text-[12px] text-zinc-800">
                      React + Vike · Bun
                    </span>
                  </div>
                  <div className="grid grid-cols-2 text-[11px] text-zinc-600 px-3 py-2">
                    <span>License</span>
                    <span className="text-right text-[12px] text-zinc-800">
                      {(packageJson as { license?: string }).license ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-12 gap-6 mt-8 sm:mt-12">
          <div className="col-span-12 lg:col-span-2">
            {activeId !== 'overview' ? (
              <AnchorRail activeId={activeId} />
            ) : null}
          </div>
          <div className="col-span-12 lg:col-span-10">
            <section id="inlay" className="mt-0 relative">
              {/* Vertical spine linking heading to spec rail */}
              <div
                className="absolute top-10 bottom-0 w-[2px] bg-zinc-200 hidden xl:block"
                style={{ left: 'calc((100% / 12) * 8)' }}
              />
              <SectionHeading
                id="inlay"
                index="01"
                icon={<TextCursorInput className="h-4 w-4 text-zinc-700" />}
                title="Inlay"
                badge={
                  <div className="text-[10px] text-zinc-600 border border-emerald-300 rounded-[2px] px-1.5 py-0.5 bg-emerald-50">
                    Component
                  </div>
                }
              />
              <Divider />
              <div className="grid grid-cols-12 gap-6 mt-4">
                {/* Left lane: Exhibit (A), Mechanics (B), Interfaces (C) */}
                <div className="col-span-12 xl:col-span-8 space-y-3">
                  {/* Band A: Exhibit */}
                  <Figure number={1} title="Inlay — structured input demo">
                    <Panel
                      title="Demo"
                      subtitle="Structured text input"
                      tag="Preview"
                      accent="emerald"
                    >
                      <AnnotatedPlaceholder
                        label="INLAY DEMO (placeholder)"
                        markers={[
                          { xPercent: 20, yPercent: 35, label: 'Segment' },
                          { xPercent: 65, yPercent: 55, label: 'Token menu' },
                          { xPercent: 85, yPercent: 25, label: 'Caret' }
                        ]}
                      />
                    </Panel>
                  </Figure>
                  <div className="mt-2 text-[11px] text-zinc-600 max-w-prose">
                    <ul className="list-disc list-outside pl-5 space-y-1 marker:text-zinc-400">
                      <li>(1) Segment selection and movement</li>
                      <li>(2) Token insertion and suggestions</li>
                      <li>(3) Cursor position</li>
                    </ul>
                  </div>
                  {/* Band B: Mechanics drawer */}
                  <div
                    className="border border-zinc-200 rounded-[2px] overflow-hidden"
                    style={{
                      backgroundImage:
                        'linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px)',
                      backgroundSize: '100% 24px'
                    }}
                  >
                    <div className="px-3 py-2 text-[11px] text-zinc-600 border-b border-zinc-200 bg-zinc-50">
                      Interaction map
                    </div>
                    <div className="grid grid-cols-12 bg-white">
                      <div className="col-span-3 px-2 py-2 text-[11px] text-zinc-600">
                        Key
                      </div>
                      <div className="col-span-3 px-2 py-2 text-[11px] text-zinc-600">
                        Scope
                      </div>
                      <div className="col-span-6 px-2 py-2 text-[11px] text-zinc-600">
                        Effect
                      </div>
                      <div className="col-span-3 px-2 py-2">
                        <Kbd>→</Kbd>
                      </div>
                      <div className="col-span-3 px-2 py-2">Segment</div>
                      <div className="col-span-6 px-2 py-2">
                        Move to next segment
                      </div>
                      <div className="col-span-3 px-2 py-2">
                        <Kbd>←</Kbd>
                      </div>
                      <div className="col-span-3 px-2 py-2">Segment</div>
                      <div className="col-span-6 px-2 py-2">
                        Move to previous segment
                      </div>
                      <div className="col-span-3 px-2 py-2">
                        <Kbd>Tab</Kbd>
                      </div>
                      <div className="col-span-3 px-2 py-2">Global</div>
                      <div className="col-span-6 px-2 py-2">
                        Jump to next focusable
                      </div>
                    </div>
                  </div>
                  {/* Band C: Interfaces (API/Events tabs) */}
                  <ApiEventsTabs
                    accent="emerald"
                    propsRows={[
                      {
                        name: 'value',
                        type: 'string',
                        desc: 'Current input value'
                      },
                      {
                        name: 'onChange',
                        type: '(v: string) => void',
                        desc: 'Change handler'
                      },
                      {
                        name: 'tokens',
                        type: 'Array<Token>',
                        desc: 'Available token components'
                      },
                      {
                        name: 'placeholder',
                        type: 'string',
                        def: '""',
                        desc: 'Input placeholder'
                      }
                    ]}
                    eventRows={[
                      {
                        name: 'onTokenAdd',
                        type: '(token: Token) => void',
                        desc: 'When a token is created'
                      },
                      {
                        name: 'onTokenRemove',
                        type: '(token: Token) => void',
                        desc: 'When a token is removed'
                      }
                    ]}
                  />
                </div>
                {/* Right lane: continuous Spec Rail */}
                <div className="col-span-12 xl:col-span-4">
                  <SpecRail
                    sections={[
                      {
                        title: 'Spec',
                        rows: [
                          { label: 'Type', value: 'Input' },
                          { label: 'Domain', value: 'Structured text' },
                          { label: 'Tokenization', value: 'Component-driven' },
                          { label: 'Parsing', value: 'Pluggable' },
                          { label: 'Status', value: 'Beta' }
                        ]
                      },
                      {
                        title: 'Accessibility',
                        rows: [
                          {
                            label: 'Role',
                            value: (
                              <code className="font-mono text-[11px]">
                                textbox
                              </code>
                            )
                          },
                          { label: 'Name', value: 'Label or aria-label' },
                          {
                            label: 'Keyboard',
                            value: 'Arrow navigation, Tab jump'
                          }
                        ]
                      },
                      {
                        title: 'Performance',
                        rows: [
                          { label: 'Bundle target', value: '< 8KB gz' },
                          { label: 'Interaction', value: '< 16ms key handling' }
                        ]
                      },
                      {
                        title: 'Links',
                        rows: [
                          {
                            label: 'Storybook',
                            value: (
                              <a
                                href="/storybook"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                Open
                              </a>
                            )
                          },
                          {
                            label: 'Repository',
                            value: (
                              <a
                                href="https://github.com/bizarre/ui"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                GitHub
                              </a>
                            )
                          }
                        ]
                      }
                    ]}
                  />
                </div>
              </div>
            </section>

            <section id="chrono" className="mt-12 relative">
              <div
                className="absolute top-10 bottom-0 w-[2px] bg-zinc-200 hidden xl:block"
                style={{ left: 'calc((100% / 12) * 8)' }}
              />
              <SectionHeading
                id="chrono"
                index="02"
                icon={<Clock className="h-4 w-4 text-zinc-700" />}
                title="Chrono"
                badge={
                  <div className="text-[10px] text-zinc-600 border border-violet-400 rounded-[2px] px-1.5 py-0.5 bg-violet-50">
                    Component
                  </div>
                }
              />
              <Divider />
              <div className="grid grid-cols-12 gap-6 mt-4">
                <div className="col-span-12 xl:col-span-8 space-y-3">
                  <Figure number={2} title="Chrono — time range picker demo">
                    <Panel
                      title="Demo"
                      subtitle="Time range picker"
                      tag="Preview"
                      accent="violet"
                    >
                      <AnnotatedPlaceholder
                        label="CHRONO DEMO (placeholder)"
                        markers={[
                          { xPercent: 30, yPercent: 35, label: 'Start' },
                          { xPercent: 70, yPercent: 35, label: 'End' },
                          { xPercent: 50, yPercent: 75, label: 'Preset menu' }
                        ]}
                      />
                    </Panel>
                  </Figure>
                  <div className="mt-2 text-[11px] text-zinc-600 max-w-prose">
                    <ul className="list-disc list-outside pl-5 space-y-1 marker:text-zinc-400">
                      <li>(1) Start date field</li>
                      <li>(2) End date field</li>
                      <li>(3) Preset selector</li>
                    </ul>
                  </div>
                  <div
                    className="border border-zinc-200 rounded-[2px] overflow-hidden"
                    style={{
                      backgroundImage:
                        'linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px)',
                      backgroundSize: '100% 24px'
                    }}
                  >
                    <div className="px-3 py-2 text-[11px] text-zinc-600 border-b border-zinc-200 bg-zinc-50">
                      Interaction map
                    </div>
                    <div className="grid grid-cols-12 bg-white">
                      <div className="col-span-3 px-2 py-2 text-[11px] text-zinc-600">
                        Key
                      </div>
                      <div className="col-span-3 px-2 py-2 text-[11px] text-zinc-600">
                        Scope
                      </div>
                      <div className="col-span-6 px-2 py-2 text-[11px] text-zinc-600">
                        Effect
                      </div>
                      <div className="col-span-3 px-2 py-2">
                        <Kbd>→</Kbd>/<Kbd>←</Kbd>
                      </div>
                      <div className="col-span-3 px-2 py-2">Field</div>
                      <div className="col-span-6 px-2 py-2">
                        Navigate fields
                      </div>
                      <div className="col-span-3 px-2 py-2">
                        <Kbd>↑</Kbd>/<Kbd>↓</Kbd>
                      </div>
                      <div className="col-span-3 px-2 py-2">Field</div>
                      <div className="col-span-6 px-2 py-2">Adjust values</div>
                      <div className="col-span-3 px-2 py-2">
                        <Kbd>Enter</Kbd>
                      </div>
                      <div className="col-span-3 px-2 py-2">Global</div>
                      <div className="col-span-6 px-2 py-2">
                        Confirm selection
                      </div>
                    </div>
                  </div>
                  <ApiEventsTabs
                    accent="violet"
                    propsRows={[
                      {
                        name: 'value',
                        type: '{ from: Date; to: Date }',
                        desc: 'Selected range'
                      },
                      {
                        name: 'onChange',
                        type: '(r: { from: Date; to: Date }) => void',
                        desc: 'Change handler'
                      },
                      {
                        name: 'presets',
                        type: 'Array<string>',
                        desc: 'Available presets'
                      },
                      {
                        name: 'timezone',
                        type: 'string',
                        def: 'local',
                        desc: 'Display timezone'
                      }
                    ]}
                    eventRows={[
                      {
                        name: 'onPresetSelect',
                        type: '(name: string) => void',
                        desc: 'When a preset is chosen'
                      },
                      {
                        name: 'onInputFocus',
                        type: '(field: "from" | "to") => void',
                        desc: 'When a field receives focus'
                      }
                    ]}
                  />
                </div>
                <div className="col-span-12 xl:col-span-4">
                  <SpecRail
                    sections={[
                      {
                        title: 'Spec',
                        rows: [
                          { label: 'Type', value: 'Picker' },
                          { label: 'Domain', value: 'Time ranges' },
                          {
                            label: 'Language',
                            value: 'Natural language parsing'
                          },
                          { label: 'Timezone', value: 'Awareness + display' },
                          { label: 'Status', value: 'Beta' }
                        ]
                      },
                      {
                        title: 'Accessibility',
                        rows: [
                          {
                            label: 'Role',
                            value: (
                              <code className="font-mono text-[11px]">
                                group
                              </code>
                            )
                          },
                          { label: 'Name', value: 'Form labels for fields' },
                          {
                            label: 'Keyboard',
                            value: 'Arrow/Tab navigation across segments'
                          }
                        ]
                      },
                      {
                        title: 'Performance',
                        rows: [
                          { label: 'Bundle target', value: '< 10KB gz' },
                          { label: 'Interaction', value: '< 16ms key handling' }
                        ]
                      },
                      {
                        title: 'Links',
                        rows: [
                          {
                            label: 'Storybook',
                            value: (
                              <a
                                href="/storybook"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                Open
                              </a>
                            )
                          },
                          {
                            label: 'Repository',
                            value: (
                              <a
                                href="https://github.com/bizarre/ui"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                GitHub
                              </a>
                            )
                          }
                        ]
                      }
                    ]}
                  />
                </div>
              </div>
            </section>

            <section className="mt-12">
              <Panel
                title="Install"
                subtitle="Set up the toolkit"
                tag="Setup"
                accent="zinc"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Terminal
                    label="bun"
                    lines={['bun add @bizarre/ui', 'bun add tailwindcss']}
                  />
                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] text-zinc-500 mb-1">
                        Import
                      </div>
                      <Code
                        code={`import { Inlay, Chrono } from '@bizarre/ui'`}
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-zinc-500 mb-1">
                        Links
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <a
                          href="/storybook"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-between border border-zinc-200 rounded-[2px] px-2.5 py-1.5 hover:bg-zinc-50"
                        >
                          <span>Storybook</span>
                          <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                        </a>
                        <a
                          href="https://github.com/bizarre/ui"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-between border border-zinc-200 rounded-[2px] px-2.5 py-1.5 hover:bg-zinc-50"
                        >
                          <span>GitHub</span>
                          <Github className="h-3.5 w-3.5 text-zinc-700" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-xs text-zinc-600 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            © {new Date().getFullYear()}{' '}
            <a
              href="https://bizar.re"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 decoration-zinc-300 hover:decoration-zinc-400"
            >
              Alex Adewole
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/bizarre/ui"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-zinc-700 hover:text-zinc-900"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
            <a
              href="/storybook"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-zinc-700 hover:text-zinc-900"
            >
              <span>Storybook</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
