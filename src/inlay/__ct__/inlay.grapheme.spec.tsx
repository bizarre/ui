import { test, expect } from '@playwright/experimental-ct-react'
import { Inlay } from '../'

test.describe('Grapheme handling (CT)', () => {
  test('Backspace deletes an entire emoji grapheme cluster', async ({
    mount,
    page
  }) => {
    const cluster = '👍🏼'
    await mount(
      <Inlay.Root defaultValue={cluster} data-testid="root">
        <span />
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    // Normalize caret to start by overshooting ArrowLeft
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft')
    // Move caret to end using ArrowRight (cluster is one grapheme)
    await page.keyboard.press('ArrowRight')

    await page.keyboard.press('Backspace')
    await expect(ed).toHaveText('')
  })

  test('Backspace with selection slicing through a grapheme removes the whole grapheme', async ({
    mount,
    page
  }) => {
    const cluster = '👍🏼'
    const text = `a${cluster}b`
    await mount(
      <Inlay.Root defaultValue={text} data-testid="root">
        <span />
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    // Normalize caret to start by overshooting ArrowLeft
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft')
    // Move to just before the grapheme (after the initial 'a')
    await page.keyboard.press('ArrowRight')
    // Extend selection across exactly one grapheme
    await page.keyboard.press('Shift+ArrowRight')

    await page.keyboard.press('Backspace')
    await expect(ed).toHaveText('ab')
  })

  test('Backspace deletes entire flag grapheme (regional indicators) before caret', async ({
    mount,
    page
  }) => {
    const flag = '🇺🇸'
    await mount(
      <Inlay.Root defaultValue={`a${flag}b`} data-testid="root">
        <span />
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    // Normalize caret to start by overshooting ArrowLeft
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft')
    // Move to after 'a' and then after the flag grapheme
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')

    await page.keyboard.press('Backspace')
    await expect(ed).toHaveText('ab')
  })

  test('Backspace deletes composed character with combining mark as a single grapheme', async ({
    mount,
    page
  }) => {
    const composed = 'e\u0301'
    await mount(
      <Inlay.Root defaultValue={composed} data-testid="root">
        <span />
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    // Normalize caret to start by overshooting ArrowLeft
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft')
    // Move to end (one grapheme)
    await page.keyboard.press('ArrowRight')

    await page.keyboard.press('Backspace')
    await expect(ed).toHaveText('')
  })
})
