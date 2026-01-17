import { test, expect } from '@playwright/experimental-ct-react'
import { OverlappingPluginsInlay } from './fixtures/overlapping-plugins-inlay'

test.describe('Plugin overlap resolution (CT)', () => {
  test.describe('Exact same substring - two plugins match @test at identical range', () => {
    test('only one token renders and first plugin wins (diverged output confirms which)', async ({
      mount,
      page
    }) => {
      // Input: "hello @test world"
      // Plugin A matches @test → renders "[A:test]"
      // Plugin B matches @test → renders "[B:test]"
      // Both match the EXACT same range. Only one should render.
      // With proper overlap resolution, first plugin (A) should win.
      await mount(
        <OverlappingPluginsInlay
          initial="hello @test world"
          scenario="exact-same"
        />
      )

      const ed = page.getByRole('textbox')
      await expect(ed).toBeVisible()

      // Should have exactly one token, not two
      const allTokens = ed.locator('[data-plugin]')
      await expect(allTokens).toHaveCount(1)

      // The visual output should be from Plugin A (first in array)
      // This confirms which plugin "won" via diverged rendering
      await expect(ed).toContainText('[A:test]')
      await expect(ed).not.toContainText('[B:test]')

      // Confirm it's Plugin A's token
      await expect(allTokens.first()).toHaveAttribute('data-plugin', 'pluginA')
    })
  })

  test.describe('Longer match wins - @alice vs @alice_vip at same start', () => {
    test('longer @alice_vip token wins over shorter @alice match', async ({
      mount,
      page
    }) => {
      // Input: "hello @alice_vip world"
      // Short plugin matches "@alice" at position 6-12
      // Long plugin matches "@alice_vip" at position 6-16
      // Both start at position 6, but Long is 10 chars vs Short's 6 chars
      // Longest-match-wins: Long plugin should win
      await mount(
        <OverlappingPluginsInlay
          initial="hello @alice_vip world"
          scenario="longer-wins"
        />
      )

      const ed = page.getByRole('textbox')
      await expect(ed).toBeVisible()

      // Should have exactly one token (the longer match consumed the range)
      const allTokens = ed.locator('[data-plugin]')
      await expect(allTokens).toHaveCount(1)

      // The visual should be from Long plugin, not Short
      await expect(ed).toContainText('[long:alice_vip]')
      await expect(ed).not.toContainText('[short:alice]')

      // Confirm it's Long plugin's token
      const token = allTokens.first()
      await expect(token).toHaveAttribute('data-plugin', 'long')
      await expect(token).toHaveAttribute('data-token-raw', '@alice_vip')
    })

    test('short match still works when long pattern does not apply', async ({
      mount,
      page
    }) => {
      // Input: "hello @alice world" (no _vip suffix)
      // Short plugin matches "@alice" at position 6-12
      // Long plugin does NOT match (no @alice_vip in text)
      // Short plugin should render since there's no competition
      await mount(
        <OverlappingPluginsInlay
          initial="hello @alice world"
          scenario="longer-wins"
        />
      )

      const ed = page.getByRole('textbox')
      await expect(ed).toBeVisible()

      // Should have exactly one token from Short plugin
      const allTokens = ed.locator('[data-plugin]')
      await expect(allTokens).toHaveCount(1)

      await expect(ed).toContainText('[short:alice]')
      await expect(allTokens.first()).toHaveAttribute('data-plugin', 'short')
    })
  })

  test.describe('Non-overlapping tokens preserved', () => {
    test('multiple non-overlapping tokens from different plugins are all rendered', async ({
      mount,
      page
    }) => {
      await mount(
        <OverlappingPluginsInlay
          initial="@alice loves #react and @bob likes #vue"
          scenario="non-overlapping"
        />
      )

      const ed = page.getByRole('textbox')
      await expect(ed).toBeVisible()

      // Should have 4 tokens total (2 mentions, 2 hashtags)
      const allTokens = ed.locator('[data-plugin]')
      await expect(allTokens).toHaveCount(4)

      // Two mentions
      const mentionTokens = ed.locator('[data-plugin="mention"]')
      await expect(mentionTokens).toHaveCount(2)

      // Two hashtags
      const hashtagTokens = ed.locator('[data-plugin="hashtag"]')
      await expect(hashtagTokens).toHaveCount(2)

      // Verify specific values exist
      await expect(ed.locator('[data-token-raw="@alice"]')).toHaveCount(1)
      await expect(ed.locator('[data-token-raw="@bob"]')).toHaveCount(1)
      await expect(ed.locator('[data-token-raw="#react"]')).toHaveCount(1)
      await expect(ed.locator('[data-token-raw="#vue"]')).toHaveCount(1)
    })
  })
})
