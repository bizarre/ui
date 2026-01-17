import { test, expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'
import type { MountResult } from '@playwright/experimental-ct-react'
import { PortalNavigationInlay } from './fixtures/portal-navigation-inlay'

test.describe('Portal keyboard navigation (CT)', () => {
  // Helper to set up the test with portal open
  async function setupPortal(
    mount: (component: React.ReactElement) => Promise<MountResult>,
    page: Page
  ) {
    await mount(<PortalNavigationInlay initial="hello @test" />)

    const editor = page.getByTestId('editor')
    await expect(editor).toBeVisible()

    // Wait for token to be rendered - scope to editor to avoid hidden first-pass
    const tokenRender = editor.getByTestId('token-render')
    await expect(tokenRender).toBeVisible()

    // Click on the token to activate portal
    await tokenRender.click()

    // Wait for portal to appear
    const portal = page.getByTestId('portal')
    await expect(portal).toBeVisible()

    return { editor, portal }
  }

  test('ArrowDown navigates to next item', async ({ mount, page }) => {
    await setupPortal(mount, page)

    // First item should be active by default
    const item1 = page.getByTestId('item-1')
    const item2 = page.getByTestId('item-2')

    await expect(item1).toHaveAttribute('data-active')
    await expect(item2).not.toHaveAttribute('data-active')

    // Press ArrowDown
    await page.keyboard.press('ArrowDown')

    await expect(item1).not.toHaveAttribute('data-active')
    await expect(item2).toHaveAttribute('data-active')
  })

  test('ArrowUp navigates to previous item', async ({ mount, page }) => {
    await setupPortal(mount, page)

    // Navigate down first
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    const item3 = page.getByTestId('item-3')
    await expect(item3).toHaveAttribute('data-active')

    // Press ArrowUp
    await page.keyboard.press('ArrowUp')

    const item2 = page.getByTestId('item-2')
    await expect(item2).toHaveAttribute('data-active')
  })

  test('ArrowDown wraps from last to first item', async ({ mount, page }) => {
    await setupPortal(mount, page)

    // Navigate to last item
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    const item3 = page.getByTestId('item-3')
    await expect(item3).toHaveAttribute('data-active')

    // Press ArrowDown again - should wrap to first
    await page.keyboard.press('ArrowDown')

    const item1 = page.getByTestId('item-1')
    await expect(item1).toHaveAttribute('data-active')
  })

  test('ArrowUp wraps from first to last item', async ({ mount, page }) => {
    await setupPortal(mount, page)

    // First item is active by default
    const item1 = page.getByTestId('item-1')
    await expect(item1).toHaveAttribute('data-active')

    // Press ArrowUp - should wrap to last
    await page.keyboard.press('ArrowUp')

    const item3 = page.getByTestId('item-3')
    await expect(item3).toHaveAttribute('data-active')
  })

  test('Enter selects the active item', async ({ mount, page }) => {
    await setupPortal(mount, page)

    // Navigate to second item
    await page.keyboard.press('ArrowDown')

    // Press Enter to select
    await page.keyboard.press('Enter')

    // Check that the item was selected
    const selected = page.getByTestId('selected')
    await expect(selected).toHaveText('Banana')

    // Check that the raw value was updated
    const rawValue = page.getByTestId('raw-value')
    await expect(rawValue).toHaveText('hello @2 ')
  })

  test('Mouse hover changes active item', async ({ mount, page }) => {
    await setupPortal(mount, page)

    const item1 = page.getByTestId('item-1')
    const item3 = page.getByTestId('item-3')

    // First item is active by default
    await expect(item1).toHaveAttribute('data-active')

    // Hover over third item
    await item3.hover()

    // Third item should now be active
    await expect(item3).toHaveAttribute('data-active')
    await expect(item1).not.toHaveAttribute('data-active')
  })

  test('Click selects the item', async ({ mount, page }) => {
    await setupPortal(mount, page)

    // Click on third item
    const item3 = page.getByTestId('item-3')
    await item3.click()

    // Check that the item was selected
    const selected = page.getByTestId('selected')
    await expect(selected).toHaveText('Cherry')

    // Check that the raw value was updated
    const rawValue = page.getByTestId('raw-value')
    await expect(rawValue).toHaveText('hello @3 ')
  })

  test('Focus stays in editor after navigation', async ({ mount, page }) => {
    const { editor } = await setupPortal(mount, page)

    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    // Focus should still be in editor
    await expect(editor).toBeFocused()
  })
})
