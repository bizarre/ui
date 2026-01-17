import { test, expect } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import { DivergedTokenInlay } from './fixtures/diverged-token-inlay'
import { Root } from '../../inlay'

test.describe('Inlay accessibility', () => {
  test('empty state has no a11y violations', async ({ mount, page }) => {
    await mount(<DivergedTokenInlay initial="" />)
    const results = await new AxeBuilder({ page })
      .include('[role="textbox"]')
      .analyze()
    expect(results.violations).toEqual([])
  })

  test('with tokens has no a11y violations', async ({ mount, page }) => {
    await mount(<DivergedTokenInlay initial="Hello @alice!" />)
    const results = await new AxeBuilder({ page })
      .include('[role="textbox"]')
      .analyze()
    expect(results.violations).toEqual([])
  })

  test('focused state has no a11y violations', async ({ mount, page }) => {
    await mount(<DivergedTokenInlay initial="Hello @alice!" />)
    await page.getByRole('textbox').focus()
    const results = await new AxeBuilder({ page })
      .include('[role="textbox"]')
      .analyze()
    expect(results.violations).toEqual([])
  })

  test('has default aria-label', async ({ mount, page }) => {
    await mount(
      <Root defaultValue="">
        <span />
      </Root>
    )
    const editor = page.getByRole('textbox')
    await expect(editor).toHaveAttribute('aria-label', 'Text input')
  })

  test('aria-label can be overridden', async ({ mount, page }) => {
    await mount(
      <Root defaultValue="" aria-label="Message composer">
        <span />
      </Root>
    )
    const editor = page.getByRole('textbox')
    await expect(editor).toHaveAttribute('aria-label', 'Message composer')
  })
})
