import React from 'react'
import ReactDOM from 'react-dom/client'
import type { PageContextClient } from 'vike/types'
import type { ComponentType } from 'react'
import '../globals.css'

export function onRenderClient(pageContext: PageContextClient) {
  const Page = pageContext.Page as ComponentType<any>

  const { pageProps } = pageContext as PageContextClient & {
    pageProps?: Record<string, unknown>
  }

  if (!Page)
    throw new Error(
      'Client-side render: Page component is undefined after casting.'
    )

  const root = document.getElementById('root')!
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Page {...pageProps} />
    </React.StrictMode>
  )
}
