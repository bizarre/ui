/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/experimental-ct-react'
import { Inlay } from '../'

/**
 * iOS Swipe-Text Bug Reproduction
 *
 * THE BUG (from real iOS device testing):
 * When user swipe-types "hello" and presses backspace ONCE:
 * 1. iOS fires a SINGLE insertText event with data="hello" (whole word)
 * 2. iOS fires a SINGLE deleteContentBackward event with targetRanges=4-5 (last char only!)
 * 3. If we DON'T preventDefault, iOS fires 5 rapid deleteContentBackward events
 *    and natively deletes the whole word
 * 4. But if we DO preventDefault on the first event, iOS stops sending the
 *    remaining events, so we only see the range for the last char
 *
 * EXPECTED: Entire swipe-typed word deleted
 * ACTUAL BUG: Only last char deleted, "hello" -> "hell"
 *
 * THE FIX: Track multi-char inserts, and if deleteContentBackward happens
 * immediately after at the end of the inserted chunk, delete the whole chunk.
 *
 * SPACE PRESERVATION: When swipe-typing after existing text, iOS inserts
 * " word" (with leading space). On backspace, only "word" should be deleted,
 * preserving the auto-inserted space.
 */

test.describe('iOS swipe-text bug', () => {
  /**
   * Test that input works after deleting content.
   * Verifies no crash when typing after deletion.
   */
  test('input after deleting swipe-typed word should not crash', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="hello" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    await page.keyboard.press('End')
    await expect(ed).toHaveText('hello')

    // Delete all characters with delay between presses
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(30)
    }

    // Should be empty (or have zero-width space)
    await expect(ed).toHaveText(/^[\u200B]?$/)

    // Wait for selection to settle
    await page.waitForTimeout(50)

    // Type new text - should not crash
    await page.keyboard.type('world', { delay: 30 })

    await expect(ed).toHaveText('world')
  })

  /**
   * Test that selection updates work correctly even after DOM nodes are replaced.
   * This tests the robustness of setDomSelection when React re-renders.
   */
  test('setDomSelection should not crash when nodes are replaced', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="hello" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    await page.keyboard.press('End')
    await expect(ed).toHaveText('hello')

    // Delete all characters - this causes DOM nodes to be replaced
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(30)
    }

    // Should be empty
    await expect(ed).toHaveText(/^[\u200B]?$/)

    // Wait for selection to settle
    await page.waitForTimeout(50)

    // Insert new text - should work without crash
    await page.keyboard.type('x')

    await expect(ed).toHaveText('x')
  })

  /**
   * CRASH BUG VARIANT: Selection points outside editor after deletion.
   * On iOS, after rapid deletions the selection may end up pointing to
   * a node that's no longer in the editor, causing getAbsoluteOffset to fail.
   */
  test('insert should handle selection outside editor gracefully', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="hello" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    await page.keyboard.press('End')

    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      const reactPropsKey = Object.keys(editor).find((k) =>
        k.startsWith('__reactProps$')
      )
      if (!reactPropsKey) return { error: 'No React props' }

      const reactProps = (editor as any)[reactPropsKey]
      const onBeforeInput = reactProps?.onBeforeInput
      if (!onBeforeInput) return { error: 'No onBeforeInput' }

      // Force selection to be outside the editor (simulating iOS bug)
      const bodyTextNode = document.createTextNode('outside')
      document.body.appendChild(bodyTextNode)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      const badRange = document.createRange()
      badRange.setStart(bodyTextNode, 0)
      badRange.setEnd(bodyTextNode, 0)
      sel?.addRange(badRange)

      let insertError: string | undefined

      const insertEvent = {
        type: 'beforeinput',
        inputType: 'insertText',
        data: 'x',
        preventDefault: () => {},
        stopPropagation: () => {},
        nativeEvent: {
          type: 'beforeinput',
          inputType: 'insertText',
          data: 'x',
          getTargetRanges: () => []
        }
      }

      try {
        onBeforeInput(insertEvent)
      } catch (e) {
        insertError = String(e)
      }

      // Cleanup
      document.body.removeChild(bodyTextNode)

      await new Promise((r) => setTimeout(r, 50))

      return {
        insertError,
        finalText: editor.textContent
      }
    })

    console.log('Result:', JSON.stringify(result, null, 2))

    // Should NOT crash - should handle gracefully
    expect(result.insertError).toBeUndefined()
  })

  /**
   * iOS VALUE DIVERGENCE BUG:
   * After swipe-typing and pressing backspace, the React value state
   * must stay in sync with the DOM.
   *
   * This test verifies that backspace via native beforeinput correctly
   * updates the value even when coming from swipe-text scenarios.
   */
  test('backspace via beforeinput after insert should update value', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="hello" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    // Ensure we're at the end of the content
    await page.keyboard.press('End')
    await expect(ed).toHaveText('hello')

    // Press backspace - this fires native beforeinput which our handler catches
    await page.keyboard.press('Backspace')

    // Value should update from "hello" to "hell"
    await expect(ed).toHaveText('hell')
  })

  /**
   * iOS Safari crash: backspace then swipe-type causes "The object can not be found here"
   *
   * This test verifies that pressing backspace then typing doesn't crash
   * after DOM updates from deletion.
   */
  test('iOS Safari: backspace then textInput should not crash', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="hello" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    await page.keyboard.press('End')

    // Step 1: Backspace to delete "o"
    await page.keyboard.press('Backspace')
    await expect(ed).toHaveText('hell')

    // Wait for selection to settle after React re-render
    await page.waitForTimeout(50)

    // Step 2: Type new text (one char at a time with delay to avoid race)
    await page.keyboard.type('world', { delay: 30 })

    // Should have backspaced then typed
    await expect(ed).toHaveText('hellworld')
  })

  /**
   * Test that text insertion works correctly via real browser events.
   * Note: iOS Safari's legacy textInput event is handled by the native
   * beforeinput listener on real iOS devices.
   */
  test('iOS Safari textInput event should insert text', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    // Type text using real browser events
    await page.keyboard.type('hello')

    // Text should be inserted
    await expect(ed).toHaveText('hello')
  })

  test('swipe-text after backspace should not crash', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="hello" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    await page.keyboard.press('End')
    await expect(ed).toHaveText('hello')

    // Delete all characters with backspace (with delay to avoid race conditions)
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(30)
    }

    // Wait for deletions to complete
    await expect(ed).toHaveText(/^[\u200B]?$/) // empty or zero-width space

    // Wait for selection to settle
    await page.waitForTimeout(50)

    // Now type new text
    await page.keyboard.type('world', { delay: 30 })

    // Text should be "world" after inserting
    await expect(ed).toHaveText('world')
  })

  /**
   * iOS swipe-text word deletion - ACTUAL BEHAVIOR (from real device testing):
   *
   * When user swipe-types "hello" and presses backspace ONCE:
   * 1. iOS fires a SINGLE insertText event with data="hello" (whole word)
   * 2. iOS fires a SINGLE deleteContentBackward event with targetRanges=4-5 (last char only!)
   * 3. BUT if we don't preventDefault, iOS natively deletes the whole word
   *
   * The bug: When we preventDefault and handle it ourselves, we only see the
   * targetRange for the last character and delete only that character.
   *
   * The fix (Option 2): Track when a multi-char insert happens, and if
   * deleteContentBackward is pressed immediately after at the end of that
   * inserted chunk, delete the whole chunk.
   */
  test('iOS swipe-text: backspace after swipe-typed word should delete entire word', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    // Simulate iOS swipe-text behavior
    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      // Step 1: Simulate swipe-typing "hello" - iOS sends a single insertText with the whole word
      const insertEvent = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: 'hello',
        bubbles: true,
        cancelable: true
      })

      // Set up a collapsed range at position 0 for the insertion point
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        ;(insertEvent as any).getTargetRanges = () => [
          {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
            collapsed: true
          }
        ]
      } else {
        ;(insertEvent as any).getTargetRanges = () => []
      }

      editor.dispatchEvent(insertEvent)

      // Wait for React to process the insert
      await new Promise((r) => setTimeout(r, 50))

      const afterInsert = editor.textContent?.replace(/\u200B/g, '')

      // Step 2: Simulate pressing backspace - iOS sends ONE deleteContentBackward
      // with targetRange covering only the LAST character (4-5), NOT the whole word
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      let textNode: Text | null = null
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (node.textContent && node.textContent.length > 0) {
          textNode = node
          break
        }
      }

      if (!textNode) {
        return { error: 'No text node found after insert', afterInsert }
      }

      const deleteEvent = new InputEvent('beforeinput', {
        inputType: 'deleteContentBackward',
        bubbles: true,
        cancelable: true
      })

      // iOS only provides targetRange for the LAST character, not the whole word!
      // This is the key part of the bug - even though iOS would natively delete
      // the whole word, the beforeinput event only reports the last char range.
      const textLen = textNode.textContent?.length || 0
      ;(deleteEvent as any).getTargetRanges = () => [
        {
          startContainer: textNode,
          startOffset: textLen - 1, // e.g., 4 for "hello"
          endContainer: textNode,
          endOffset: textLen, // e.g., 5 for "hello"
          collapsed: false
        }
      ]

      editor.dispatchEvent(deleteEvent)

      // Wait for React to process the delete
      await new Promise((r) => setTimeout(r, 50))

      return {
        afterInsert,
        finalText: editor.textContent,
        finalLength: editor.textContent?.replace(/\u200B/g, '').length
      }
    })

    console.log('Result:', JSON.stringify(result, null, 2))

    // Verify the insert worked
    expect(result.afterInsert).toBe('hello')

    // EXPECTED: Entire swipe-typed word should be deleted
    // ACTUAL BUG: Only last char deleted, "hello" -> "hell"
    expect(result.finalLength).toBe(0)
  })

  /**
   * iOS swipe-text space preservation:
   *
   * When user has "hello|" and swipe-types "world", iOS inserts " world" (with leading space).
   * When backspace is pressed, iOS native deletes only "world" and preserves the space.
   * Result should be "hello " (with trailing space), not "hello" (no space).
   */
  test('iOS swipe-text: backspace after swipe-typed word should preserve auto-inserted space', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="hello" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()
    await page.keyboard.press('End')
    await expect(ed).toHaveText('hello')

    // Simulate iOS swipe-text behavior with leading space
    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      // Step 1: Simulate swipe-typing " world" (with leading space) after "hello"
      // iOS automatically adds a space when swipe-typing after existing text
      const insertEvent = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: ' world', // Note the leading space!
        bubbles: true,
        cancelable: true
      })

      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        ;(insertEvent as any).getTargetRanges = () => [
          {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
            collapsed: true
          }
        ]
      } else {
        ;(insertEvent as any).getTargetRanges = () => []
      }

      editor.dispatchEvent(insertEvent)

      // Wait for React to process the insert
      await new Promise((r) => setTimeout(r, 50))

      const afterInsert = editor.textContent?.replace(/\u200B/g, '')

      // Step 2: Simulate pressing backspace
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      let textNode: Text | null = null
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (node.textContent && node.textContent.length > 0) {
          textNode = node
          break
        }
      }

      if (!textNode) {
        return { error: 'No text node found after insert', afterInsert }
      }

      const deleteEvent = new InputEvent('beforeinput', {
        inputType: 'deleteContentBackward',
        bubbles: true,
        cancelable: true
      })

      // iOS only provides targetRange for the last character
      const textLen = textNode.textContent?.length || 0
      ;(deleteEvent as any).getTargetRanges = () => [
        {
          startContainer: textNode,
          startOffset: textLen - 1,
          endContainer: textNode,
          endOffset: textLen,
          collapsed: false
        }
      ]

      editor.dispatchEvent(deleteEvent)

      // Wait for React to process the delete
      await new Promise((r) => setTimeout(r, 50))

      return {
        afterInsert,
        finalText: editor.textContent?.replace(/\u200B/g, ''),
        // Check if trailing space is preserved
        hasTrailingSpace: editor.textContent
          ?.replace(/\u200B/g, '')
          .endsWith(' ')
      }
    })

    console.log('Result:', JSON.stringify(result, null, 2))

    // Verify the insert worked (including the space)
    expect(result.afterInsert).toBe('hello world')

    // EXPECTED: "world" deleted but space preserved -> "hello "
    // ACTUAL BUG: Both space and word deleted -> "hello"
    expect(result.finalText).toBe('hello ')
    expect(result.hasTrailingSpace).toBe(true)
  })
})

/**
 * iOS Safari Text Suggestion Bug
 *
 * THE BUG (from real iOS device testing):
 * When user types "hel" and taps a keyboard suggestion "hello":
 * 1. iOS fires insertReplacementText with data=null but dataTransfer="hello"
 * 2. Our code checks `if (!data) return` and bails out
 * 3. iOS then fires insertText with data=" " to insert a space
 * 4. Result: "hel" becomes " " instead of "hello"
 *
 * EXPECTED: "hel" → "hello" (the suggested word)
 * ACTUAL BUG: "hel" → " " (just a space)
 *
 * THE FIX: Check event.dataTransfer.getData('text/plain') as fallback when data is null
 */
test.describe('iOS Safari text suggestion', () => {
  /**
   * iOS Safari sends insertReplacementText with the replacement text in
   * dataTransfer instead of data (unlike Android GBoard which uses data).
   *
   * Note: This test is skipped on webkit/mobile-safari because the test environment
   * doesn't support passing DataTransfer to InputEvent constructor. The fix has been
   * verified on real iOS Safari devices via console logging.
   */
  test('tapping a keyboard suggestion should replace in-progress word', async ({
    mount,
    page,
    browserName
  }) => {
    // Skip webkit in test environment - DataTransfer constructor doesn't work the same way
    // Real iOS Safari behavior verified via console logging on actual device
    test.skip(
      browserName === 'webkit',
      'webkit test env does not support DataTransfer in InputEvent constructor'
    )

    await mount(
      <Inlay.Root defaultValue="" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    // Step 1: Type "hel" (simulating user typing before suggestion)
    await page.keyboard.type('hel')
    await expect(ed).toHaveText('hel')

    // Step 2: Simulate iOS Safari text suggestion tap
    // iOS sends insertReplacementText with data=null and replacement in dataTransfer
    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      // Find the text node containing "hel"
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      let textNode: Text | null = null
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (node.textContent && node.textContent.includes('hel')) {
          textNode = node
          break
        }
      }

      if (!textNode) {
        return {
          error: 'No text node found',
          editorContent: editor.textContent
        }
      }

      // Create a mock DataTransfer with the suggestion text
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/plain', 'hello')

      // Create the insertReplacementText event (iOS Safari style)
      const replaceEvent = new InputEvent('beforeinput', {
        inputType: 'insertReplacementText',
        data: null, // iOS Safari puts null here!
        dataTransfer: dataTransfer,
        bubbles: true,
        cancelable: true
      })

      // Set up getTargetRanges to return the range to replace ("hel" at 0-3)
      const textContent = textNode.textContent || ''
      const helStart = textContent.indexOf('hel')
      ;(replaceEvent as any).getTargetRanges = () => [
        {
          startContainer: textNode,
          startOffset: helStart >= 0 ? helStart : 0,
          endContainer: textNode,
          endOffset: helStart >= 0 ? helStart + 3 : 3,
          collapsed: false
        }
      ]

      editor.dispatchEvent(replaceEvent)

      // Wait for React to process
      await new Promise((r) => setTimeout(r, 50))

      return {
        finalText: editor.textContent?.replace(/\u200B/g, ''),
        wasReplaced: editor.textContent?.includes('hello')
      }
    })

    console.log('iOS text suggestion result:', JSON.stringify(result, null, 2))

    // EXPECTED: "hel" should be replaced with "hello"
    // ACTUAL BUG: "hel" remains unchanged because we bail out when data is null
    expect(result.error).toBeUndefined()
    expect(result.finalText).toBe('hello')
    expect(result.wasReplaced).toBe(true)
  })

  /**
   * Verify that Android-style insertReplacementText (with data in event.data)
   * still works after the iOS fix.
   */
  test('Android GBoard style suggestion should still work', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    // Type "hel"
    await page.keyboard.type('hel')
    await expect(ed).toHaveText('hel')

    // Simulate Android GBoard style - data is in event.data (not dataTransfer)
    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      let textNode: Text | null = null
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (node.textContent && node.textContent.includes('hel')) {
          textNode = node
          break
        }
      }

      if (!textNode) {
        return { error: 'No text node found' }
      }

      // Android style: data is in event.data
      const replaceEvent = new InputEvent('beforeinput', {
        inputType: 'insertReplacementText',
        data: 'hello', // Android puts the replacement here
        bubbles: true,
        cancelable: true
      })

      const textContent = textNode.textContent || ''
      const helStart = textContent.indexOf('hel')
      ;(replaceEvent as any).getTargetRanges = () => [
        {
          startContainer: textNode,
          startOffset: helStart >= 0 ? helStart : 0,
          endContainer: textNode,
          endOffset: helStart >= 0 ? helStart + 3 : 3,
          collapsed: false
        }
      ]

      editor.dispatchEvent(replaceEvent)

      await new Promise((r) => setTimeout(r, 50))

      return {
        finalText: editor.textContent?.replace(/\u200B/g, '')
      }
    })

    expect(result.error).toBeUndefined()
    expect(result.finalText).toBe('hello')
  })
})

/**
 * iOS Swipe-Text Trailing Space Bug
 *
 * THE BUG (from real iOS device testing):
 * When user swipe-types a word, iOS sends:
 * 1. insertText with the swiped word (e.g., "hello") - multi-char, we track it
 * 2. insertText with a single space " " - this CLEARS our tracking!
 * 3. User presses backspace - tracking is null, so we only delete one char
 *
 * EXPECTED: Backspace after swipe+space should delete the swiped word
 * ACTUAL BUG: Only deletes the trailing space because tracking was cleared
 *
 * THE FIX: When a single space follows a multi-char insert within a short
 * time window, extend the tracking to include the space instead of clearing it.
 */
test.describe('iOS swipe-text trailing space', () => {
  /**
   * iOS sends a trailing space after swipe-typing, which clears our tracking.
   * Backspace should still delete the whole swiped word.
   */
  test('backspace after swipe + trailing space should delete swiped word', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      // Step 1: Simulate swipe-typing "hello" (multi-char insert)
      const swipeEvent = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: 'hello',
        bubbles: true,
        cancelable: true
      })

      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        ;(swipeEvent as any).getTargetRanges = () => [
          {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
            collapsed: true
          }
        ]
      } else {
        ;(swipeEvent as any).getTargetRanges = () => []
      }

      editor.dispatchEvent(swipeEvent)
      await new Promise((r) => setTimeout(r, 30))

      const afterSwipe = editor.textContent?.replace(/\u200B/g, '')

      // Step 2: iOS sends a trailing space as a SEPARATE single-char event
      // This is the bug trigger - it clears our multi-char tracking!
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      let textNode: Text | null = null
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (node.textContent && node.textContent.length > 0) {
          textNode = node
          break
        }
      }

      if (!textNode) {
        return { error: 'No text node found after swipe', afterSwipe }
      }

      const spaceEvent = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: ' ', // Single space - this triggers the bug!
        bubbles: true,
        cancelable: true
      })

      const textLen = textNode.textContent?.length || 0
      ;(spaceEvent as any).getTargetRanges = () => [
        {
          startContainer: textNode,
          startOffset: textLen,
          endContainer: textNode,
          endOffset: textLen,
          collapsed: true
        }
      ]

      editor.dispatchEvent(spaceEvent)
      await new Promise((r) => setTimeout(r, 30))

      const afterSpace = editor.textContent?.replace(/\u200B/g, '')

      // Step 3: Press backspace - should delete the whole swiped word
      // Find the text node again after React re-render
      const walker2 = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      let textNode2: Text | null = null
      while (walker2.nextNode()) {
        const node = walker2.currentNode as Text
        if (node.textContent && node.textContent.length > 0) {
          textNode2 = node
          break
        }
      }

      if (!textNode2) {
        return {
          error: 'No text node found after space',
          afterSwipe,
          afterSpace
        }
      }

      const deleteEvent = new InputEvent('beforeinput', {
        inputType: 'deleteContentBackward',
        bubbles: true,
        cancelable: true
      })

      const textLen2 = textNode2.textContent?.length || 0
      ;(deleteEvent as any).getTargetRanges = () => [
        {
          startContainer: textNode2,
          startOffset: textLen2 - 1,
          endContainer: textNode2,
          endOffset: textLen2,
          collapsed: false
        }
      ]

      editor.dispatchEvent(deleteEvent)
      await new Promise((r) => setTimeout(r, 50))

      return {
        afterSwipe,
        afterSpace,
        finalText: editor.textContent?.replace(/\u200B/g, ''),
        // Check what was deleted
        deletedCorrectly:
          editor.textContent?.replace(/\u200B/g, '') === '' ||
          editor.textContent?.replace(/\u200B/g, '') === ' '
      }
    })

    console.log('Trailing space test result:', JSON.stringify(result, null, 2))

    // Verify setup worked
    expect(result.error).toBeUndefined()
    expect(result.afterSwipe).toBe('hello')
    expect(result.afterSpace).toBe('hello ')

    // EXPECTED: Entire swiped word deleted (leaving empty or just the space)
    // ACTUAL BUG: Only one char deleted because tracking was cleared by space
    // We expect the result to be empty string (whole word + space deleted)
    // or just a space (word deleted, space preserved)
    expect(result.finalText).toMatch(/^[ ]?$/) // Empty or single space
  })

  /**
   * Multiple swipes in sequence - each swipe's trailing space should not
   * break backspace behavior for the most recent swipe.
   */
  test('backspace after multiple swipes should delete most recent word', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      const dispatchInsert = async (text: string) => {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
        let textNode: Text | null = null
        let textLen = 0
        while (walker.nextNode()) {
          const node = walker.currentNode as Text
          if (node.textContent) {
            textNode = node
            textLen = node.textContent.length
          }
        }

        const event = new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: text,
          bubbles: true,
          cancelable: true
        })

        if (textNode) {
          ;(event as any).getTargetRanges = () => [
            {
              startContainer: textNode,
              startOffset: textLen,
              endContainer: textNode,
              endOffset: textLen,
              collapsed: true
            }
          ]
        } else {
          const sel = window.getSelection()
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0)
            ;(event as any).getTargetRanges = () => [
              {
                startContainer: range.startContainer,
                startOffset: range.startOffset,
                endContainer: range.endContainer,
                endOffset: range.endOffset,
                collapsed: true
              }
            ]
          } else {
            ;(event as any).getTargetRanges = () => []
          }
        }

        editor.dispatchEvent(event)
        await new Promise((r) => setTimeout(r, 30))
      }

      // Swipe "hello" + trailing space
      await dispatchInsert('hello')
      await dispatchInsert(' ')

      // Swipe "world" + trailing space
      await dispatchInsert('world')
      await dispatchInsert(' ')

      const beforeDelete = editor.textContent?.replace(/\u200B/g, '')

      // Press backspace
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      let textNode: Text | null = null
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (node.textContent && node.textContent.length > 0) {
          textNode = node
          break
        }
      }

      if (!textNode) {
        return { error: 'No text node', beforeDelete }
      }

      const deleteEvent = new InputEvent('beforeinput', {
        inputType: 'deleteContentBackward',
        bubbles: true,
        cancelable: true
      })

      const textLen = textNode.textContent?.length || 0
      ;(deleteEvent as any).getTargetRanges = () => [
        {
          startContainer: textNode,
          startOffset: textLen - 1,
          endContainer: textNode,
          endOffset: textLen,
          collapsed: false
        }
      ]

      editor.dispatchEvent(deleteEvent)
      await new Promise((r) => setTimeout(r, 50))

      return {
        beforeDelete,
        finalText: editor.textContent?.replace(/\u200B/g, '')
      }
    })

    console.log('Multiple swipes test result:', JSON.stringify(result, null, 2))

    expect(result.error).toBeUndefined()
    expect(result.beforeDelete).toBe('hello world ')

    // EXPECTED: "world " deleted, leaving "hello " or "hello"
    // ACTUAL BUG: Only one char deleted, leaving "hello world"
    expect(result.finalText).toMatch(/^hello ?$/)
  })
})

/**
 * iOS Swipe-Text Double Space Prevention
 *
 * THE BUG (from real iOS device testing):
 * When user swipes "hello", iOS auto-adds a trailing space → "hello "
 * When user then swipes "world", iOS sends " world" (with leading space)
 * Result: "hello  world" with DOUBLE SPACE
 *
 * EXPECTED: "hello world" (single space between words)
 * ACTUAL BUG: "hello  world" (double space)
 *
 * THE FIX: When inserting a multi-char string that starts with a space,
 * check if the character before is already a space. If so, strip the
 * leading space from the insert to avoid double-spacing.
 */
test.describe('iOS swipe-text double space prevention', () => {
  /**
   * When swiping " world" after "hello " (which already has trailing space),
   * the leading space should be stripped to avoid double-spacing.
   */
  test('swipe after trailing space should not create double space', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="" data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      const dispatchInsert = async (text: string) => {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
        let textNode: Text | null = null
        let textLen = 0
        while (walker.nextNode()) {
          const node = walker.currentNode as Text
          if (node.textContent) {
            textNode = node
            textLen = node.textContent.length
          }
        }

        const event = new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: text,
          bubbles: true,
          cancelable: true
        })

        if (textNode) {
          ;(event as any).getTargetRanges = () => [
            {
              startContainer: textNode,
              startOffset: textLen,
              endContainer: textNode,
              endOffset: textLen,
              collapsed: true
            }
          ]
        } else {
          const sel = window.getSelection()
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0)
            ;(event as any).getTargetRanges = () => [
              {
                startContainer: range.startContainer,
                startOffset: range.startOffset,
                endContainer: range.endContainer,
                endOffset: range.endOffset,
                collapsed: true
              }
            ]
          } else {
            ;(event as any).getTargetRanges = () => []
          }
        }

        editor.dispatchEvent(event)
        await new Promise((r) => setTimeout(r, 30))
      }

      // Step 1: Swipe "hello"
      await dispatchInsert('hello')
      const afterHello = editor.textContent?.replace(/\u200B/g, '')

      // Step 2: iOS adds trailing space
      await dispatchInsert(' ')
      const afterSpace = editor.textContent?.replace(/\u200B/g, '')

      // Step 3: Swipe " world" (iOS sends with leading space)
      await dispatchInsert(' world')
      const afterWorld = editor.textContent?.replace(/\u200B/g, '')

      // Count spaces between hello and world
      const match = afterWorld?.match(/hello( +)world/)
      const spaceCount = match ? match[1].length : 0

      return {
        afterHello,
        afterSpace,
        afterWorld,
        spaceCount,
        hasDoubleSpace: afterWorld?.includes('  ')
      }
    })

    console.log('Double space test result:', JSON.stringify(result, null, 2))

    expect(result.afterHello).toBe('hello')
    expect(result.afterSpace).toBe('hello ')

    // EXPECTED: "hello world" (single space)
    // ACTUAL BUG: "hello  world" (double space)
    expect(result.afterWorld).toBe('hello world')
    expect(result.spaceCount).toBe(1)
    expect(result.hasDoubleSpace).toBe(false)
  })
})

/**
 * iOS swipe after newline tests
 *
 * When swiping on a new line (after Enter), iOS often adds a leading space.
 * This space should be stripped since it's at the start of a line.
 */
test.describe('iOS swipe-text after newline', () => {
  /**
   * When swiping "world" after "hello\n", the leading space should be stripped.
   * iOS sends swipe data with leading space even at start of line.
   */
  test('swipe after newline should not have leading space', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="" multiline data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      // Helper to dispatch beforeinput and let it be handled
      const dispatchBeforeInput = async (
        inputType: string,
        data: string | null
      ) => {
        const event = new InputEvent('beforeinput', {
          inputType,
          data,
          bubbles: true,
          cancelable: true
        })

        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          ;(event as any).getTargetRanges = () => [
            {
              startContainer: range.startContainer,
              startOffset: range.startOffset,
              endContainer: range.endContainer,
              endOffset: range.endOffset,
              collapsed: range.collapsed
            }
          ]
        } else {
          ;(event as any).getTargetRanges = () => []
        }

        editor.dispatchEvent(event)
        await new Promise((r) => setTimeout(r, 50))
      }

      // Step 1: Type "hello" (simulating char-by-char typing via swipe for simplicity)
      await dispatchBeforeInput('insertText', 'hello')

      // Step 2: Press Enter (simulated via keydown)
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      })
      editor.dispatchEvent(enterEvent)
      await new Promise((r) => setTimeout(r, 50))

      const afterEnter = editor.innerText?.replace(/\u200B/g, '').trim()

      // Step 3: Swipe " world" on the new line (iOS sends with leading space)
      await dispatchBeforeInput('insertText', ' world')

      const finalValue = editor.innerText?.replace(/\u200B/g, '')

      return {
        afterEnter,
        finalValue,
        startsWithSpaceOnLine2: finalValue?.split('\n')[1]?.startsWith(' ')
      }
    })

    console.log('Swipe after newline result:', JSON.stringify(result, null, 2))

    // The second line should NOT start with a space
    expect(result.startsWithSpaceOnLine2).toBe(false)
    // Final value should be "hello\nworld" not "hello\n world"
    expect(result.finalValue).toMatch(/hello\n\s*world/)
    expect(result.finalValue).not.toContain('\n ')
  })

  /**
   * iOS sometimes sends a single space as a separate event BEFORE the swiped word.
   * This space should be skipped entirely at the start of a line.
   */
  test('single space before swipe word at start of line should be skipped', async ({
    mount,
    page
  }) => {
    await mount(
      <Inlay.Root defaultValue="" multiline data-testid="root">
        {null}
      </Inlay.Root>
    )

    const ed = page.getByRole('textbox')
    await ed.click()

    const result = await page.evaluate(async () => {
      const editor = document.querySelector('[role="textbox"]') as HTMLElement

      const dispatchBeforeInput = async (
        inputType: string,
        data: string | null
      ) => {
        const event = new InputEvent('beforeinput', {
          inputType,
          data,
          bubbles: true,
          cancelable: true
        })

        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          ;(event as any).getTargetRanges = () => [
            {
              startContainer: range.startContainer,
              startOffset: range.startOffset,
              endContainer: range.endContainer,
              endOffset: range.endOffset,
              collapsed: range.collapsed
            }
          ]
        } else {
          ;(event as any).getTargetRanges = () => []
        }

        editor.dispatchEvent(event)
        await new Promise((r) => setTimeout(r, 50))
      }

      // Step 1: Insert "hello"
      await dispatchBeforeInput('insertText', 'hello')

      // Step 2: Press Enter
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      })
      editor.dispatchEvent(enterEvent)
      await new Promise((r) => setTimeout(r, 50))

      // Step 3: iOS sends JUST a space first (separate event before the word)
      await dispatchBeforeInput('insertText', ' ')
      const afterSpace = editor.innerText?.replace(/\u200B/g, '')

      // Step 4: iOS sends the actual word
      await dispatchBeforeInput('insertText', 'world')
      const finalValue = editor.innerText?.replace(/\u200B/g, '')

      return {
        afterSpace,
        finalValue,
        line2: finalValue?.split('\n')[1]
      }
    })

    console.log(
      'Single space before swipe result:',
      JSON.stringify(result, null, 2)
    )

    // The space should have been skipped, so line 2 should be "world" not " world"
    expect(result.line2).toBe('world')
    expect(result.finalValue).not.toContain('\n ')
  })
})
