import { test, expect } from '@playwright/experimental-ct-react'
import { MobileInlay, SimpleMobileInlay } from './fixtures/mobile-inlay'

// These tests run on mobile projects defined in playwright-ct.config.mts
// Run with: bun run test:ct -- --project=mobile-chrome
// or: bun run test:ct -- --project=mobile-safari

test.describe('Mobile touch interaction', () => {
  test('tap positions caret in editor', async ({ mount, page }) => {
    await mount(<SimpleMobileInlay initial="Hello world" />)

    const editor = page.getByRole('textbox')
    await expect(editor).toHaveCount(1)

    // Click to focus (tap in mobile projects)
    await editor.click()
    await expect(editor).toBeFocused()
  })

  test('editor has correct mobile attributes', async ({ mount, page }) => {
    await mount(<SimpleMobileInlay initial="" />)

    const editor = page.getByRole('textbox')
    await expect(editor).toHaveAttribute('inputmode', 'text')
    await expect(editor).toHaveAttribute('autocapitalize', 'sentences')
    await expect(editor).toHaveAttribute('autocorrect', 'off')
    await expect(editor).toHaveAttribute('spellcheck', 'false')
  })

  test('editor has touch-action manipulation style', async ({
    mount,
    page
  }) => {
    await mount(<SimpleMobileInlay initial="" />)

    const editor = page.getByRole('textbox')
    const touchAction = await editor.evaluate(
      (el) => window.getComputedStyle(el).touchAction
    )
    expect(touchAction).toBe('manipulation')
  })

  test('typing works after focus', async ({ mount, page }) => {
    await mount(<SimpleMobileInlay initial="" />)

    const editor = page.getByRole('textbox')
    await editor.click()

    // Type one character at a time and verify it appears
    await page.keyboard.type('a')
    const rawValue = await page.getByTestId('raw-value').textContent()
    expect(rawValue).toContain('a')
  })

  test('text editing works', async ({ mount, page }) => {
    await mount(<SimpleMobileInlay initial="Hello world" />)

    const editor = page.getByRole('textbox')
    await editor.click()
    await expect(editor).toBeFocused()

    // Type at caret position
    await page.keyboard.type('!')
    // Value should have changed
    const rawValue = await page.getByTestId('raw-value').textContent()
    expect(rawValue).toContain('!')
  })
})

test.describe('Portal interaction', () => {
  test('portal items respond to click/tap', async ({ mount, page }) => {
    await mount(<MobileInlay initial="@a" />)

    const editor = page.getByRole('textbox')
    await editor.click()

    // Portal should be visible when there's a mention token
    const portal = page.getByTestId('portal')
    await expect(portal).toBeVisible()

    // Click on a portal item
    const item = page.getByTestId('item-1')
    await expect(item).toBeVisible()
    await item.click()

    // Should have selected the item
    await expect(page.getByTestId('selected')).toHaveText('Apple')
  })

  test('portal item selection works', async ({ mount, page }) => {
    await mount(<MobileInlay initial="@a" />)

    const editor = page.getByRole('textbox')
    await editor.click()

    const portal = page.getByTestId('portal')
    await expect(portal).toBeVisible()

    // Click item 2
    const item2 = page.getByTestId('item-2')
    await item2.click()

    // Should have selected item 2
    await expect(page.getByTestId('selected')).toHaveText('Banana')
  })

  test('portal has touch-action manipulation style', async ({
    mount,
    page
  }) => {
    await mount(<MobileInlay initial="@a" />)

    const editor = page.getByRole('textbox')
    await editor.click()

    const portal = page.getByTestId('portal-list')
    await expect(portal).toBeVisible()

    const touchAction = await portal.evaluate(
      (el) => window.getComputedStyle(el).touchAction
    )
    expect(touchAction).toBe('manipulation')
  })
})

test.describe('Token interaction', () => {
  test('interacting near token works correctly', async ({ mount, page }) => {
    await mount(<SimpleMobileInlay initial="Hello @user world" />)

    const editor = page.getByRole('textbox')
    await editor.click()

    // Should be able to type
    await page.keyboard.type('!')
    const rawValue = await page.getByTestId('raw-value').textContent()
    expect(rawValue).toContain('!')
  })

  test('backspace near token works', async ({ mount, page }) => {
    await mount(<SimpleMobileInlay initial="a@user" />)

    const editor = page.getByRole('textbox')
    await editor.click()

    // Move to end
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')

    // Backspace should delete token characters
    await page.keyboard.press('Backspace')
    const rawValue = await page.getByTestId('raw-value').textContent()
    // Should have deleted something
    expect(rawValue?.length).toBeLessThan('a@user'.length)
  })
})
