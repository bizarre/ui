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
  ArrowLeftRight,
  ExternalLink,
  CornerDownRight
} from 'lucide-react'
import { ClientOnly } from 'vike-react/ClientOnly'
import packageJson from '../../../package.json'
import {
  timeSliceBasicExample,
  timeSliceImplementationExample
} from '../../components/code-examples'
import * as Collapsible from '@radix-ui/react-collapsible'

export default function Page() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-950"></div>

      {/* Animated gradient accents */}
      <div
        className="fixed top-[5%] left-[15%] w-[800px] h-[800px] bg-purple-600/5 rounded-full blur-[120px] animate-pulse"
        style={{ animationDuration: '8s' }}
      ></div>
      <div
        className="fixed bottom-[10%] right-[15%] w-[600px] h-[600px] bg-pink-600/5 rounded-full blur-[120px] animate-pulse"
        style={{ animationDuration: '12s', animationDelay: '3s' }}
      ></div>

      {/* Subtle dot pattern */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wMykiLz48L3N2Zz4=')] bg-[length:20px_20px] opacity-25"></div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-20 sm:pt-32 pb-16 sm:pb-24 font-sans">
        {/* Header */}
        <header className="mb-16 sm:mb-24">
          <div className="inline-flex items-center rounded-full px-3 py-1 mb-4 sm:mb-6 text-xs font-medium bg-zinc-900/90 text-zinc-400 border border-zinc-800/80 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.1)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2"></span>
            <span className="tracking-wide">v{packageJson.version}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold mb-4 sm:mb-5 tracking-tight leading-[1.1] font-display">
            <span className="text-white">@bizarre/</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-pink-400">
              ui
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 font-light mb-6 sm:mb-8 leading-relaxed tracking-tight">
            Headless components nobody asked for
          </p>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8 sm:mb-10">
            <a
              href="https://github.com/bizarre/ui"
              className="text-sm flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white transition duration-200 py-2 sm:py-2.5 px-4 sm:px-5 rounded-md border border-zinc-800/80 hover:border-zinc-700 shadow-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </a>
            <a
              href="/storybook"
              className="group text-sm inline-flex items-center gap-2 bg-violet-500 text-white py-2 sm:py-2.5 px-4 sm:px-5 rounded-md relative overflow-hidden"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="relative z-10">Storybook</span>
              <ArrowRight className="h-4 w-4 relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-pink-500 group-hover:from-violet-600 group-hover:to-pink-600 transition-colors duration-200"></div>
              <div className="absolute -inset-0.5 bg-black/5 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-200"></div>
            </a>
          </div>

          <div className="text-zinc-300 leading-relaxed text-base sm:text-lg mt-6 sm:mt-8">
            <p>Wrote these so I could ship weird stuff faster. You can too.</p>
          </div>
        </header>

        {/* Installation */}
        <section className="mb-16 sm:mb-24">
          <h2 className="text-2xl font-semibold text-white mb-8 flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-pink-400">
              Installation
            </span>
          </h2>
          <div className="bg-zinc-900/70 rounded-xl overflow-hidden border border-zinc-800/80 backdrop-blur-sm transition shadow-lg hover:shadow-xl hover:border-zinc-700/80">
            <div className="flex justify-between items-center px-5 py-3 border-b border-zinc-800/80">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="text-xs text-zinc-500">Terminal</div>
            </div>

            <ClientOnly
              load={() =>
                import('../../../landing/components/package-manager-tabs')
              }
              fallback={
                <div className="animate-pulse flex items-center justify-center h-16 w-full">
                  <div className="h-2 bg-zinc-700 rounded w-36"></div>
                </div>
              }
            >
              {(PackageManagerTabs) => <PackageManagerTabs />}
            </ClientOnly>
          </div>
        </section>

        {/* Components */}
        <section className="mb-16 sm:mb-24">
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-8 sm:mb-12 flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-pink-400">
              Components
            </span>
          </h2>

          {/* Component Accordion */}
          <div className="space-y-6">
            {/* TimeSlice Component Accordion */}
            <Collapsible.Root defaultOpen className="w-full">
              <Collapsible.Trigger className="w-full group">
                <div className="flex items-center justify-between py-3 px-4 bg-black/40 border border-zinc-800/80 rounded-lg hover:border-zinc-700/80 transition-colors">
                  <div className="flex items-center gap-3 sm:gap-5">
                    <div className="p-2 sm:p-2.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/10 border border-violet-500/20 shadow-sm">
                      <Clock className="h-5 w-5 sm:h-5 sm:w-5 text-violet-400" />
                    </div>
                    <div className="flex flex-col items-start text-left flex-1">
                      <h3 className="text-lg sm:text-xl font-semibold text-white group-hover:text-white/90 transition-colors">
                        TimeSlice
                      </h3>
                      <p className="text-zinc-400 text-sm sm:text-base leading-relaxed group-hover:text-zinc-300 transition-colors">
                        A flexible time range picker with built-in intelligence
                      </p>
                    </div>
                  </div>
                  <div className="h-8 w-8 aspect-square rounded-full bg-zinc-900/70 border border-zinc-800 flex items-center justify-center group-data-[state=open]:rotate-180 transition-transform duration-300">
                    <ChevronDown className="h-4 w-4 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
                  </div>
                </div>
              </Collapsible.Trigger>

              <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                <div className="pt-6 pl-5 pr-3">
                  <div className="relative">
                    {/* Subtle component divider */}
                    <div className="absolute -left-5 top-0 w-px h-full bg-gradient-to-b from-violet-500/30 via-pink-500/20 to-transparent"></div>

                    {/* Compact Features and Use Cases - Above Example */}
                    <div className="mb-8 sm:mb-10 bg-black/20 rounded-lg border border-zinc-800/50 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Features Section */}
                        <div>
                          <div className="flex items-center mb-3">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/10 flex items-center justify-center mr-2 border border-violet-500/20">
                              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                            </div>
                            <h4 className="text-sm font-medium text-white">
                              Features
                            </h4>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center rounded-full bg-zinc-900/70 px-2.5 py-1 border border-zinc-800 hover:border-violet-500/30 transition-colors">
                              <span className="text-zinc-300 text-xs">
                                Keyboard navigation
                              </span>
                            </div>
                            <div className="flex items-center rounded-full bg-zinc-900/70 px-2.5 py-1 border border-zinc-800 hover:border-violet-500/30 transition-colors">
                              <span className="text-zinc-300 text-xs">
                                Natural language
                              </span>
                            </div>
                            <div className="flex items-center rounded-full bg-zinc-900/70 px-2.5 py-1 border border-zinc-800 hover:border-violet-500/30 transition-colors">
                              <span className="text-zinc-300 text-xs">
                                Timezone-aware
                              </span>
                            </div>
                            <div className="flex items-center rounded-full bg-zinc-900/70 px-2.5 py-1 border border-zinc-800 hover:border-violet-500/30 transition-colors">
                              <span className="text-zinc-300 text-xs">
                                Accessible
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Perfect For Section */}
                        <div>
                          <div className="flex items-center mb-3">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/10 flex items-center justify-center mr-2 border border-blue-500/20">
                              <Calendar className="h-3.5 w-3.5 text-blue-400" />
                            </div>
                            <h4 className="text-sm font-medium text-white">
                              Perfect For
                            </h4>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center rounded-full bg-zinc-900/70 px-2.5 py-1 border border-zinc-800 hover:border-blue-500/30 transition-colors">
                              <span className="text-zinc-300 text-xs">
                                Analytics dashboards
                              </span>
                            </div>
                            <div className="flex items-center rounded-full bg-zinc-900/70 px-2.5 py-1 border border-zinc-800 hover:border-blue-500/30 transition-colors">
                              <span className="text-zinc-300 text-xs">
                                Log explorers
                              </span>
                            </div>
                            <div className="flex items-center rounded-full bg-zinc-900/70 px-2.5 py-1 border border-zinc-800 hover:border-blue-500/30 transition-colors">
                              <span className="text-zinc-300 text-xs">
                                Data visualization
                              </span>
                            </div>
                            <div className="flex items-center rounded-full bg-zinc-900/70 px-2.5 py-1 border border-zinc-800 hover:border-blue-500/30 transition-colors">
                              <span className="text-zinc-300 text-xs">
                                Monitoring tools
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Clean, flat demo card */}
                    <div className="w-full mb-10 sm:mb-12">
                      <div className="bg-black/30 border border-zinc-800/80 rounded-lg overflow-visible">
                        {/* Top bar */}
                        <div className="border-b border-zinc-800/50 px-3 sm:px-5 py-2 sm:py-3 flex justify-between items-center bg-black/20">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-violet-500/70"></div>
                            <span className="text-xs font-medium text-zinc-400">
                              DEMO
                            </span>
                          </div>

                          <ClientOnly
                            load={() =>
                              import(
                                '../../components/component-showcase-dialog'
                              )
                            }
                            fallback={
                              <div className="animate-pulse h-8 w-24 bg-zinc-900/50 rounded-md"></div>
                            }
                          >
                            {(ComponentShowcaseDialog) => (
                              <ClientOnly
                                load={() =>
                                  import('../../components/time-slice-example')
                                }
                                fallback={<div />}
                              >
                                {(TimeSliceExample) => (
                                  <ComponentShowcaseDialog
                                    title="TimeSlice Component"
                                    description="TimeSlice is a flexible time range picker with natural language support, relative time handling, and keyboard navigation."
                                    demoComponent={TimeSliceExample}
                                    codeTabs={[
                                      {
                                        label: 'Basic',
                                        value: 'basic',
                                        code: timeSliceBasicExample,
                                        language: 'tsx'
                                      },
                                      {
                                        label: 'Implementation',
                                        value: 'implementation',
                                        code: timeSliceImplementationExample,
                                        language: 'tsx'
                                      }
                                    ]}
                                    docsLink="/storybook/?path=/story/timeslice"
                                    trigger={
                                      <button className="text-xs flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 px-2.5 py-1.5 rounded text-zinc-400 hover:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                                        <Code className="h-3.5 w-3.5" />
                                        <span>View code</span>
                                      </button>
                                    }
                                  />
                                )}
                              </ClientOnly>
                            )}
                          </ClientOnly>
                        </div>

                        {/* Demo container with ample space for dropdown visibility */}
                        <div className="px-3 sm:px-4 py-4 sm:py-6 flex flex-col items-center justify-center">
                          <div className="w-full max-w-md relative">
                            <ClientOnly
                              load={() =>
                                import('../../components/time-slice-example')
                              }
                              fallback={
                                <div className="animate-pulse flex items-center justify-center h-12 w-full">
                                  <div className="h-2 bg-zinc-700 rounded w-32"></div>
                                </div>
                              }
                            >
                              {(TimeSliceExample) => <TimeSliceExample />}
                            </ClientOnly>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Key Features with visual interest */}
                    <div className="mb-10 sm:mb-12">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                        {/* Feature 1: Natural Language */}
                        <div className="bg-gradient-to-br from-violet-500/10 to-pink-500/5 rounded-lg overflow-hidden border border-violet-500/20 shadow-lg hover:shadow-xl transition-all group">
                          {/* Feature header */}
                          <div className="flex items-center justify-between bg-black/30 px-3 sm:px-5 py-2 sm:py-3 border-b border-violet-500/10">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-400" />
                              <h4 className="text-white font-medium text-xs sm:text-sm">
                                Natural Language
                              </h4>
                            </div>
                            <div className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded text-violet-400 font-medium">
                              Smart
                            </div>
                          </div>

                          {/* Feature content */}
                          <div className="p-3 sm:p-5 min-h-[220px] sm:min-h-[260px]">
                            <div className="space-y-3 sm:space-y-4">
                              <div className="bg-black/20 rounded-lg border border-zinc-800/80 overflow-hidden">
                                <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-black/30 border-b border-zinc-800/50">
                                  <div className="text-zinc-300 text-xs sm:text-sm font-mono inline-flex items-center">
                                    <span className="text-violet-400 mr-1.5">
                                      "
                                    </span>
                                    last 2 weeks
                                    <span className="text-violet-400 ml-1.5">
                                      "
                                    </span>
                                  </div>
                                </div>
                                <div className="p-2 sm:p-2.5">
                                  <div className="flex items-center">
                                    <div className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 bg-violet-500/10 rounded-full flex items-center justify-center mr-2">
                                      <CornerDownRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-violet-400" />
                                    </div>
                                    <div className="text-zinc-300 text-[10px] sm:text-xs font-mono">
                                      {new Date(
                                        Date.now() - 14 * 24 * 60 * 60 * 1000
                                      ).toLocaleDateString()}{' '}
                                      - {new Date().toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-black/20 rounded-lg border border-zinc-800/80 overflow-hidden">
                                <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-black/30 border-b border-zinc-800/50">
                                  <div className="text-zinc-300 text-xs sm:text-sm font-mono inline-flex items-center">
                                    <span className="text-violet-400 mr-1.5">
                                      "
                                    </span>
                                    yesterday to tomorrow
                                    <span className="text-violet-400 ml-1.5">
                                      "
                                    </span>
                                  </div>
                                </div>
                                <div className="p-2 sm:p-2.5">
                                  <div className="flex items-center">
                                    <div className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 bg-violet-500/10 rounded-full flex items-center justify-center mr-2">
                                      <CornerDownRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-violet-400" />
                                    </div>
                                    <div className="text-zinc-300 text-[10px] sm:text-xs font-mono">
                                      {new Date(
                                        Date.now() - 24 * 60 * 60 * 1000
                                      ).toLocaleDateString()}{' '}
                                      -{' '}
                                      {new Date(
                                        Date.now() + 24 * 60 * 60 * 1000
                                      ).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <p className="text-zinc-400 text-xs sm:text-sm mt-3 sm:mt-4">
                              Parse natural language expressions using{' '}
                              <a
                                href="https://github.com/wanasit/chrono"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-violet-400 hover:text-violet-300 transition-colors"
                              >
                                chrono-node
                              </a>{' '}
                              for intuitive input.
                            </p>
                          </div>
                        </div>

                        {/* Feature 2: Keyboard Navigation */}
                        <div className="bg-gradient-to-br from-blue-500/10 to-violet-500/5 rounded-lg overflow-hidden border border-blue-500/20 shadow-lg hover:shadow-xl transition-all group">
                          {/* Feature header */}
                          <div className="flex items-center justify-between bg-black/30 px-3 sm:px-5 py-2 sm:py-3 border-b border-blue-500/10">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center">
                                <ChevronUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-400 -mb-1" />
                                <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-400" />
                              </div>
                              <h4 className="text-white font-medium text-xs sm:text-sm">
                                Keyboard Navigation
                              </h4>
                            </div>
                            <div className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 font-medium">
                              Accessible
                            </div>
                          </div>

                          {/* Feature content */}
                          <div className="p-3 sm:p-5">
                            <div className="bg-black/40 rounded-md border border-zinc-800/80 p-3 sm:p-4 mb-3 sm:mb-5">
                              <div className="flex justify-center mb-3 sm:mb-5">
                                <div className="inline-flex items-center rounded-md border border-zinc-700 p-1.5 sm:p-2 px-2 sm:px-3 bg-black/50">
                                  <span className="font-mono text-white text-xs sm:text-sm">
                                    2023-
                                  </span>
                                  <span className="font-mono text-blue-400 bg-blue-500/20 px-1 rounded mx-0.5 text-xs sm:text-sm">
                                    06
                                  </span>
                                  <span className="font-mono text-white text-xs sm:text-sm">
                                    -12
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <div className="flex flex-col items-center gap-1 sm:gap-1.5 bg-black/30 rounded-md border border-zinc-800/80 p-2 sm:p-2.5">
                                  <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <ArrowLeftRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-400" />
                                  </div>
                                  <div className="text-zinc-400 text-[10px] sm:text-xs text-center">
                                    Arrow keys
                                  </div>
                                </div>

                                <div className="flex flex-col items-center gap-1 sm:gap-1.5 bg-black/30 rounded-md border border-zinc-800/80 p-2 sm:p-2.5">
                                  <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <div className="text-blue-400 text-[10px] sm:text-xs">
                                      ↑↓
                                    </div>
                                  </div>
                                  <div className="text-zinc-400 text-[10px] sm:text-xs text-center">
                                    Modify values
                                  </div>
                                </div>

                                <div className="flex flex-col items-center gap-1 sm:gap-1.5 bg-black/30 rounded-md border border-zinc-800/80 p-2 sm:p-2.5">
                                  <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <div className="text-blue-400 text-[10px] sm:text-xs">
                                      Tab
                                    </div>
                                  </div>
                                  <div className="text-zinc-400 text-[10px] sm:text-xs text-center">
                                    Jump dates
                                  </div>
                                </div>
                              </div>
                            </div>

                            <p className="text-zinc-400 text-xs sm:text-sm">
                              Edit day, month, year, hour, and minute segments
                              with intuitive keyboard shortcuts.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Collapsible.Content>
            </Collapsible.Root>

            {/* <Collapsible.Root className="w-full">
              <Collapsible.Trigger className="w-full group">
                <div className="flex items-center justify-between py-3 px-4 bg-black/40 border border-zinc-800/80 rounded-lg hover:border-zinc-700/80 transition-colors">
                  <div className="flex items-center gap-3 sm:gap-5">
                    <div className="p-2 sm:p-2.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 shadow-sm">
                      <MessageSquare className="h-5 w-5 sm:h-5 sm:w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-semibold text-white group-hover:text-white/90 transition-colors">
                        Future Component
                      </h3>
                      <p className="text-zinc-400 text-sm sm:text-base leading-relaxed group-hover:text-zinc-300 transition-colors">
                        Description of the future component goes here
                      </p>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-zinc-900/70 border border-zinc-800 flex items-center justify-center group-data-[state=open]:rotate-180 transition-transform duration-300">
                    <ChevronDown className="h-4 w-4 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
                  </div>
                </div>
              </Collapsible.Trigger>
              <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                <div className="pt-6 pl-5 pr-3">
                  <div className="py-12 px-8 bg-black/20 rounded-lg border border-zinc-800/50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                        <Sparkles className="h-5 w-5 text-emerald-400" />
                      </div>
                      <p className="text-zinc-400 text-sm">
                        More components coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </Collapsible.Content>
            </Collapsible.Root> */}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 sm:pt-12 mt-6 sm:mt-8 border-t border-zinc-800/50 text-xs sm:text-sm text-zinc-500 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            © {new Date().getFullYear()}{' '}
            <a
              href="https://bizar.re"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-white transition"
            >
              Alex Adewole
            </a>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="https://github.com/bizarre/ui"
              className="text-zinc-500 hover:text-white transition flex items-center gap-1.5"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>GitHub</span>
            </a>
            <a
              href="/storybook"
              className="text-zinc-500 hover:text-white transition flex items-center gap-1.5"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Storybook</span>
              <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
