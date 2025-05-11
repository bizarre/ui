import { test as base, expect, Locator } from '@playwright/test'

const test = base.extend<{
  root: Locator
  token: (index: number) => Locator
  caret: (locator: Locator, options: { position: number }) => Promise<void>
  type: (locator: Locator, text: string) => Promise<void>
  press: (key: string) => Promise<void>
}>({
  root: async ({ page }, use) => {
    await use(page.getByTestId('inlay__root'))
  },
  token: ({ page }, use) => {
    return use((index: number) => page.locator(`[data-token-id="${index}"]`))
  },
  caret: async ({}, use) => {
    const caret: (
      locator: Locator,
      options: { position: number }
    ) => Promise<void> = async (locator, options) => {
      await locator.focus()
      await locator.evaluate((el, opts) => {
        const sel = window.getSelection()
        if (!sel) return
        if (!el.firstChild) return

        const safeOffset = Math.min(opts.position, el.textContent?.length ?? 0)

        const range = document.createRange()
        range.setStart(el.firstChild, safeOffset)
        range.collapse(true)

        sel.removeAllRanges()
        sel.addRange(range)
      }, options)
    }

    await use(caret)
  },
  type: async ({}, use) => {
    const type: (locator: Locator, text: string) => Promise<void> = async (
      locator,
      text
    ) => {
      await locator.pressSequentially(text, { delay: 40 })
    }

    await use(type)
  },
  press: async ({ page }, use) => {
    const press: (key: string) => Promise<void> = async (key) => {
      await page.keyboard.press(key, { delay: 40 })
    }

    await use(press)
  }
})

test.use({ viewport: { width: 500, height: 500 } })

test.describe('Inlay Component Family', () => {
  test.describe('Basic', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(
        'http://localhost:6006/iframe.html?viewMode=story&id=inlay--basic'
      )
      await page.waitForSelector('#storybook-root')
      await page.waitForSelector('[data-testid="inlay__root"]')
    })

    test('should render inlay root', async ({ root }) => {
      await expect(root).toBeVisible()
    })

    test('should contain two tokens when the user presses space', async ({
      type,
      root,
      token
    }) => {
      await type(root, 'hello world')
      await expect(token(0)).toHaveText('hello')
      await expect(token(1)).toHaveText('world')
    })

    test('should merge tokens when backspace is pressed between them', async ({
      root,
      token,
      type,
      caret,
      press
    }) => {
      await type(root, 'hello world')
      await caret(token(1), { position: 0 })
      await press('Backspace')
      await expect(token(1)).not.toBeAttached()
      await expect(token(0)).toBeVisible()
      await expect(token(0)).toHaveText('helloworld')
    })

    test('should split tokens when space is pressed between them', async ({
      root,
      token,
      type,
      caret,
      press
    }) => {
      await type(root, 'helloworld')
      await caret(token(0), { position: 5 })
      await press('Space')
      await expect(token(1)).toBeAttached()
      await expect(token(0)).toHaveText('hello')
      await expect(token(1)).toHaveText('world')
    })
  })
})
