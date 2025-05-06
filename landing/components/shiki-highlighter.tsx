import React, { useEffect, useState, useId } from 'react'
import { codeToHtml } from 'shiki'

interface ShikiHighlighterProps {
  code: string
  language: string
  theme?: string
  className?: string
}

function ShikiHighlighter({
  code,
  language,
  theme = 'github-dark',
  className = ''
}: ShikiHighlighterProps) {
  const [html, setHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const id = useId()
  const containerId = `shiki-${id.replace(/:/g, '')}`

  useEffect(() => {
    let isMounted = true

    const highlight = async () => {
      try {
        setIsLoading(true)
        // Using the shorthand codeToHtml function which handles all the loading for us
        const html = await codeToHtml(code, {
          lang: language,
          theme: 'rose-pine' // Using a theme that works well on dark backgrounds
        })

        if (isMounted) {
          setHtml(html)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to highlight code:', err)
        setError('Failed to highlight code')
        setIsLoading(false)
      }
    }

    highlight()

    return () => {
      isMounted = false
    }
  }, [code, language, theme])

  if (error) {
    return (
      <pre className={`p-4 rounded-lg bg-red-900/20 text-red-400 ${className}`}>
        {error}
      </pre>
    )
  }

  if (isLoading) {
    return (
      <pre className={`p-4 rounded-lg animate-pulse bg-black/50 ${className}`}>
        <code className="text-zinc-300 text-xs font-mono">{code}</code>
      </pre>
    )
  }

  // Add scoped CSS with a unique ID to fix the styling without affecting other components
  const customStyles = `
    #${containerId} .shiki {
      background-color: transparent !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.75rem !important;
      line-height: 1.5;
      text-align: left;
      border-radius: 0;
      margin: 0;
      padding: 0 !important;
    }
    #${containerId} .shiki code {
      font-size: 0.75rem !important;
    }
    #${containerId} .shiki .line {
      font-size: 0.75rem !important;
    }
  `

  return (
    <div id={containerId} className={className}>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export default ShikiHighlighter
