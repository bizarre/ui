import { test, expect } from '@playwright/experimental-ct-react'
import { DivergedTokenInlay } from './fixtures/diverged-token-inlay'
import { AutoUpdateInlay } from './fixtures/auto-update-inlay'

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

  test('Rapid paste maintains caret at end of inserted text', async ({
    mount,
    page
  }) => {
    await mount(<DivergedTokenInlay initial="" />)

    const ed = page.getByRole('textbox')
    await ed.click()

    // Write text to clipboard
    await page.evaluate(() => navigator.clipboard.writeText('abc'))

    // Simulate rapid pasting (like holding Ctrl+V)
    // Fire multiple paste events in quick succession without waiting
    const pasteCount = 5
    for (let i = 0; i < pasteCount; i++) {
      await page.keyboard.press('ControlOrMeta+v', { delay: 0 })
    }

    // Expected: "abcabcabcabcabc" with caret at position 15 (end)
    await expect(ed).toHaveText('abcabcabcabcabc')

    // Type a character to verify caret position - should appear at the end
    await page.keyboard.type('X')
    await expect(ed).toHaveText('abcabcabcabcabcX')
  })

  test('Pasting many auto-updating tokens does not cause infinite loop', async ({
    mount,
    page
  }) => {
    // Capture React errors (error #185 = Maximum update depth exceeded)
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await mount(<AutoUpdateInlay initial="" />)

    const ed = page.getByRole('textbox')
    await ed.click()

    // Paste many tokens that will each trigger an update() call
    const manyTokens = Array(100).fill('@test').join(' ') + ' '
    await page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      manyTokens
    )
    await page.keyboard.press('ControlOrMeta+v')

    // Wait for all updates to process
    await page.waitForTimeout(500)

    // Should not have crashed with "Maximum update depth exceeded"
    expect(errors).toHaveLength(0)

    // Should render exactly 100 tokens (no duplicates) in the visible editor
    // Note: 2-pass rendering means tokens exist in both hidden and visible divs
    const editor = page.getByRole('textbox')
    await expect(editor.locator('[data-testid="token-render"]')).toHaveCount(
      100,
      { timeout: 5000 }
    )

    // Caret should be at end after all updates, not position 0
    await page.keyboard.type('X')
    const text = await editor.textContent()
    expect(text?.endsWith('X')).toBe(true)
  })
})
