import { useState } from 'react'
import { Check, Clipboard } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

const commands: Record<PackageManager, string> = {
  bun: 'bun add @bizarre/ui',
  pnpm: 'pnpm add @bizarre/ui',
  yarn: 'yarn add @bizarre/ui',
  npm: 'npm install @bizarre/ui'
}

const colors = {
  coral: '#E85D4C',
  sage: '#7D9F8E'
}

export default function PackageManagerTabs() {
  const [activeTab, setActiveTab] = useState<PackageManager>('bun')
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(commands[activeTab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-5 py-4">
      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PackageManager)}
      >
        <Tabs.List
          className="flex mb-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          {Object.keys(commands).map((pm) => (
            <Tabs.Trigger
              key={pm}
              value={pm}
              className="px-4 py-2 text-sm transition-colors duration-150 font-mono data-[state=active]:-mb-px"
              style={{
                color:
                  activeTab === pm ? colors.coral : 'rgba(255,255,255,0.4)',
                borderBottom:
                  activeTab === pm ? `2px solid ${colors.coral}` : 'none'
              }}
            >
              {pm}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {Object.entries(commands).map(([pm, command]) => (
          <Tabs.Content key={pm} value={pm} className="relative">
            <pre
              className="font-mono text-sm py-2 overflow-x-auto"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              <code>
                <span style={{ color: colors.sage }}>$</span> {command}
              </code>
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-0 right-0 text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm transition-colors hover:bg-white/10"
              style={{
                color: 'rgba(255,255,255,0.4)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              aria-label="Copy to clipboard"
            >
              {copied ? (
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3" style={{ color: colors.sage }} />
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>Copied</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Clipboard className="h-3 w-3" />
                  <span>Copy</span>
                </span>
              )}
            </button>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  )
}
