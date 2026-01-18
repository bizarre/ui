import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Github,
  Clock,
  TextCursorInput,
  Copy,
  Check,
  ArrowUpRight,
  Sparkles,
  MessageSquare,
  Keyboard,
  Globe,
  Zap,
  X,
  ChevronDown
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react'
import { ClientOnly } from 'vike-react/ClientOnly'
import packageJson from '../../../package.json'

// ============================================================================
// Design Tokens
// ============================================================================

const colors = {
  // Base
  bg: '#0A0A0A',
  surface: '#111111',
  surfaceLight: '#1A1A1A',
  border: '#222222',
  borderLight: '#333333',

  // Text
  text: '#FFFFFF',
  textMuted: '#888888',
  textDim: '#555555',

  // Neon accents
  magenta: '#FF2D92',
  cyan: '#00F0FF',
  lime: '#B8FF00'
} as const

// ============================================================================
// Shared Components
// ============================================================================

function GutterText({
  children,
  side,
  top
}: {
  children: React.ReactNode
  side: 'left' | 'right'
  top?: string
}) {
  return (
    <div
      className="fixed hidden xl:flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase"
      style={{
        [side]: '24px',
        top: top || '50%',
        transform:
          side === 'left'
            ? 'rotate(-90deg) translateX(-50%)'
            : 'rotate(90deg) translateX(50%)',
        transformOrigin: side === 'left' ? 'left center' : 'right center',
        color: colors.textDim,
        letterSpacing: '0.2em'
      }}
    >
      {children}
    </div>
  )
}

function IconBox({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <div
      className="w-12 h-12 rounded-lg flex items-center justify-center"
      style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
    >
      <Icon className="w-6 h-6" style={{ color }} />
    </div>
  )
}

function FeatureIcon({
  icon: Icon,
  color
}: {
  icon: LucideIcon
  color: string
}) {
  return (
    <div
      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${color}15` }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color }} />
    </div>
  )
}

function FeatureItem({
  icon,
  title,
  desc,
  color
}: {
  icon: LucideIcon
  title: string
  desc: string
  color: string
}) {
  return (
    <div className="flex items-start gap-3">
      <FeatureIcon icon={icon} color={color} />
      <div>
        <span
          className="text-sm font-medium block"
          style={{ color: colors.text }}
        >
          {title}
        </span>
        <span className="text-xs" style={{ color: colors.textMuted }}>
          {desc}
        </span>
      </div>
    </div>
  )
}

function TagList({ tags, color }: { tags: string[]; color: string }) {
  return (
    <div
      className="flex flex-wrap gap-2 pt-6"
      style={{ borderTop: `1px solid ${colors.border}` }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-3 py-1.5 text-xs font-medium rounded-md"
          style={{
            backgroundColor: `${color}10`,
            color: colors.textMuted,
            border: `1px solid ${color}20`
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  )
}

function CopyButton({
  onCopy,
  copied,
  size = 'sm'
}: {
  onCopy: () => void
  copied: boolean
  size?: 'sm' | 'xs'
}) {
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-3 h-3'
  return (
    <span
      onClick={(e) => {
        e.stopPropagation()
        onCopy()
      }}
      className="opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
      style={{ color: copied ? colors.lime : 'inherit' }}
    >
      {copied ? <Check className={iconSize} /> : <Copy className={iconSize} />}
    </span>
  )
}

// ============================================================================
// Code Preview Component
// ============================================================================

// Syntax highlighting as React elements (avoids HTML injection issues)
// Syntax theme - cohesive dark mode with neon accents
const syntaxColors = {
  keyword: '#FF6B9D', // soft pink - import, from, const, etc.
  tag: '#7DD3FC', // sky blue - JSX tags
  tagBracket: '#5EADD5', // slightly darker blue - < > /
  attribute: '#C4B5FD', // soft purple - prop names
  string: '#A3E635', // lime green - strings
  punctuation: '#6B7280', // gray - braces, parens, equals
  text: '#E5E5E5', // off-white - default text
  comment: '#6B7280' // gray - comments
}

function SyntaxHighlight({
  code,
  multiline = false
}: {
  code: string
  multiline?: boolean
}) {
  type TokenType =
    | 'keyword'
    | 'string'
    | 'tag'
    | 'tagBracket'
    | 'attribute'
    | 'punctuation'
    | 'text'
  const tokens: Array<{ type: TokenType; value: string }> = []

  let i = 0
  while (i < code.length) {
    // Whitespace
    if (/\s/.test(code[i])) {
      let ws = ''
      while (i < code.length && /\s/.test(code[i])) {
        ws += code[i++]
      }
      tokens.push({ type: 'text', value: ws })
      continue
    }

    // JSX tags: <Component.Name or </Component or />
    if (code[i] === '<') {
      // Opening bracket
      tokens.push({ type: 'tagBracket', value: '<' })
      i++

      // Check for closing slash
      if (code[i] === '/') {
        tokens.push({ type: 'tagBracket', value: '/' })
        i++
      }

      // Tag name (PascalCase or lowercase html tags)
      let tagName = ''
      while (i < code.length && /[a-zA-Z0-9.]/.test(code[i])) {
        tagName += code[i++]
      }
      if (tagName) {
        tokens.push({ type: 'tag', value: tagName })
      }
      continue
    }

    // Self-closing or closing bracket
    if (code[i] === '/' && code[i + 1] === '>') {
      tokens.push({ type: 'tagBracket', value: '/>' })
      i += 2
      continue
    }

    if (code[i] === '>') {
      tokens.push({ type: 'tagBracket', value: '>' })
      i++
      continue
    }

    // Strings
    if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i]
      let str = quote
      i++
      while (i < code.length && code[i] !== quote) {
        str += code[i++]
      }
      if (i < code.length) str += code[i++]
      tokens.push({ type: 'string', value: str })
      continue
    }

    // Arrow function (check before punctuation to catch => as a unit)
    if (code.slice(i, i + 2) === '=>') {
      tokens.push({ type: 'keyword', value: '=>' })
      i += 2
      continue
    }

    // Braces and punctuation
    if (/[{}()=,;]/.test(code[i])) {
      tokens.push({ type: 'punctuation', value: code[i++] })
      continue
    }

    // Words (identifiers, keywords)
    let word = ''
    while (i < code.length && /[a-zA-Z0-9_$.]/.test(code[i])) {
      word += code[i++]
    }

    if (word) {
      const keywords = [
        'import',
        'from',
        'export',
        'const',
        'let',
        'var',
        'function',
        'return',
        'default',
        'async',
        'await'
      ]
      if (keywords.includes(word)) {
        tokens.push({ type: 'keyword', value: word })
      } else {
        // Check if this looks like an attribute (followed by =)
        let lookahead = i
        while (lookahead < code.length && /\s/.test(code[lookahead]))
          lookahead++
        if (code[lookahead] === '=') {
          tokens.push({ type: 'attribute', value: word })
        } else {
          tokens.push({ type: 'text', value: word })
        }
      }
      continue
    }

    // Fallback: single character
    tokens.push({ type: 'text', value: code[i++] })
  }

  const getColor = (type: TokenType) => {
    return syntaxColors[type] || syntaxColors.text
  }

  const content = tokens.map((token, idx) => (
    <span key={idx} style={{ color: getColor(token.type) }}>
      {token.value}
    </span>
  ))

  return multiline ? (
    <pre className="whitespace-pre leading-relaxed">{content}</pre>
  ) : (
    <code>{content}</code>
  )
}

function CodePreview({
  importStatement,
  usageSnippet,
  color
}: {
  importStatement: string
  usageSnippet: string
  color: string
}) {
  const [copiedImport, setCopiedImport] = useState(false)
  const [copiedUsage, setCopiedUsage] = useState(false)

  const handleCopyImport = () => {
    navigator.clipboard.writeText(importStatement)
    setCopiedImport(true)
    setTimeout(() => setCopiedImport(false), 2000)
  }

  const handleCopyUsage = () => {
    navigator.clipboard.writeText(usageSnippet)
    setCopiedUsage(true)
    setTimeout(() => setCopiedUsage(false), 2000)
  }

  return (
    <div
      className="mt-6 pt-4 space-y-2"
      style={{ borderTop: `1px solid ${colors.border}` }}
    >
      {/* Import statement */}
      <div
        className="group flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg font-mono text-[11px]"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`
        }}
      >
        <div className="overflow-x-auto">
          <SyntaxHighlight code={importStatement} />
        </div>
        <CopyButton onCopy={handleCopyImport} copied={copiedImport} size="xs" />
      </div>

      {/* Usage snippet */}
      <div
        className="group relative px-3 py-3 rounded-lg font-mono text-[11px]"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${color}30`
        }}
      >
        <div className="absolute top-2.5 right-2.5 z-10">
          <CopyButton onCopy={handleCopyUsage} copied={copiedUsage} size="xs" />
        </div>
        <div className="overflow-x-auto">
          <SyntaxHighlight code={usageSnippet} multiline />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Component Cards
// ============================================================================

interface ComponentData {
  id: string
  index: string
  name: string
  tagline: string
  description: string
  icon: LucideIcon
  color: string
  features: Array<{ icon: LucideIcon; title: string; desc: string }>
  tags: string[]
  storybookPath: string
  importStatement: string
  usageSnippet: string
  fullExample: string
  documentation: string
}

interface ComponentCardProps extends ComponentData {
  demoContent: React.ReactNode
  demoPosition?: 'left' | 'right'
  indexPosition?: 'left' | 'right'
}

function ComponentCard({
  index,
  name,
  tagline,
  description,
  icon,
  color,
  features,
  tags,
  storybookPath,
  importStatement,
  usageSnippet,
  demoContent,
  demoPosition = 'right',
  indexPosition = 'left'
}: ComponentCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  })

  const y = useTransform(scrollYProgress, [0, 1], [40, -40])
  const scale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    [0.98, 1, 1, 0.98]
  )

  const infoSection = (
    <div className="p-5 lg:p-10 flex flex-col justify-center h-full">
      <div className="flex items-center gap-4 mb-5">
        <IconBox icon={icon} color={color} />
        <div>
          <h3 className="text-2xl font-medium" style={{ color: colors.text }}>
            {name}
          </h3>
          <p className="text-sm" style={{ color: colors.textMuted }}>
            {tagline}
          </p>
        </div>
      </div>

      <p
        className="mb-6 leading-relaxed text-sm"
        style={{ color: colors.textMuted }}
      >
        {description}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {features.map((feature) => (
          <FeatureItem key={feature.title} {...feature} color={color} />
        ))}
      </div>

      <TagList tags={tags} color={color} />
    </div>
  )

  const demoSection = (
    <div
      className="p-5 lg:p-8 flex flex-col h-full"
      style={{ backgroundColor: colors.bg }}
    >
      {/* Top section: Storybook link */}
      <div className="flex justify-end mb-4 lg:mb-8">
        <a
          href={storybookPath}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider transition-colors hover:opacity-70"
          style={{ color: colors.textMuted }}
        >
          Storybook <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {/* Middle section: Demo content - vertically centered with equal padding */}
      <div className="flex-1 flex items-center justify-center py-4 lg:py-8">
        <div className="w-full max-w-sm">{demoContent}</div>
      </div>

      {/* Bottom section: Code preview */}
      <div className="mt-4 lg:mt-8">
        <CodePreview
          importStatement={importStatement}
          usageSnippet={usageSnippet}
          color={color}
        />
      </div>
    </div>
  )

  return (
    <motion.article
      ref={ref}
      className="rounded-xl overflow-hidden relative"
      style={{
        y,
        scale,
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`
      }}
    >
      {/* Component index label */}
      <div
        className="absolute top-8 font-mono text-[10px] tracking-wider hidden lg:block"
        style={{
          color: colors.textDim,
          [indexPosition]: '-12px',
          transform:
            indexPosition === 'left'
              ? 'rotate(-90deg) translateX(-100%)'
              : 'rotate(90deg)',
          transformOrigin: indexPosition === 'left' ? 'left top' : 'right top'
        }}
      >
        {index}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] auto-rows-fr">
        {demoPosition === 'left' ? (
          <>
            <div className="order-2 lg:order-1 h-full overflow-hidden">
              {demoSection}
            </div>
            <div className="order-1 lg:order-2 h-full overflow-hidden">
              {infoSection}
            </div>
          </>
        ) : (
          <>
            <div className="h-full overflow-hidden">{infoSection}</div>
            <div className="h-full overflow-hidden">{demoSection}</div>
          </>
        )}
      </div>
    </motion.article>
  )
}

// ============================================================================
// Fullscreen Modal
// ============================================================================

interface ComponentModalProps {
  isOpen: boolean
  onClose: () => void
  components: ComponentData[]
  activeIndex: number
  setActiveIndex: (index: number) => void
  demoContents: Record<string, React.ReactNode>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _ComponentModal({
  isOpen,
  onClose,
  components,
  activeIndex,
  setActiveIndex,
  demoContents
}: ComponentModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [copiedInstall, setCopiedInstall] = useState(false)
  const [expandedExample, setExpandedExample] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Handle ESC key and arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (activeIndex < components.length - 1) {
          setActiveIndex(activeIndex + 1)
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        if (activeIndex > 0) {
          setActiveIndex(activeIndex - 1)
        }
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, activeIndex, setActiveIndex, components.length])

  // Scroll to active component
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      const sections = scrollContainerRef.current.querySelectorAll(
        '[data-component-section]'
      )
      sections[activeIndex]?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeIndex, isOpen])

  const handleCopyInstall = () => {
    navigator.clipboard.writeText('bun add @bizarre/ui')
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 overflow-hidden"
          style={{ backgroundColor: colors.bg }}
        >
          {/* Scrollable content with snap */}
          <div
            ref={scrollContainerRef}
            className="h-full overflow-y-auto snap-y snap-mandatory"
            style={{ scrollBehavior: 'smooth' }}
          >
            {components.map((comp, idx) => (
              <section
                key={comp.id}
                data-component-section
                className="min-h-screen snap-start snap-always flex flex-col"
              >
                {/* Full-width header with component info */}
                <div
                  className="flex-shrink-0"
                  style={{
                    backgroundColor: colors.surface,
                    borderBottom: `1px solid ${colors.border}`
                  }}
                >
                  <div className="px-6 lg:px-10 py-4 flex items-center justify-between">
                    {/* Left: Close + Component info */}
                    <div className="flex items-center gap-6">
                      <button
                        onClick={onClose}
                        className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider transition-colors hover:opacity-70"
                        style={{ color: colors.textMuted }}
                      >
                        <X className="w-4 h-4" />
                        <span className="hidden sm:inline">Close</span>
                      </button>

                      <div
                        className="h-6 w-px"
                        style={{ backgroundColor: colors.border }}
                      />

                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center"
                          style={{
                            backgroundColor: `${comp.color}20`,
                            border: `1px solid ${comp.color}40`
                          }}
                        >
                          <comp.icon
                            className="w-4 h-4"
                            style={{ color: comp.color }}
                          />
                        </div>
                        <div>
                          <h1
                            className="text-lg font-medium leading-tight"
                            style={{ color: colors.text }}
                          >
                            {comp.name}
                          </h1>
                          <p
                            className="text-xs hidden sm:block"
                            style={{ color: colors.textMuted }}
                          >
                            {comp.tagline}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Navigation + Links */}
                    <div className="flex items-center gap-4">
                      {/* Component navigation */}
                      <div className="flex items-center gap-1">
                        {components.map((c, i) => (
                          <button
                            key={c.id}
                            onClick={() => setActiveIndex(i)}
                            className="px-2 py-1 text-xs font-mono uppercase tracking-wider rounded transition-all"
                            style={{
                              backgroundColor:
                                i === activeIndex
                                  ? `${c.color}20`
                                  : 'transparent',
                              color:
                                i === activeIndex ? c.color : colors.textMuted,
                              border:
                                i === activeIndex
                                  ? `1px solid ${c.color}40`
                                  : '1px solid transparent'
                            }}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>

                      <div
                        className="h-6 w-px hidden sm:block"
                        style={{ backgroundColor: colors.border }}
                      />

                      <div className="hidden sm:flex items-center gap-3">
                        <a
                          href={comp.storybookPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono uppercase tracking-wider transition-colors hover:opacity-70"
                          style={{ color: colors.textMuted }}
                        >
                          Storybook
                        </a>
                        <a
                          href="https://github.com/bizarre/ui"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider transition-colors hover:opacity-70"
                          style={{ color: colors.text }}
                        >
                          <Github className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main content area */}
                <div className="flex-1 overflow-y-auto">
                  {/* Component showcase - same layout as cards */}
                  <div
                    className="rounded-xl overflow-hidden mx-4 lg:mx-8 mt-6"
                    style={{
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`
                    }}
                  >
                    <div className="grid lg:grid-cols-2 auto-rows-fr">
                      {/* Info side */}
                      <div className="p-6 lg:p-8 flex flex-col h-full">
                        <p
                          className="mb-5 leading-relaxed text-sm"
                          style={{ color: colors.textMuted }}
                        >
                          {comp.description}
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-5">
                          {comp.features.map((feature) => (
                            <FeatureItem
                              key={feature.title}
                              {...feature}
                              color={comp.color}
                            />
                          ))}
                        </div>

                        <div
                          className="flex flex-wrap items-center gap-2 mt-auto pt-5"
                          style={{ borderTop: `1px solid ${colors.border}` }}
                        >
                          {comp.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2.5 py-1 text-xs font-medium rounded-md"
                              style={{
                                backgroundColor: `${comp.color}10`,
                                color: colors.textMuted,
                                border: `1px solid ${comp.color}20`
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Demo side */}
                      <div
                        className="p-6 lg:p-8 flex flex-col h-full"
                        style={{ backgroundColor: colors.bg }}
                      >
                        <div className="flex-1 flex items-center justify-center py-4">
                          <div className="w-full max-w-sm">
                            {demoContents[comp.id]}
                          </div>
                        </div>

                        {/* Code preview in demo */}
                        <div
                          className="mt-4 pt-4 space-y-2"
                          style={{ borderTop: `1px solid ${colors.border}` }}
                        >
                          <div
                            className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg font-mono text-[11px]"
                            style={{
                              backgroundColor: colors.surface,
                              border: `1px solid ${colors.border}`
                            }}
                          >
                            <SyntaxHighlight code={comp.importStatement} />
                            <CopyButton
                              onCopy={() =>
                                navigator.clipboard.writeText(
                                  comp.importStatement
                                )
                              }
                              copied={false}
                              size="xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Extended content - two column layout */}
                    <div
                      className="grid lg:grid-cols-5 gap-0"
                      style={{ borderTop: `1px solid ${colors.border}` }}
                    >
                      {/* Left: Code Examples (3 cols) */}
                      <div
                        className="lg:col-span-3 p-6 lg:p-8"
                        style={{ backgroundColor: colors.bg }}
                      >
                        {/* Header with toggle */}
                        <div className="flex items-center justify-between mb-4">
                          <div
                            className="flex items-center gap-1 p-0.5 rounded-lg"
                            style={{ backgroundColor: colors.surface }}
                          >
                            <button
                              onClick={() => setExpandedExample(null)}
                              className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-all"
                              style={{
                                backgroundColor:
                                  expandedExample !== comp.id
                                    ? colors.bg
                                    : 'transparent',
                                color:
                                  expandedExample !== comp.id
                                    ? colors.text
                                    : colors.textMuted,
                                border:
                                  expandedExample !== comp.id
                                    ? `1px solid ${colors.border}`
                                    : '1px solid transparent'
                              }}
                            >
                              Minimal
                            </button>
                            <button
                              onClick={() => setExpandedExample(comp.id)}
                              className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-all"
                              style={{
                                backgroundColor:
                                  expandedExample === comp.id
                                    ? colors.bg
                                    : 'transparent',
                                color:
                                  expandedExample === comp.id
                                    ? colors.text
                                    : colors.textMuted,
                                border:
                                  expandedExample === comp.id
                                    ? `1px solid ${colors.border}`
                                    : '1px solid transparent'
                              }}
                            >
                              Full Example
                            </button>
                          </div>
                          <CopyButton
                            onCopy={() =>
                              handleCopyCode(
                                expandedExample === comp.id
                                  ? comp.fullExample
                                  : comp.usageSnippet
                              )
                            }
                            copied={copiedCode}
                            size="sm"
                          />
                        </div>

                        {/* Code block with file indicator */}
                        <div
                          className="rounded-lg overflow-hidden"
                          style={{ border: `1px solid ${comp.color}30` }}
                        >
                          {/* File tab */}
                          <div
                            className="px-4 py-2 flex items-center gap-2"
                            style={{
                              backgroundColor: colors.surface,
                              borderBottom: `1px solid ${colors.border}`
                            }}
                          >
                            <div className="flex gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: '#ff5f57' }}
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: '#febc2e' }}
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: '#28c840' }}
                              />
                            </div>
                            <span
                              className="text-[10px] font-mono ml-2"
                              style={{ color: colors.textDim }}
                            >
                              {expandedExample === comp.id
                                ? `${comp.id}-example.tsx`
                                : 'usage.tsx'}
                            </span>
                          </div>
                          {/* Code content */}
                          <div
                            className="p-4 font-mono text-[11px] overflow-x-auto max-h-[320px] overflow-y-auto"
                            style={{ backgroundColor: colors.bg }}
                          >
                            <SyntaxHighlight
                              code={
                                expandedExample === comp.id
                                  ? comp.fullExample
                                  : comp.usageSnippet
                              }
                              multiline
                            />
                          </div>
                        </div>

                        {/* Install command */}
                        <div className="mt-4 flex items-center gap-3">
                          <span
                            className="text-[10px] font-mono uppercase tracking-wider"
                            style={{ color: colors.textDim }}
                          >
                            Install
                          </span>
                          <div
                            className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg font-mono text-xs"
                            style={{
                              backgroundColor: colors.surface,
                              border: `1px solid ${colors.border}`
                            }}
                          >
                            <span>
                              <span style={{ color: colors.lime }}>$</span>{' '}
                              <span style={{ color: colors.text }}>
                                bun add @bizarre/ui
                              </span>
                            </span>
                            <CopyButton
                              onCopy={handleCopyInstall}
                              copied={copiedInstall}
                              size="xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right: About (2 cols) */}
                      <div
                        className="lg:col-span-2 p-6 lg:p-8 flex flex-col"
                        style={{ borderLeft: `1px solid ${colors.border}` }}
                      >
                        <h3
                          className="text-[10px] font-mono uppercase tracking-wider mb-4"
                          style={{ color: colors.textDim }}
                        >
                          About {comp.name}
                        </h3>
                        <p
                          className="text-sm leading-relaxed flex-1"
                          style={{ color: colors.textMuted, maxWidth: '42ch' }}
                        >
                          {comp.documentation}
                        </p>

                        {/* Links */}
                        <div
                          className="flex items-center gap-3 mt-6 pt-4"
                          style={{ borderTop: `1px solid ${colors.border}` }}
                        >
                          <a
                            href={comp.storybookPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors hover:opacity-80"
                            style={{
                              backgroundColor: `${comp.color}20`,
                              color: comp.color,
                              border: `1px solid ${comp.color}40`
                            }}
                          >
                            Storybook <ArrowUpRight className="w-3 h-3" />
                          </a>
                          <a
                            href="https://github.com/bizarre/ui"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors hover:opacity-80"
                            style={{
                              backgroundColor: colors.surfaceLight,
                              color: colors.text,
                              border: `1px solid ${colors.border}`
                            }}
                          >
                            <Github className="w-3 h-3" /> Source
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Next component indicator */}
                  {idx < components.length - 1 && (
                    <div className="py-8 text-center">
                      <button
                        onClick={() => setActiveIndex(idx + 1)}
                        className="inline-flex flex-col items-center gap-2 text-xs font-mono uppercase tracking-wider transition-colors hover:opacity-70"
                        style={{ color: colors.textDim }}
                      >
                        <span>Next: {components[idx + 1].name}</span>
                        <ChevronDown className="w-4 h-4 animate-bounce" />
                      </button>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ============================================================================
// Demo Contents
// ============================================================================

function InlayDemo() {
  return (
    <ClientOnly
      load={() => import('../../components/inlay-example')}
      fallback={
        <div
          className="rounded-lg px-4 py-3"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`
          }}
        >
          <div
            className="h-12 rounded animate-pulse"
            style={{ backgroundColor: colors.surfaceLight }}
          />
        </div>
      }
    >
      {(InlayExample) => <InlayExample />}
    </ClientOnly>
  )
}

function ChronoDemo() {
  return (
    <ClientOnly
      load={() => import('../../components/chrono-example')}
      fallback={
        <div
          className="rounded-lg px-4 py-3"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`
          }}
        >
          <div
            className="h-6 rounded animate-pulse"
            style={{ backgroundColor: colors.surfaceLight }}
          />
        </div>
      }
    >
      {(ChronoExample) => <ChronoExample />}
    </ClientOnly>
  )
}

// ============================================================================
// Component Data
// ============================================================================

const componentsData: ComponentData[] = [
  {
    id: 'inlay',
    index: '01 / INLAY',
    name: 'Inlay',
    tagline: 'Structured text input',
    description:
      'A composable input primitive for building rich text experiences with tokens, mentions, search filters, and more. Fully headless, fully accessible.',
    icon: TextCursorInput,
    color: colors.lime,
    features: [
      {
        icon: Sparkles,
        title: 'Token rendering',
        desc: 'React components as tokens'
      },
      {
        icon: MessageSquare,
        title: 'Mentions',
        desc: '@mention support built-in'
      },
      { icon: Keyboard, title: 'Native UX', desc: 'Feels like a real input' },
      { icon: Globe, title: 'Accessible', desc: 'WCAG 2.1 compliant' }
    ],
    tags: ['Mentions', 'Search filters', 'AI inputs', 'Tags'],
    storybookPath: '/storybook/?path=/story/inlay',
    importStatement: `import { Inlay } from '@bizarre/ui'`,
    usageSnippet: `<Inlay.Root>
  <Inlay.Input placeholder="Type here..." />
  <Inlay.Tokens>
    {tokens.map(t => <Inlay.Token key={t.id} />)}
  </Inlay.Tokens>
</Inlay.Root>`,
    fullExample: `import { useState } from 'react'
import { Inlay } from '@bizarre/ui'

function MentionInput() {
  const [tokens, setTokens] = useState([])
  const [value, setValue] = useState('')

  const handleMention = (user) => {
    setTokens([...tokens, { 
      id: user.id, 
      type: 'mention',
      label: user.name 
    }])
  }

  return (
    <Inlay.Root 
      tokens={tokens} 
      onTokensChange={setTokens}
      value={value}
      onValueChange={setValue}
    >
      <Inlay.Input placeholder="Type @ to mention..." />
      <Inlay.Tokens>
        {tokens.map(token => (
          <Inlay.Token 
            key={token.id}
            onRemove={() => removeToken(token.id)}
          >
            @{token.label}
          </Inlay.Token>
        ))}
      </Inlay.Tokens>
      <Inlay.Portal>
        <MentionSuggestions onSelect={handleMention} />
      </Inlay.Portal>
    </Inlay.Root>
  )
}`,
    documentation:
      'Inlay is a headless, composable input component designed for building rich text experiences. It handles the complex state management of tokens, cursor position, selection, and keyboard navigation while giving you complete control over the visual presentation. Perfect for building mention systems, tag inputs, search filters with structured tokens, or AI chat interfaces with inline components.'
  },
  {
    id: 'chrono',
    index: '02 / CHRONO',
    name: 'Chrono',
    tagline: 'Intelligent time picker',
    description:
      'A time range picker that understands natural language. Type "last 2 weeks" or "yesterday to tomorrow" and watch it parse your intent.',
    icon: Clock,
    color: colors.cyan,
    features: [
      {
        icon: MessageSquare,
        title: 'Natural language',
        desc: 'Powered by chrono-node'
      },
      { icon: Keyboard, title: 'Keyboard nav', desc: 'Arrow keys to modify' },
      { icon: Globe, title: 'Timezone aware', desc: 'Handles TZ correctly' },
      { icon: Zap, title: 'Quick shortcuts', desc: '15m, 1h, 1d presets' }
    ],
    tags: ['Analytics', 'Logs', 'Dashboards', 'Monitoring'],
    storybookPath: '/storybook/?path=/story/chrono',
    importStatement: `import { Chrono } from '@bizarre/ui'`,
    usageSnippet: `<Chrono.Root onDateRangeChange={setRange}>
  <Chrono.Trigger>
    <Chrono.Input />
  </Chrono.Trigger>
  <Chrono.Portal>
    <Chrono.Shortcut duration={{ hours: 1 }} />
  </Chrono.Portal>
</Chrono.Root>`,
    fullExample: `import { useState } from 'react'
import { Chrono } from '@bizarre/ui'

function LogsFilter() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 1000 * 60 * 15),
    endDate: new Date()
  })

  return (
    <Chrono.Root
      defaultDateRange={dateRange}
      onDateRangeChange={setDateRange}
      timezone="America/New_York"
    >
      <Chrono.Trigger asChild>
        <button className="filter-button">
          <Chrono.Input placeholder="Select time range" />
        </button>
      </Chrono.Trigger>
      
      <Chrono.Portal>
        <div className="shortcuts">
          <Chrono.Shortcut duration={{ minutes: 15 }}>
            Last 15 minutes
          </Chrono.Shortcut>
          <Chrono.Shortcut duration={{ hours: 1 }}>
            Last hour
          </Chrono.Shortcut>
          <Chrono.Shortcut duration={{ days: 1 }}>
            Last 24 hours
          </Chrono.Shortcut>
          <Chrono.Shortcut duration={{ weeks: 1 }}>
            Last week
          </Chrono.Shortcut>
        </div>
      </Chrono.Portal>
    </Chrono.Root>
  )
}`,
    documentation:
      'Chrono is a time range picker component with natural language parsing capabilities. It uses chrono-node under the hood to parse human-readable time expressions like "last 2 weeks", "yesterday", or "past 30 minutes". The component supports keyboard navigation for quick adjustments, timezone-aware date handling, and customizable shortcut presets. Ideal for analytics dashboards, log viewers, monitoring tools, or any application that needs flexible time range selection.'
  }
]

const demoContents: Record<string, React.ReactNode> = {
  inlay: <InlayDemo />,
  chrono: <ChronoDemo />
}

// ============================================================================
// Layout Components
// ============================================================================

function Header() {
  return (
    <header className="px-6 lg:px-12 pt-8 lg:pt-12 pb-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span
            className="font-mono text-xs uppercase tracking-wider"
            style={{ color: colors.text }}
          >
            bizarre/ui
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-widest hidden sm:inline"
            style={{ color: colors.textDim }}
          >
            v{packageJson.version}
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider">
          <a
            href="/storybook"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:opacity-70 hidden sm:block"
            style={{ color: colors.textMuted }}
          >
            Storybook
          </a>
          <a
            href="https://github.com/bizarre/ui"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:opacity-70"
            style={{ color: colors.text }}
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Source</span>
          </a>
        </div>
      </div>
    </header>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 lg:px-12 pt-8 pb-4 lg:pt-12 lg:pb-6">
      <div className="max-w-5xl mx-auto">
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: colors.textDim }}
        >
          {children}
        </p>
      </div>
    </div>
  )
}

function InstallCTA() {
  const [copied, setCopied] = useState(false)
  const command = 'bun add @bizarre/ui'

  const handleCopy = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="px-6 lg:px-12 pt-10 lg:pt-14 pb-16 lg:pb-20">
      <div className="max-w-2xl mx-auto text-center">
        <p
          className="text-[10px] font-mono uppercase tracking-widest mb-4"
          style={{ color: colors.textDim }}
        >
          Install
        </p>
        <button
          onClick={handleCopy}
          className="group inline-flex items-center gap-3 px-6 py-3 rounded-lg font-mono text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            color: colors.text
          }}
        >
          <span style={{ color: colors.lime }}>$</span>
          <span>{command}</span>
          <CopyButton onCopy={handleCopy} copied={copied} />
        </button>
        <p className="text-xs mt-4 font-mono" style={{ color: colors.textDim }}>
          <a
            href="https://github.com/bizarre/ui"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline transition-colors"
            style={{ color: colors.magenta }}
          >
            github.com/bizarre/ui
          </a>
        </p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer
      className="px-6 lg:px-12 py-4"
      style={{ borderTop: `1px solid ${colors.border}` }}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest">
          <a
            href="https://github.com/bizarre/ui"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:opacity-70"
            style={{ color: colors.textMuted }}
          >
            <Github className="w-3 h-3" />
            GitHub
          </a>
          <a
            href="/storybook"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:opacity-70"
            style={{ color: colors.textMuted }}
          >
            Storybook
          </a>
        </div>

        <span
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: colors.textDim }}
        >
          <a
            href="https://bizar.re"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:opacity-70"
          >
            Alex Adewole
          </a>
        </span>
      </div>
    </footer>
  )
}

// ============================================================================
// Page
// ============================================================================

export default function Page() {
  return (
    <div
      className="min-h-screen relative"
      style={{ backgroundColor: colors.bg }}
    >
      {/* Fixed gutter elements */}
      <GutterText side="left" top="50%">
        @bizarre/ui · v{packageJson.version}
      </GutterText>

      <GutterText side="right" top="50%">
        Headless · Accessible · Composable
      </GutterText>

      <Header />

      <SectionLabel>Components</SectionLabel>

      {/* Component Cards */}
      <section className="px-6 lg:px-12">
        <div className="max-w-5xl mx-auto space-y-8 lg:space-y-12">
          <ComponentCard
            {...componentsData[0]}
            demoContent={demoContents[componentsData[0].id]}
            demoPosition="right"
            indexPosition="left"
          />
          <ComponentCard
            {...componentsData[1]}
            demoContent={demoContents[componentsData[1].id]}
            demoPosition="left"
            indexPosition="right"
          />
        </div>
      </section>

      <InstallCTA />
      <Footer />
    </div>
  )
}
