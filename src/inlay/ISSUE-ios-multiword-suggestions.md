# iOS Multi-Word Keyboard Suggestions Not Working

## Problem Statement

When using Inlay on iOS Safari, multi-word keyboard predictions (like "tell" → "tell them") don't work. Tapping a multi-word suggestion either does nothing or only inserts a space.

Single-word suggestions (like "hel" → "hello") DO work correctly.

## Root Cause Discovery

After extensive debugging, we discovered:

**Calling `preventDefault()` on `beforeinput` events triggers iOS to show multi-word predictions.**

This is unexpected iOS behavior - when we prevent default, iOS interprets it as "this app wants special input handling" and switches to an advanced keyboard mode with multi-word predictions.

### Test Results

| ContentEditable Setup | Multi-Word Predictions? |
|----------------------|------------------------|
| Naked (no JS) | ❌ No |
| With `onInput` only | ❌ No |
| With `onBeforeInput` (no prevent) | ❌ No |
| With `onBeforeInput` + `preventDefault()` | ✅ Yes |
| Inlay.Root | ✅ Yes |
| StructuredInlay | ✅ Yes |

### The Dilemma

1. **We need `preventDefault()`** to control input, especially around structured tokens
2. **`preventDefault()` triggers multi-word predictions** on iOS
3. **iOS doesn't send usable events** for multi-word predictions - no `data`, no `dataTransfer`, nothing to intercept

## What Works

**Single-word suggestions** work correctly:
- iOS sends `inputType: "insertReplacementText"` with `data: null`
- The actual text is in `event.dataTransfer.getData('text/plain')`
- We handle this in `use-key-handlers.ts` around line 150

```typescript
// Get replacement text: try data first (Android), then dataTransfer (iOS Safari)
const replacementText = data ?? event.dataTransfer?.getData('text/plain')
```

## What Doesn't Work

**Multi-word predictions** fail because:
1. When user taps a multi-word suggestion, iOS sends `textInput` with just `data: " "` (space)
2. No actual suggestion text is provided anywhere
3. We can't handle what we can't detect

## Potential Solutions

### 1. Allow + Resync on Input
Don't `preventDefault()`. Let iOS modify the DOM, then on `input`:
- Parse the DOM content
- Reconstruct token state
- Sync to React

**Challenge**: Token integrity - if iOS types into a token span, we need to correctly parse it back.

### 2. Invisible Input Overlay (iOS only)
Mount a real `<input>` or `<textarea>` on iOS that:
- Is invisible but captures all native input
- Gets all the proper iOS events
- Syncs to the visible contentEditable display

**Advantage**: Clean separation - iOS talks to native input, we control display.

### 3. Hybrid preventDefault
Only call `preventDefault()` when cursor is in/near tokens. Let iOS handle plain text areas normally.

**Challenge**: Detecting "near tokens" reliably, edge cases.

### 4. Parse-Based Reconciliation
After any DOM mutation:
- Diff the DOM against expected state
- Reconcile differences
- Update React state accordingly

**Similar to #1** but more focused on diffing.

## Relevant Code Locations

- `src/inlay/hooks/use-key-handlers.ts` - Main input handling, `preventDefault()` calls
- `src/inlay/inlay.tsx` - ContentEditable element, attributes
- `src/inlay/stories/structured.stories.tsx` - Test stories including `NakedContentEditable`

## Test Stories Created

In `structured.stories.tsx`:

### `MinimalInlay`
- Minimal Inlay.Root (no plugins)
- StructuredInlay (no plugins)
- Both show multi-word predictions (confirms it's core Inlay, not plugins)

### `NakedContentEditable`
Key test cases to isolate the cause:

1. **Naked (no JS)** - Single-word only ✅
2. **With preventDefault on beforeinput** - Multi-word predictions ❌
3. **With React controlled state** - Single-word only ✅
4. **Handle on input instead of beforeinput** - Single-word only ✅

The 4th test case is the key insight: if you add a `beforeinput` handler but DON'T call `preventDefault()`, you still get single-word only. It's specifically the `preventDefault()` call that triggers multi-word.

## Debug Logging (Currently Active)

Extensive logging is currently in `use-key-handlers.ts` for iOS debugging. These are useful for testing on real devices:

- `[beforeinput]` - Logs all beforeinput events with inputType, data, dataTransfer, cancelable, etc.
- `[insertText]` - Logs text insertions with position info
- `[insertReplacementText]` - Logs iOS/Android word predictions
- `[MutationObserver]` - Logs DOM changes not caught by events
- `[textInput]` - Logs native textInput events with DOM content
- `[input]` - Logs post-input events
- `[document textInput/input/beforeinput]` - Document-level listeners

There are also document-level event listeners added in the `useEffect` for catching events iOS might send elsewhere.

**Note**: These should be removed or made conditional before shipping to production.

## Current State

The code has:
1. ✅ **Single-word `insertReplacementText` fix** - Working! Checks `dataTransfer` when `data` is null
2. ✅ **Debug logging** - Active, useful for iOS testing on real devices
3. ⚠️ **Space-handling experiment** - Code at ~line 355 that doesn't `preventDefault()` for space insertions (was testing if iOS sends more events after space)
4. ⚠️ **MutationObserver with debouncing** - Syncs DOM to React state when we don't prevent default
5. ⚠️ **`lastPreventedTimeRef` tracking** - Tracks when we prevented vs didn't, so MutationObserver knows when to sync
6. ⚠️ **`preventAndMark()` helper** - Wrapper around `preventDefault()` that also updates the ref

## Test Status

Some tests in `inlay.ios-swipe-text.spec.tsx` are **currently failing** due to experimental changes:

```
3 failed:
- backspace after swipe + trailing space should delete swiped word
- backspace after multiple swipes should delete most recent word
- swipe after trailing space should not create double space
11 passed
```

The failures are because of the space-handling experiment (line ~355) that doesn't `preventDefault()` for spaces. This breaks the controlled input flow.

**To fix**: Either revert the space experiment or update the tests.

## Recommended Next Steps

1. **Choose an approach** from the solutions above
2. **Prototype** the chosen approach
3. **Test on real iOS device** (critical - simulators may differ)
4. **Fix or update failing tests**
5. **Clean up debug logging** before shipping
6. **Update ARCHITECTURE.md** with final solution

## iOS Keyboard Behavior Notes

- `autocorrect="on"` vs omitted behaves the same (both show multi-word when preventDefault is used)
- `spellcheck`, `autocapitalize`, `role`, `inputMode` don't affect multi-word prediction appearance
- The trigger is specifically `preventDefault()` on `beforeinput` events
- iOS System Settings → Keyboard → Predictive controls this at OS level, but we can't control it from web

## Code Changes Made

### `inlay.tsx`
- Changed `autoCorrect` default from `'off'` to `undefined` (omit attribute, let iOS decide)

### `use-key-handlers.ts`
- Added `lastPreventedTimeRef` to track when we prevent default
- Added `preventAndMark()` helper function
- Added extensive debug logging
- Added MutationObserver that syncs DOM to state when we don't prevent
- Added document-level event listeners for debugging
- Added space-handling experiment (line ~355)

### `structured.stories.tsx`
- Removed `autoCorrect="on"` from main story (using default now)
- Added `MinimalInlay` story
- Added `NakedContentEditable` story with 4 test cases

