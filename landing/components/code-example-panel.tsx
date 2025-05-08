import React, { useEffect, useRef, useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as Tabs from '@radix-ui/react-tabs'
import { ChevronRight, Code, Copy, Check } from 'lucide-react'
import { ClientOnly } from 'vike-react/ClientOnly'

type CodeTab = {
  label: string
  value: string
  code: string
  language?: string
}

interface CodeExamplePanelProps {
  title?: string
  defaultOpen?: boolean
  tabs: CodeTab[]
  supportingText?: string
}

export default function CodeExamplePanel({
  title = 'Example Code',
  defaultOpen = false,
  tabs,
  supportingText
}: CodeExamplePanelProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [activeTab, setActiveTab] = React.useState(tabs[0].value)
  const [copied, setCopied] = React.useState(false)
  const [, setTabHeights] = useState<Record<string, number>>({})
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const highlighterLoadedRef = useRef<Record<string, boolean>>({})

  const activeCode = tabs.find((tab) => tab.value === activeTab)?.code || ''

  // Handle when content refs update
  const updateTabHeight = (
    tabValue: string,
    element: HTMLDivElement | null
  ) => {
    if (element) {
      // Small delay to ensure content has fully rendered
      setTimeout(() => {
        const height = element.scrollHeight
        setTabHeights((prev) => ({
          ...prev,
          [tabValue]: height
        }))
      }, 10)
    }
  }

  // Update heights when tab changes or content loads
  useEffect(() => {
    const currentRef = contentRefs.current[activeTab]
    if (currentRef && highlighterLoadedRef.current[activeTab]) {
      updateTabHeight(activeTab, currentRef)
    }
  }, [activeTab, highlighterLoadedRef.current[activeTab]])

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full">
      <Collapsible.Root open onOpenChange={setOpen} className="w-full">
        <Collapsible.Trigger className="flex w-full items-center justify-between p-3 rounded-t-lg bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/80 transition-colors">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">{title}</span>
          </div>
          <div
            className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          >
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </div>
        </Collapsible.Trigger>

        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="border-x border-b border-zinc-800/80 rounded-b-lg overflow-hidden">
            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
              <Tabs.List className="flex border-b border-zinc-800/80 bg-black/20">
                {tabs.map((tab) => (
                  <Tabs.Trigger
                    key={tab.value}
                    value={tab.value}
                    className="px-4 py-2 text-sm transition-colors data-[state=active]:text-violet-400 data-[state=active]:border-b-2 data-[state=active]:border-violet-500 data-[state=active]:-mb-px text-zinc-500 hover:text-zinc-400 font-medium"
                  >
                    {tab.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <div className="relative bg-black/30">
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 text-xs flex items-center gap-1.5 text-zinc-500 px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-800 hover:text-zinc-300 transition-colors border border-zinc-700/50 z-10"
                  aria-label="Copy code to clipboard"
                >
                  {copied ? (
                    <span className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>Copied</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </span>
                  )}
                </button>

                {tabs.map((tab) => (
                  <Tabs.Content
                    key={tab.value}
                    value={tab.value}
                    style={{ height: tab.value === activeTab ? 'auto' : 0 }}
                    className="opacity-0 data-[state=active]:opacity-100 transition-opacity"
                  >
                    <div
                      ref={(el) => {
                        contentRefs.current[tab.value] = el
                        if (tab.value === activeTab) {
                          updateTabHeight(tab.value, el)
                        }
                      }}
                    >
                      <ClientOnly
                        load={() =>
                          import('../components/shiki-highlighter').then(
                            (m) => {
                              // Mark this highlighter as loaded
                              highlighterLoadedRef.current[tab.value] = true
                              return m.default
                            }
                          )
                        }
                        fallback={
                          <div className="flex items-start p-5">
                            <div className="w-full animate-pulse">
                              {/* Generate lines based on code length */}
                              {tab.code.split('\n').map((_, i) => (
                                <div
                                  key={i}
                                  className="h-[21px] bg-zinc-800/50 rounded mb-1.5"
                                  style={{
                                    width: `${Math.min(100, 30 + Math.random() * 70)}%`
                                  }}
                                ></div>
                              ))}
                            </div>
                          </div>
                        }
                      >
                        {(ShikiHighlighter) => (
                          <ShikiHighlighter
                            language={tab.language || 'tsx'}
                            code={tab.code}
                            className="overflow-x-auto p-5"
                          />
                        )}
                      </ClientOnly>
                    </div>
                  </Tabs.Content>
                ))}
              </div>
            </Tabs.Root>

            {supportingText && (
              <div className="p-3 text-xs text-zinc-400 border-t border-zinc-800/50 bg-black/20">
                {supportingText}
              </div>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  )
}
