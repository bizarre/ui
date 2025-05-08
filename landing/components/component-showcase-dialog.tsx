import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Maximize2, ExternalLink } from 'lucide-react'
import CodeExamplePanel from './code-example-panel'

type CodeTab = {
  label: string
  value: string
  code: string
  language?: string
}

interface ComponentShowcaseDialogProps {
  title: string
  description?: string
  demoComponent: React.ComponentType
  codeTabs: CodeTab[]
  trigger?: React.ReactNode
  docsLink?: string
}

export default function ComponentShowcaseDialog({
  title,
  description,
  demoComponent: DemoComponent,
  codeTabs,
  trigger,
  docsLink
}: ComponentShowcaseDialogProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger || (
          <button className="inline-flex items-center gap-2 bg-zinc-900/60 hover:bg-zinc-900/80 border border-zinc-800/80 px-3 py-2 rounded-md text-sm text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40">
            <Maximize2 className="h-4 w-4" />
            <span>View demo & code</span>
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/60 backdrop-blur-sm fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-[90vw] max-w-5xl max-h-[85vh] translate-x-[-50%] translate-y-[-50%] gap-6 bg-zinc-950 shadow-lg shadow-black/10 border border-zinc-800/80 rounded-xl p-1 overflow-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
              <Dialog.Title className="text-lg font-medium text-white">
                {title}
              </Dialog.Title>

              <div className="flex items-center gap-3">
                {docsLink && (
                  <a
                    href={docsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
                  >
                    <span>Docs</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <Dialog.Close asChild>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {description && (
                <div className="px-6 py-4 text-zinc-400 text-sm border-b border-zinc-800/80">
                  {description}
                </div>
              )}

              <div className="p-6 flex flex-col">
                <div className="bg-black/30 p-8 border border-zinc-800/80 rounded-lg mb-6 flex justify-center">
                  <div className="w-full max-w-md">
                    <DemoComponent />
                  </div>
                </div>

                <div>
                  <CodeExamplePanel
                    tabs={codeTabs}
                    defaultOpen={true}
                    supportingText="This component is fully customizable to fit your design system."
                  />
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
