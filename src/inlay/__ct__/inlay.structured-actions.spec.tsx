import { test, expect } from '@playwright/experimental-ct-react'
import { StructuredActionsInlay } from './fixtures/structured-actions-inlay'

test.describe('StructuredInlay replace/update actions (CT)', () => {
  test('update changes rendered label without changing raw value', async ({
    mount,
    page
  }) => {
    await mount(<StructuredActionsInlay initial="hello @alice world" />)

    const ed = page.getByTestId('editor')
    await expect(ed).toBeVisible()

    // Wait for token to be weaved (scope to editor to avoid hidden first-pass element)
    const tokenRender = ed.getByTestId('token-render')
    await expect(tokenRender).toBeVisible()
    await expect(tokenRender).toHaveText('@alice')

    // Click on the token to activate portal
    await tokenRender.click()

    // Wait for portal to appear
    const portal = page.getByTestId('portal')
    await expect(portal).toBeVisible()

    // Click the update button
    await page.getByTestId('btn-update').click()

    // Verify rendered label changed
    await expect(tokenRender).toHaveText('UpdatedLabel')

    // Verify raw value is unchanged
    const rawValue = page.getByTestId('raw-value')
    await expect(rawValue).toHaveText('hello @alice world')
  })

  test('replace changes raw value', async ({ mount, page }) => {
    await mount(<StructuredActionsInlay initial="hello @alice world" />)

    const ed = page.getByTestId('editor')
    await expect(ed).toBeVisible()

    // Wait for token to be weaved (scope to editor)
    const tokenRender = ed.getByTestId('token-render')
    await expect(tokenRender).toBeVisible()

    // Click on the token to activate portal
    await tokenRender.click()

    // Wait for portal to appear
    const portal = page.getByTestId('portal')
    await expect(portal).toBeVisible()

    // Click the replace button (replaces @alice with @replaced)
    await page.getByTestId('btn-replace').click()

    // Verify raw value changed
    const rawValue = page.getByTestId('raw-value')
    await expect(rawValue).toHaveText('hello @replaced world')

    // Verify the new token is rendered
    await expect(tokenRender).toHaveText('@replaced')
  })

  test('replace positions caret at end of new text', async ({
    mount,
    page
  }) => {
    await mount(<StructuredActionsInlay initial="hi @a bye" />)

    const ed = page.getByTestId('editor')
    await expect(ed).toBeVisible()

    // Wait for token (scope to editor)
    const tokenRender = ed.getByTestId('token-render')
    await expect(tokenRender).toBeVisible()
    await expect(tokenRender).toHaveText('@a')

    // Click on token to activate portal
    await tokenRender.click()
    await expect(page.getByTestId('portal')).toBeVisible()

    // Replace @a with @replaced
    // The portal has onMouseDown preventDefault, so focus stays in editor
    await page.getByTestId('btn-replace').click()

    // Verify the value updated correctly
    const rawValue = page.getByTestId('raw-value')
    await expect(rawValue).toHaveText('hi @replaced bye')

    // Type to verify caret position (focus should still be in editor)
    await page.keyboard.type('X')

    // Caret should be after @replaced
    await expect(rawValue).toHaveText('hi @replacedX bye')
  })

  test('replace with longer text updates raw value correctly', async ({
    mount,
    page
  }) => {
    await mount(<StructuredActionsInlay initial="hi @a bye" />)

    const ed = page.getByTestId('editor')
    await expect(ed).toBeVisible()

    // Wait for token (scope to editor)
    const tokenRender = ed.getByTestId('token-render')
    await expect(tokenRender).toBeVisible()
    await expect(tokenRender).toHaveText('@a')

    // Click on token to activate portal
    await tokenRender.click()
    await expect(page.getByTestId('portal')).toBeVisible()

    // Replace @a with @replaced
    await page.getByTestId('btn-replace').click()

    // Verify the value updated correctly
    const rawValue = page.getByTestId('raw-value')
    await expect(rawValue).toHaveText('hi @replaced bye')

    // Verify the token is re-rendered with new value
    await expect(tokenRender).toHaveText('@replaced')
  })
})
