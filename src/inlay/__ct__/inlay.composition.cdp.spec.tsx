import { test, expect } from '@playwright/experimental-ct-react'
import type { Locator } from '@playwright/test'
import { Root as Inlay } from '../'

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

async function assertSingleTextOrSpanText(
  ed: Locator,
  expected: string
): Promise<boolean> {
  return ed.evaluate((el: HTMLElement, exp: string) => {
    const kids: ChildNode[] = Array.from(el.childNodes)
    if (kids.length !== 1) return false
    const only: ChildNode = kids[0]
    if (only.nodeType === Node.TEXT_NODE) return el.textContent === exp
    if (only.nodeType === Node.ELEMENT_NODE) {
      const span = only as Element
      if (span.childNodes.length !== 1) return false
      const first = span.firstChild as ChildNode | null
      return (
        !!first && first.nodeType === Node.TEXT_NODE && el.textContent === exp
      )
    }
    return false
  }, expected)
}

test.describe('IME composition via CDP (Chromium)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'CDP IME APIs are Chromium-only'
  )

  test('Space commit produces composed text and a trailing space', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay defaultValue={''} data-testid="root">
        {null}
      </Inlay>
    )
    const ed = page.getByRole('textbox')
    await ed.click()

    await composeWithCDP(page, 'にほん')
    await page.keyboard.press('Space')

    await expect(ed).toHaveText('にほん ')
    await expect(ed.locator('br')).toHaveCount(0)
    const ok = await assertSingleTextOrSpanText(ed, 'にほん ')
    expect(ok).toBe(true)
  })

  test('Enter commit composes text and does not add a stray newline immediately', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay defaultValue={''} data-testid="root">
        {null}
      </Inlay>
    )
    const ed = page.getByRole('textbox')
    await ed.click()

    await composeWithCDP(page, 'テスト')
    await page.keyboard.press('Enter')

    await expect(ed).toHaveText('テスト')
    await expect(ed.locator('br')).toHaveCount(0)
    const ok = await assertSingleTextOrSpanText(ed, 'テスト')
    expect(ok).toBe(true)
  })
})
