import {
  ArrowRight,
  Github,
  Clock,
  Sparkles,
  Code,
  Calendar,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  ArrowLeftRight
} from 'lucide-react'
import { ClientOnly } from 'vike-react/ClientOnly'
import packageJson from '../../../package.json'

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 text-white">
      {/* Subtle animated gradient orbs for background effect */}
      <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] animate-pulse"></div>
      <div
        className="absolute bottom-40 left-1/4 w-64 h-64 bg-pink-600/10 rounded-full blur-[80px] animate-pulse"
        style={{ animationDelay: '1s' }}
      ></div>

      {/* Subtle background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:40px_40px] opacity-10"></div>

      <div className="relative max-w-3xl mx-auto px-6 pt-28 pb-20">
        {/* Header */}
        <header className="mb-20">
          <div className="inline-flex items-center rounded-full px-3 py-1 mb-6 text-xs font-medium bg-zinc-900/80 text-zinc-400 border border-zinc-800 backdrop-blur-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            <span>Version {packageJson.version}</span>
          </div>

          <h1 className="text-5xl font-bold text-white mb-5 tracking-tight leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
              @bizarre/
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              ui
            </span>
          </h1>

          <p className="text-xl text-zinc-400 font-light tracking-tight mb-8">
            Headless components nobody asked for
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-10">
            <a
              href="https://github.com/bizarre/ui"
              className="text-sm flex items-center gap-2 bg-zinc-900/80 hover:bg-zinc-800 text-white transition py-2.5 px-5 rounded-lg border border-zinc-800 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-zinc-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </a>
            <a
              href="https://ui.bizar.re/storybook"
              className="text-sm flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white transition py-2.5 px-5 rounded-lg shadow-sm hover:shadow-md hover:opacity-90"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Storybook</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="prose prose-invert prose-lg max-w-none">
            <p className="text-zinc-300 leading-relaxed text-lg">
              Spend less time wiring up inputs, and more time building your
              ChatGPT wrapper. Headless components for the weird parts of UI.
            </p>
          </div>
        </header>

        {/* Installation */}
        <section className="mb-20">
          <h2 className="text-xl font-medium text-white mb-6 flex items-center gap-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Installation
            </span>
          </h2>
          <div className="bg-zinc-900/80 rounded-xl p-5 overflow-hidden border border-zinc-800 backdrop-blur-sm transition hover:border-zinc-700 hover:bg-zinc-900/90">
            <div className="flex justify-between items-center mb-4">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
            </div>

            <ClientOnly
              load={() =>
                import('../../../landing/components/package-manager-tabs')
              }
              fallback={
                <div className="animate-pulse flex items-center justify-center h-14 w-full">
                  <div className="h-2 bg-zinc-700 rounded w-32"></div>
                </div>
              }
            >
              {(PackageManagerTabs) => <PackageManagerTabs />}
            </ClientOnly>
          </div>
        </section>

        {/* Components */}
        <section className="mb-20">
          <h2 className="text-xl font-medium text-white mb-10 flex items-center gap-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Components
            </span>
          </h2>

          {/* TimeSlice Component */}
          <div className="relative">
            {/* Timeline indicator */}
            <div className="absolute -left-10 top-0 w-px h-full bg-gradient-to-b from-purple-500/30 to-transparent"></div>

            <div className="flex items-start gap-4 mb-8">
              <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Clock className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">
                  TimeSlice
                </h3>
                <p className="text-zinc-400 text-lg">
                  A flexible time range picker with intelligence built in
                </p>
              </div>
            </div>

            {/* Example card with demo */}
            <div className="bg-zinc-900/60 rounded-xl p-7 mb-10 border border-zinc-800 backdrop-blur-sm shadow-lg hover:shadow-xl transition">
              <div className="p-5 bg-black/40 mb-6 border border-zinc-800 rounded-lg">
                <div className="inline-block">
                  <ClientOnly
                    load={() => import('../../components/time-slice-example')}
                    fallback={
                      <div className="animate-pulse flex items-center justify-center h-12 w-full">
                        <div className="h-2 bg-zinc-700 rounded w-24"></div>
                      </div>
                    }
                  >
                    {(TimeSliceExample) => <TimeSliceExample />}
                  </ClientOnly>
                </div>
              </div>

              <div className="bg-black/50 rounded-lg p-4 overflow-x-auto border border-zinc-800 shadow-inner">
                <ClientOnly
                  load={() =>
                    import('../../components/shiki-highlighter').then(
                      (m) => m.default
                    )
                  }
                  fallback={
                    <pre className="text-zinc-300 text-xs font-mono overflow-x-auto animate-pulse">
                      <code>Loading syntax highlighting...</code>
                    </pre>
                  }
                >
                  {(ShikiHighlighter) => (
                    <ShikiHighlighter
                      language="tsx"
                      code={`import { TimeSlice } from "@bizarre/ui"

<TimeSlice.Root onDateRangeChange={handleChange}>
  <TimeSlice.Input />
  <TimeSlice.Portal>
    <TimeSlice.Shortcut duration={{ minutes: 15 }}>
      15 minutes
    </TimeSlice.Shortcut>
    <TimeSlice.Shortcut duration={{ hours: 1 }}>
      1 hour
    </TimeSlice.Shortcut>
    <TimeSlice.Shortcut duration={{ days: 1 }}>
      1 day
    </TimeSlice.Shortcut>
    <TimeSlice.Shortcut duration={{ months: 1 }}>
      1 month
    </TimeSlice.Shortcut>
  </TimeSlice.Portal>
</TimeSlice.Root>`}
                      className="overflow-x-auto"
                    />
                  )}
                </ClientOnly>
              </div>
            </div>

            {/* Feature highlights for TimeSlice */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-zinc-900/40 p-5 rounded-lg border border-zinc-800 backdrop-blur-sm hover:border-purple-500/30 transition-all hover:bg-zinc-900/60 group">
                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-all">
                  <MessageSquare className="h-5 w-5 text-purple-400" />
                </div>
                <h4 className="text-white font-medium mb-2">
                  Natural Language
                </h4>
                <p className="text-zinc-400 text-sm">
                  Understands phrases like "last 3 days" or "yesterday to now"
                  with chrono parsing
                </p>
              </div>

              <div className="bg-zinc-900/40 p-5 rounded-lg border border-zinc-800 backdrop-blur-sm hover:border-purple-500/30 transition-all hover:bg-zinc-900/60 group">
                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-all">
                  <Calendar className="h-5 w-5 text-purple-400" />
                </div>
                <h4 className="text-white font-medium mb-2">Relative Time</h4>
                <p className="text-zinc-400 text-sm">
                  Handles relative ranges like "last hour" or "past 7 days" with
                  automatic updates
                </p>
              </div>

              <div className="bg-zinc-900/40 p-5 rounded-lg border border-zinc-800 backdrop-blur-sm hover:border-purple-500/30 transition-all hover:bg-zinc-900/60 group">
                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-all">
                  <Code className="h-5 w-5 text-purple-400" />
                </div>
                <h4 className="text-white font-medium mb-2">Composable</h4>
                <p className="text-zinc-400 text-sm">
                  Use our components as-is or customize the UI to match your
                  design
                </p>
              </div>
            </div>

            {/* Natural language & Time Segments demo */}
            <div className="space-y-10 mb-10">
              {/* Natural language demo */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/5 rounded-lg p-6 border border-purple-500/20">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span>Natural Language Support</span>
                </h3>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-zinc-900/80 text-zinc-300 px-3 py-1.5 rounded-md border border-zinc-800 text-sm">
                      "last 2 weeks"
                    </div>
                    <span className="text-zinc-500">→</span>
                    <div className="bg-zinc-900/80 text-purple-300 px-3 py-1.5 rounded-md border border-zinc-800 text-sm">
                      {new Date(
                        Date.now() - 14 * 24 * 60 * 60 * 1000
                      ).toLocaleDateString()}{' '}
                      - {new Date().toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-zinc-900/80 text-zinc-300 px-3 py-1.5 rounded-md border border-zinc-800 text-sm">
                      "yesterday until tomorrow"
                    </div>
                    <span className="text-zinc-500">→</span>
                    <div className="bg-zinc-900/80 text-purple-300 px-3 py-1.5 rounded-md border border-zinc-800 text-sm">
                      {new Date(
                        Date.now() - 24 * 60 * 60 * 1000
                      ).toLocaleDateString()}{' '}
                      -{' '}
                      {new Date(
                        Date.now() + 24 * 60 * 60 * 1000
                      ).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-zinc-900/80 text-zinc-300 px-3 py-1.5 rounded-md border border-zinc-800 text-sm">
                      "past 30 minutes"
                    </div>
                    <span className="text-zinc-500">→</span>
                    <div className="bg-zinc-900/80 text-purple-300 px-3 py-1.5 rounded-md border border-zinc-800 text-sm">
                      {new Date(
                        Date.now() - 30 * 60 * 1000
                      ).toLocaleTimeString()}{' '}
                      - {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <p className="text-zinc-400 text-sm italic">
                  Uses chrono-node to parse natural language expressions
                </p>
              </div>

              {/* Time Segment Navigation */}
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/5 rounded-lg p-6 border border-blue-500/20">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center">
                    <ChevronUp className="h-3.5 w-3.5 text-blue-400 -mb-1" />
                    <ChevronDown className="h-3.5 w-3.5 text-blue-400" />
                  </span>
                  <span>Keyboard Navigation</span>
                </h3>

                <div className="bg-black/40 p-5 rounded-lg border border-zinc-800 mb-5">
                  <div className="flex items-center justify-center">
                    <div className="flex items-center rounded-md border border-zinc-700 p-1.5 px-3 bg-black/50">
                      <span className="flex items-center space-x-1">
                        <span className="text-white font-mono">2023-</span>
                        <span className="text-blue-400 font-mono bg-blue-500/20 px-1 rounded">
                          06
                        </span>
                        <span className="text-white font-mono">-12</span>
                        <span className="text-zinc-500 mx-1">to</span>
                        <span className="text-white font-mono">2023-06-15</span>
                      </span>
                    </div>

                    <div className="mx-3 text-zinc-500">→</div>

                    <div className="flex flex-col items-center text-xs text-zinc-400">
                      <div className="flex items-center gap-1 text-blue-400">
                        <ChevronUp className="h-3 w-3" />
                        <span>Press ↑</span>
                      </div>
                      <div className="mt-1 text-zinc-500">Month: 06 → 07</div>
                      <div className="flex items-center gap-1 mt-1 text-blue-400">
                        <ChevronDown className="h-3 w-3" />
                        <span>Press ↓</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                  <div className="bg-black/30 rounded-md border border-zinc-800 p-3 flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <ArrowLeftRight className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <span className="text-white block mb-1">Navigate</span>
                      <div className="text-zinc-400 text-xs">
                        Arrow keys to move between segments
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-md border border-zinc-800 p-3 flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-blue-400 text-xs whitespace-nowrap">
                        ↑↓
                      </span>
                    </div>
                    <div>
                      <span className="text-white block mb-1">Modify</span>
                      <div className="text-zinc-400 text-xs">
                        Up/down to change selected segment
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-md border border-zinc-800 p-3 flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-blue-400 text-xs whitespace-nowrap">
                        Tab
                      </span>
                    </div>
                    <div>
                      <span className="text-white block mb-1">Quick Jump</span>
                      <div className="text-zinc-400 text-xs">
                        Tab between start and end dates
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-zinc-400 text-sm italic">
                  Edit day, month, year, hour, and minute segments with keyboard
                  shortcuts
                </p>
              </div>
            </div>

            {/* Features & Use Cases */}
            <div className="grid grid-cols-2 gap-6 mb-10">
              <div className="bg-zinc-900/40 p-5 rounded-lg border border-zinc-800 backdrop-blur-sm hover:border-zinc-700 transition-all hover:bg-zinc-900/60">
                <h4 className="text-white mb-3 font-medium">Features</h4>
                <ul className="text-zinc-400 space-y-2.5 text-sm">
                  <li className="flex gap-2 items-start">
                    <span className="text-purple-400 flex-shrink-0">●</span>
                    <span>Keyboard navigation & shortcuts</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-purple-400 flex-shrink-0">●</span>
                    <span>Timezone-aware calculations</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-purple-400 flex-shrink-0">●</span>
                    <span>Performance optimized</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-purple-400 flex-shrink-0">●</span>
                    <span>Accessible by default</span>
                  </li>
                </ul>
              </div>
              <div className="bg-zinc-900/40 p-5 rounded-lg border border-zinc-800 backdrop-blur-sm hover:border-zinc-700 transition-all hover:bg-zinc-900/60">
                <h4 className="text-white mb-3 font-medium">Good For</h4>
                <ul className="text-zinc-400 space-y-2.5 text-sm">
                  <li className="flex gap-2 items-start">
                    <span className="text-purple-400 flex-shrink-0">●</span>
                    <span>Analytics dashboards</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-purple-400 flex-shrink-0">●</span>
                    <span>Log & event explorers</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-purple-400 flex-shrink-0">●</span>
                    <span>Data visualization tools</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <span className="text-purple-400 flex-shrink-0">●</span>
                    <span>Monitoring applications</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-12 border-t border-zinc-800/50 text-sm text-zinc-500 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} Alex Adewole</div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/bizarre/ui"
              className="text-zinc-500 hover:text-white transition flex items-center gap-1.5"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
