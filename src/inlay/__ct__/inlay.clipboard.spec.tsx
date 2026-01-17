import { test, expect } from '@playwright/experimental-ct-react'
import { DivergedTokenInlay } from './fixtures/diverged-token-inlay'

// Run clipboard tests serially to avoid clipboard state pollution between parallel tests
test.describe.serial('Clipboard operations with diverged tokens (CT)', () => {
  test('Select all (Ctrl/Cmd+a) selects entire content', async ({
    mount,
    page
  }) => {
    await mount(<DivergedTokenInlay initial="Hello World" />)

    const ed = page.getByRole('textbox')
    await ed.click()
    await expect(ed).toHaveText('Hello World')

    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await expect(ed).toHaveText('')
  })

  test('Copy and paste a diverged token preserves raw value', async ({
    mount,
    page
  }) => {
    await mount(<DivergedTokenInlay initial="Hello @alice!" />)

    const ed = page.getByRole('textbox')
    await ed.click()
    await expect(ed).toHaveText('Hello Alice!')

    // Navigate to token: start → right 6 (past "Hello ") → select token
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowLeft')
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')

    await page.keyboard.press('ControlOrMeta+c')

    // Move to end and paste
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ControlOrMeta+v')

    await expect(ed).toHaveText('Hello Alice!Alice')
    await expect(ed.locator('[data-token-text="@alice"]')).toHaveCount(2)
  })

  test('Copy text containing diverged token includes raw value', async ({
    mount,
    page
  }) => {
    await mount(<DivergedTokenInlay initial="A@aliceB" />)

    const ed = page.getByRole('textbox')
    await ed.click()
    await expect(ed).toHaveText('AAliceB')

    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('ControlOrMeta+c')

    // Clear and type X
    await page.keyboard.press('Backspace')
    await expect(ed).toHaveText('')
    await page.keyboard.type('X')
    await expect(ed).toHaveText('X')

    // Paste at end
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ControlOrMeta+v')

    await expect(ed).toHaveText('XAAliceB')
    await expect(ed.locator('[data-token-text="@alice"]')).toHaveCount(1)
  })

  test('Cut diverged token removes it and pastes raw value', async ({
    mount,
    page
  }) => {
    await mount(<DivergedTokenInlay initial="X@aliceY" />)

    const ed = page.getByRole('textbox')
    await ed.click()
    await expect(ed).toHaveText('XAliceY')

    // Navigate past X and select token
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')

    await page.keyboard.press('ControlOrMeta+x')

    await expect(ed).toHaveText('XY')
    await expect(ed.locator('[data-token-text="@alice"]')).toHaveCount(0)

    // Paste at end
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ControlOrMeta+v')

    await expect(ed).toHaveText('XYAlice')
    await expect(ed.locator('[data-token-text="@alice"]')).toHaveCount(1)
  })

  test('Paste plain text into editor works correctly', async ({
    mount,
    page
  }) => {
    await mount(<DivergedTokenInlay initial="Hello " />)

    const ed = page.getByRole('textbox')
    await ed.click()

    // Move to end
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')

    // Write to clipboard and paste using real keyboard shortcut
    await page.evaluate(() => navigator.clipboard.writeText('world'))
    await page.keyboard.press('ControlOrMeta+v')

    await expect(ed).toHaveText('Hello world')
  })

  test('Paste text that matches token pattern creates new token', async ({
    mount,
    page
  }) => {
    await mount(<DivergedTokenInlay initial="Hi " />)

    const ed = page.getByRole('textbox')
    await ed.click()

    // Move to end
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')

    // Write to clipboard and paste using real keyboard shortcut
    await page.evaluate(() => navigator.clipboard.writeText('@alice'))
    await page.keyboard.press('ControlOrMeta+v')

    await expect(ed.locator('[data-token-text="@alice"]')).toHaveCount(1)
    await expect(ed).toHaveText('Hi Alice')
  })
})
