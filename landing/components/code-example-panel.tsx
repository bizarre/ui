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

const colors = {
  cream: '#FAF7F2',
  creamDark: '#F0EBE3',
  ink: '#1a1816',
  inkLight: '#3d3835',
  inkMuted: '#6b6460',
  coral: '#E85D4C',
  sage: '#7D9F8E'
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

  const updateTabHeight = (
    tabValue: string,
    element: HTMLDivElement | null
  ) => {
    if (element) {
      setTimeout(() => {
        const height = element.scrollHeight
        setTabHeights((prev) => ({
          ...prev,
          [tabValue]: height
        }))
      }, 10)
    }
  }

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
        <Collapsible.Trigger
          className="flex w-full items-center justify-between p-3 rounded-t-sm transition-colors"
          style={{
            backgroundColor: colors.ink,
            border: `1px solid ${colors.ink}`
          }}
        >
          <div className="flex items-center gap-2">
            <Code
              className="h-4 w-4"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {title}
            </span>
          </div>
          <div
            className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          >
            <ChevronRight
              className="h-4 w-4"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            />
          </div>
        </Collapsible.Trigger>

        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div
            className="rounded-b-sm overflow-hidden"
            style={{ border: `1px solid ${colors.ink}25`, borderTop: 'none' }}
          >
            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
              <Tabs.List
                className="flex"
                style={{
                  borderBottom: `1px solid ${colors.ink}20`,
                  backgroundColor: `${colors.inkLight}40`
                }}
              >
                {tabs.map((tab) => (
                  <Tabs.Trigger
                    key={tab.value}
                    value={tab.value}
                    className="px-4 py-2 text-sm transition-colors font-medium data-[state=active]:-mb-px"
                    style={{
                      color:
                        activeTab === tab.value
                          ? colors.coral
                          : colors.inkMuted,
                      borderBottom:
                        activeTab === tab.value
                          ? `2px solid ${colors.coral}`
                          : 'none'
                    }}
                  >
                    {tab.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <div className="relative" style={{ backgroundColor: colors.ink }}>
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-sm transition-colors z-10"
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                  aria-label="Copy code to clipboard"
                >
                  {copied ? (
                    <span className="flex items-center gap-1.5">
                      <Check
                        className="h-3 w-3"
                        style={{ color: colors.sage }}
                      />
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Copied
                      </span>
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
                              highlighterLoadedRef.current[tab.value] = true
                              return m.default
                            }
                          )
                        }
                        fallback={
                          <div className="flex items-start p-5">
                            <div className="w-full animate-pulse">
                              {tab.code.split('\n').map((_, i) => (
                                <div
                                  key={i}
                                  className="h-[21px] rounded mb-1.5"
                                  style={{
                                    backgroundColor: 'rgba(255,255,255,0.1)',
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
              <div
                className="p-3 text-xs"
                style={{
                  color: colors.inkMuted,
                  borderTop: `1px solid ${colors.ink}15`,
                  backgroundColor: colors.creamDark
                }}
              >
                {supportingText}
              </div>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  )
}
