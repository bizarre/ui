/* eslint-disable @typescript-eslint/no-explicit-any */
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

    page.on('console', (msg) => console.log('EMOJI TEST LOG:', msg.text()))

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
    // Move cursor to end
    await page.keyboard.press('End')

    // Capture page console logs
    page.on('console', (msg) => console.log('PAGE:', msg.text()))

    // Test log to verify capturing works
    await page.evaluate(() => console.log('TEST LOG FROM PAGE'))

    // Check if React's onBeforeInput is attached
    await page.evaluate(() => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement
      const reactKey = Object.keys(editor).find((k) =>
        k.startsWith('__reactProps$')
      )
      if (reactKey) {
        const props = (editor as any)[reactKey]
        console.log(
          'React props keys:',
          Object.keys(props || {}).filter((k) =>
            k.toLowerCase().includes('input')
          )
        )
        console.log('Has onBeforeInput:', typeof props?.onBeforeInput)
      } else {
        console.log('No React props found')
      }
    })

    // Check value before backspace
    const valueBefore = await page.evaluate(() => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement
      return {
        textContent: editor.textContent,
        innerHTML: editor.innerHTML,
        charCodes: Array.from(editor.textContent || '').map((c) =>
          c.charCodeAt(0)
        )
      }
    })
    console.log('Before backspace:', JSON.stringify(valueBefore))

    await page.keyboard.press('Backspace')

    // Check what the actual text content is
    const valueAfter = await page.evaluate(() => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement
      return {
        textContent: editor.textContent,
        charCodes: Array.from(editor.textContent || '').map((c) =>
          c.charCodeAt(0)
        )
      }
    })
    console.log('After backspace:', JSON.stringify(valueAfter))

    await expect(ed).toHaveText('')
  })
})
