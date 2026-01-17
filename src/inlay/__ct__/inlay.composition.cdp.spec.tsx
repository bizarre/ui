import { test, expect, type Locator } from '@playwright/experimental-ct-react'
import { Inlay } from '../'

// Chromium-only: use CDP to simulate IME composition end-to-end
const composeWithCDP = async (
  page: import('@playwright/test').Page,
  text: string
) => {
  const client = await page.context().newCDPSession(page)
  await client.send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length
  })
  await client.send('Input.insertText', { text })
  await client.send('Input.imeSetComposition', {
    text: '',
    selectionStart: 0,
    selectionEnd: 0
  })
}

// Check that composition didn't leave broken DOM structure (multiple text nodes, etc.)
async function assertCleanTextContent(ed: Locator): Promise<boolean> {
  return ed.evaluate((el: HTMLElement) => {
    // The editor should not have stray <br> elements or deeply nested structures
    // after composition. Text content check is the primary validation.
    const brs = el.querySelectorAll('br')
    return brs.length === 0
  })
}

test.describe.serial('IME composition via CDP (Chromium)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'CDP IME APIs are Chromium-only'
  )

  test('Space commit produces composed text and a trailing space', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue={''} data-testid="root">
        {null}
      </Inlay.Root>
    )
    const ed = page.getByRole('textbox')
    await ed.click()

    await composeWithCDP(page, 'にほん')
    await page.keyboard.press('Space')

    await expect(ed).toHaveText('にほん ')
    const ok = await assertCleanTextContent(ed)
    expect(ok).toBe(true)
  })

  test('Enter commit composes text and does not add a stray newline immediately', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue={''} data-testid="root">
        {null}
      </Inlay.Root>
    )
    const ed = page.getByRole('textbox')
    await ed.click()

    await composeWithCDP(page, 'テスト')
    await page.keyboard.press('Enter')

    await expect(ed).toHaveText('テスト')
    const ok = await assertCleanTextContent(ed)
    expect(ok).toBe(true)
  })
})
