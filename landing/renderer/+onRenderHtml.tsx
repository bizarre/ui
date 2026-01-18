import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { escapeInject, dangerouslySkipEscape } from 'vike/server'
import type { PageContextServer } from 'vike/types'
import type { ComponentType } from 'react'

export function onRenderHtml(pageContext: PageContextServer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Page = pageContext.Page as ComponentType<any>

  const { pageProps } = pageContext as PageContextServer & {
    pageProps?: Record<string, unknown>
  }

  if (!Page) {
    throw new Error(
      'Server-side render: Page component is undefined after casting.'
    )
  }

  const pageHtml = ReactDOMServer.renderToString(<Page {...pageProps} />)

  return escapeInject`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>@bizarre/ui</title>
        <meta name="description" content="A collection of headless React components nobody asked for" />
      </head>
      <body style="background-color: #0A0A0A;">
        <div id="root">${dangerouslySkipEscape(pageHtml)}</div>
      </body>
    </html>`
}
