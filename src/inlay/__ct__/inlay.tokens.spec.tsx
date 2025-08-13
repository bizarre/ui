import { test, expect } from '@playwright/experimental-ct-react'
import { ControlledTokenInlay } from './fixtures/controlled-token-inlay'

test.describe('Token-aware deletions (CT)', () => {
  test('Backspace at end of token deletes last raw char', async ({
    mount,
    page
  }) => {
    await mount(<ControlledTokenInlay initial={'A@xB'} />)

    const ed = page.getByRole('textbox')
    await ed.click()
    // Ensure token has been weaved into the DOM and content is present
    await expect(ed.locator('[data-token-text="@x"]').first()).toBeVisible()
    await expect(ed).toHaveText('A@xB')
    // overshoot to the right
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Backspace')
    await expect(ed).toHaveText('A@B')
    await expect(ed.locator('[data-token-text]')).toHaveCount(0)
  })

  test('Range delete across token removes the token completely', async ({
    mount,
    page
  }) => {
    await mount(<ControlledTokenInlay initial={'A@xB'} />)

    const ed = page.getByRole('textbox')
    await ed.click()
    // Ensure token has been weaved into the DOM and content is present
    const token = ed.locator('[data-token-text="@x"]').first()
    await expect(token).toBeVisible()
    await expect(ed).toHaveText('A@xB')
    const edBox = await ed.boundingBox()
    const tokBox = await token.boundingBox()
    if (!edBox || !tokBox) throw new Error('no boxes')
    const y = edBox.y + edBox.height / 2
    const startX = Math.max(edBox.x + 2, tokBox.x - 4)
    const endX = Math.min(
      edBox.x + edBox.width - 2,
      tokBox.x + tokBox.width + 2
    )
    await page.mouse.move(startX, y)
    await page.mouse.down()
    await page.mouse.move(endX, y, { steps: 5 })
    await page.mouse.up()
    await page.keyboard.press('Backspace')
    await expect(ed).toHaveText('AB')
    await expect(ed.locator('[data-token-text]')).toHaveCount(0)
  })
})
