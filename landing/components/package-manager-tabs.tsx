import { useState } from 'react'
import { Check } from 'lucide-react'

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
    <div>
      <div className="flex border-b border-zinc-800 mb-4">
        {Object.keys(commands).map((pm) => (
          <button
            key={pm}
            className={`px-4 py-2 text-sm transition ${
              activeTab === pm
                ? 'text-purple-400 border-b-2 border-purple-500 -mb-px'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
            onClick={() => setActiveTab(pm as PackageManager)}
          >
            {pm}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="text-zinc-300 text-sm p-2 bg-black/20 rounded-md overflow-x-auto">
          <code>{commands[activeTab]}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 text-xs text-zinc-500 px-2 py-0.5 rounded bg-zinc-800/50 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
        >
          {copied ? (
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-green-400" />
              Copied
            </span>
          ) : (
            'Copy'
          )}
        </button>
      </div>
    </div>
  )
}
