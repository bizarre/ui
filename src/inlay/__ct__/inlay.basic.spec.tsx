import { test, expect } from '@playwright/experimental-ct-react'
import { Inlay } from '../'

test('basic typing/backspace', async ({ mount, page }) => {
  await mount(
    <Inlay.Root defaultValue={'ab'} data-testid="root">
      <span />
    </Inlay.Root>
  )

  const root = page.getByTestId('root')
  await expect(root).toHaveCount(1)

  const ed = page.getByRole('textbox')
  await ed.click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.type('c')
  await expect(ed).toHaveText('abc')
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Backspace')
  await expect(ed).toHaveText('ab')
})
