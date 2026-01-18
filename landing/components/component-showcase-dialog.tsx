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

const colors = {
  cream: '#FAF7F2',
  creamDark: '#F0EBE3',
  ink: '#1a1816',
  inkMuted: '#6b6460',
  coral: '#E85D4C'
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
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors"
            style={{
              backgroundColor: colors.creamDark,
              color: colors.ink,
              border: `1px solid ${colors.ink}15`
            }}
          >
            <Maximize2 className="h-4 w-4" />
            <span>View demo & code</span>
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{
            backgroundColor: 'rgba(26,24,22,0.6)',
            backdropFilter: 'blur(4px)'
          }}
        />

        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 grid w-[90vw] max-w-5xl max-h-[85vh] translate-x-[-50%] translate-y-[-50%] gap-6 shadow-lg rounded-sm p-1 overflow-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{
            backgroundColor: colors.cream,
            border: `1px solid ${colors.ink}15`
          }}
        >
          <div className="flex flex-col max-h-[85vh]">
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: `1px solid ${colors.ink}15` }}
            >
              <Dialog.Title
                className="text-lg font-serif"
                style={{ color: colors.ink }}
              >
                {title}
              </Dialog.Title>

              <div className="flex items-center gap-3">
                {docsLink && (
                  <a
                    href={docsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
                    style={{ color: colors.inkMuted }}
                  >
                    <span>Docs</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <Dialog.Close asChild>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm transition-colors hover:opacity-80"
                    style={{ color: colors.inkMuted }}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {description && (
                <div
                  className="px-6 py-4 text-sm"
                  style={{
                    color: colors.inkMuted,
                    borderBottom: `1px solid ${colors.ink}15`
                  }}
                >
                  {description}
                </div>
              )}

              <div className="p-6 flex flex-col">
                <div
                  className="p-8 rounded-sm mb-6 flex justify-center"
                  style={{
                    backgroundColor: colors.ink,
                    border: `1px solid ${colors.ink}25`
                  }}
                >
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
