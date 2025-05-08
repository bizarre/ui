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
        <Tabs.List className="flex border-b border-zinc-800/80 mb-5">
          {Object.keys(commands).map((pm) => (
            <Tabs.Trigger
              key={pm}
              value={pm}
              className="px-4 py-2 text-sm transition-colors duration-200 font-medium data-[state=active]:text-violet-400 data-[state=active]:border-b-2 data-[state=active]:border-violet-500 data-[state=active]:-mb-px text-zinc-500 hover:text-zinc-400"
            >
              {pm}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {Object.entries(commands).map(([pm, command]) => (
          <Tabs.Content key={pm} value={pm} className="relative">
            <pre className="font-mono text-zinc-300 text-sm px-4 py-3 bg-black/30 rounded-md overflow-x-auto border border-zinc-800/80">
              <code>{command}</code>
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2.5 right-2.5 text-xs flex items-center gap-1.5 text-zinc-500 px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-800 hover:text-zinc-300 transition-colors border border-zinc-700/50"
              aria-label="Copy to clipboard"
            >
              {copied ? (
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span>Copied</span>
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
