# Inlay Architecture

Inlay is a React-based rich text editor primitive built on `contentEditable`. It provides controlled text input with support for embedded tokens—inline elements that represent structured data (mentions, tags, links) while maintaining a clean string-based value model.

## Core Concept: Token Divergence

The key architectural decision is **token divergence**: a token's visual representation can differ from its raw value.

```
Raw value:    "Hello @alice_123, meet @bob_456"
Visual DOM:   "Hello Alice, meet Bob"
```

This enables readable UI while preserving machine-readable identifiers in the underlying value. All cursor movement, selection, copy/paste, and deletion operations must account for this divergence.

## Component Hierarchy

```
StructuredInlay (high-level, plugin-based)
    └── Inlay.Root (core contentEditable wrapper)
            ├── Inlay.Token (inline token markers)
            └── Inlay.Portal (positioned overlays via Radix Popover)
```

### Exports

All components are exported under the `Inlay` namespace:

- `Inlay.Root` — Main editor component, wraps contentEditable
- `Inlay.Token` — Declares a token with `value` (raw) and `children` (visual)
- `Inlay.Portal` — Positioned popover anchored to selection or editor
  - `Inlay.Portal.List` — Keyboard-navigable list container
  - `Inlay.Portal.Item` — Selectable item within a Inlay.Portal.List
- `Inlay.StructuredInlay` — Higher-level component with plugin system

Types are also exported: `InlayProps`, `InlayRef`, `TokenState`, `Plugin`, `Matcher`, `Match`.

## Directory Structure

```
src/inlay/
├── inlay.tsx              # Core Root/Token/Portal components
├── portal-list.tsx        # Portal.List/Item compound components
├── index.ts               # Public exports
├── hooks/
│   ├── use-clipboard.ts   # Copy/cut/paste with token awareness
│   ├── use-composition.ts # IME composition handling (incl. iOS quirks)
│   ├── use-history.ts     # Undo/redo stack
│   ├── use-key-handlers.ts# Keyboard input processing (incl. Android GBoard)
│   ├── use-placeholder-sync.ts
│   ├── use-selection.ts   # Selection state tracking (incl. iOS selectionchange)
│   ├── use-selection-snap.ts # Cursor snapping to token boundaries
│   ├── use-token-weaver.tsx  # Two-pass token rendering
│   ├── use-touch-selection.ts # Touch-based selection handling
│   └── use-virtual-keyboard.ts # Virtual keyboard detection (visualViewport)
├── internal/
│   ├── dom-utils.ts       # DOM traversal, offset calculation
│   └── string-utils.ts    # Token matching/scanning
├── structured/
│   ├── structured-inlay.tsx # Plugin-based wrapper
│   └── plugins/
│       ├── plugin.ts      # Plugin type definition
│       └── mentions.tsx   # Example mentions plugin
├── __ct__/                # Playwright component tests
└── __tests__/             # Vitest unit tests
```

## Key Hooks

### `useTokenWeaver`
Two-pass rendering system:
1. First pass: Children render invisibly to register tokens
2. Second pass: Tokens are "weaved" into the text at correct positions

This solves the chicken-and-egg problem of needing to know token positions before rendering while also needing to render to know what tokens exist.

**Empty state:** When the value is empty, a zero-width space (`\u200B`) is rendered to maintain consistent caret height. Without this, the caret position can shift vertically when transitioning between empty and non-empty states (especially with styled tokens that have padding).

### `useKeyHandlers`
Intercepts all keyboard input via `onBeforeInput` and `onKeyDown`. Prevents default browser behavior and manually updates the controlled value. Handles:
- Text insertion (with multi-char insert tracking for iOS swipe-text)
- Backspace/Delete (with grapheme cluster awareness)
- iOS swipe-text word deletion (deletes entire swiped word, preserves auto-inserted spaces)
- Enter/Space
- Undo/Redo (Ctrl+Z, Ctrl+Y)

**iOS DOM sync:** On iOS, text insertions bypass `preventDefault()` to avoid multi-word suggestion bugs. The `input` event handler syncs DOM content to React state using `serializeRawFromDom()`. A `valueRef` provides synchronous access to the current value for decisions that must be made before React re-renders (e.g., detecting newlines to avoid `<br>` reconciliation crashes).

### `useComposition`
Manages IME (Input Method Editor) composition for CJK languages. Tracks composition state to avoid interfering with in-progress input. Handles composition commit via Space/Enter.

### `useClipboard`
Token-aware clipboard operations. When copying/cutting a token, extracts the raw value (not visual text). When pasting, inserts at correct raw offset position.

### `useSelectionSnap`
Snaps cursor and selection to token boundaries. Prevents cursor from landing inside a token's visual representation—it either sits before or after the token in raw-value terms.

### `useHistory`
Simple undo/redo with snapshot-based history. Coalesces rapid edits into single undo steps.

### `useSelection`
Tracks current selection as raw offsets. Provides `activeToken` when cursor is adjacent to or within a token.

## Internal Utilities

### `dom-utils.ts`
Core DOM traversal functions that account for token divergence:

- `getAbsoluteOffset(root, node, offset)` — Converts DOM selection position to raw string offset
- `getTextNodeAtOffset(root, offset)` — Converts raw offset to DOM position
- `setDomSelection(root, start, end?)` — Sets browser selection from raw offsets
- `getClosestTokenEl(node)` — Finds containing token element
- `getTokenRawRange(root, tokenEl)` — Gets raw offset range for a token

### `string-utils.ts`
Token matching and scanning:

- `Matcher<T, N>` — Interface for token matchers (regex, prefix, custom)
- `scan(text, matchers)` — Finds all token matches in a string, with overlap resolution
- `Match<T, N>` — Represents a found token with position and parsed data

**Overlap Resolution:** When multiple matchers produce overlapping matches, `scan()` uses a longest-match-wins strategy:
1. Matches are sorted by start position, then by length (longest first)
2. A greedy algorithm accepts non-overlapping matches, preferring longer ones
3. When matches have the same range, the first matcher in the array wins

This prevents duplicate tokens when plugins have overlapping patterns (e.g., `@alice` vs `@alice_vip`).

## Portal Navigation

Portal content often needs keyboard navigation (e.g., autocomplete lists). `Portal.List` and `Portal.Item` provide this with built-in keyboard handling.

```tsx
portal: ({ replace }) => (
  <Inlay.Portal.List onSelect={(user) => replace(`@${user.id} `)}>
    {users.map(user => (
      <Inlay.Portal.Item key={user.id} value={user}>
        {user.name}
      </Inlay.Portal.Item>
    ))}
  </Inlay.Portal.List>
)
```

**Keyboard behavior:**
- `ArrowUp/Down` — Navigate items (wraps around)
- `Enter` — Select active item
- `Escape` — Dismiss portal

**Virtual focus:** The editor retains DOM focus while Portal.List tracks the "active" item via state. This avoids contentEditable focus issues.

**Styling:** Use `data-active` attribute for highlighting:
```css
[data-portal-item][data-active] { background: var(--highlight); }
```

**Single-item pattern:** For confirmations or actions, use a single Inlay.Portal.Item:
```tsx
<Inlay.Portal.List onSelect={() => deleteToken()}>
  <Inlay.Portal.Item value="confirm">Delete? Press Enter to confirm.</Inlay.Portal.Item>
</Inlay.Portal.List>
```

**Positioning:** Portal uses manual DOM positioning instead of Radix's built-in anchor. This ensures the popover follows the caret on iOS Safari, where Radix's cached anchor position doesn't update correctly after text changes. The anchor rect is passed via `AnchorRectContext` and applied via `useLayoutEffect` on each render.

## Plugin System (StructuredInlay)

Plugins define token types with:

```typescript
type Plugin<P, T, N> = {
  props: P                    // Plugin configuration
  matcher: Matcher<T, N>      // How to find tokens in text
  render: (ctx) => ReactNode  // Token visual representation
  portal: (ctx) => ReactNode  // Optional popover content
  onInsert: (value: T) => void
  onKeyDown: (event) => boolean
}
```

Example: A mentions plugin matches `@username` patterns, renders styled chips, and shows a user card popover on focus.

## Browser Compatibility

- Handles Firefox's element-node selections (Ctrl+A sets selection on element, not text nodes)
- WebKit composition quirks (extra `beforeInput` events after `compositionend`)
- Cross-platform keyboard shortcuts via `ControlOrMeta`

## Mobile Support

Inlay provides full mobile device support with touch interactions, virtual keyboard handling, and platform-specific fixes.

### Mobile Input Attributes

The editor automatically sets mobile-friendly attributes:

```tsx
<Inlay.Root
  inputMode="text"           // Virtual keyboard hint
  autoCapitalize="sentences" // Mobile capitalization
  autoCorrect="off"          // Disabled (tokens would break)
  enterKeyHint="done"        // Mobile enter key label
/>
```

All attributes are configurable via props:

```tsx
type InlayProps = {
  inputMode?: 'text' | 'search' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal' | 'none'
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'
  autoCorrect?: 'on' | 'off'
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  onVirtualKeyboardChange?: (open: boolean) => void
}
```

### Touch Event Handling

The `useTouchSelection` hook handles touch-based interactions:

- **Tap to focus:** Positions caret at touch location
- **Long press:** Triggers native selection mode
- **Token snapping:** Touch inside tokens snaps to token boundaries
- **Debouncing:** Prevents rapid touch event issues

### Virtual Keyboard Detection

The `useVirtualKeyboard` hook uses the `visualViewport` API to detect keyboard visibility:

```tsx
<Inlay.Root
  onVirtualKeyboardChange={(open) => {
    console.log('Keyboard:', open ? 'open' : 'closed')
  }}
/>
```

When the keyboard opens, the editor automatically scrolls into view.

### Portal Touch Navigation

`Portal.List` and `Portal.Item` support touch interactions:

- **Touch start:** Activates item (like hover on desktop)
- **Touch end:** Selects item if touch didn't move (tap detection)
- **Scroll vs tap:** Movement >10px cancels selection

```tsx
// Portal items work the same on touch and desktop
<Inlay.Portal.List onSelect={handleSelect}>
  <Inlay.Portal.Item value={item}>
    {item.label}
  </Inlay.Portal.Item>
</Inlay.Portal.List>
```

### iOS-Specific Handling

- **Selection events:** iOS fires `selectionchange` on `document`, not the element. Added document-level listener in `useSelection`.
- **Anchor rect updates:** iOS can return stale caret rects after text changes. The `useSelection` hook listens for `input` and `visualViewport` events, using `requestAnimationFrame` to read the rect after layout stabilizes. This ensures popovers follow the caret correctly.
- **Composition data:** iOS Safari sometimes omits data in `compositionend`. Tracked via `compositionupdate` as fallback.
- **iPad detection:** Includes modern iPads that report as "MacIntel" with touch.
- **Multi-word suggestions prevention:** Calling `preventDefault()` on `beforeinput` for text insertions triggers iOS to show multi-word predictions (e.g., "I am going to the" as a single suggestion). However, iOS doesn't send usable event data for these predictions. By NOT calling `preventDefault()` on iOS for `insertText`, iOS shows only single-word suggestions which work correctly. The DOM is modified natively and synced to React state via the `input` event handler.
- **Token context exception:** When the cursor is inside a token, we use the controlled path (with `preventDefault`) even on iOS. This avoids issues where `data-token-text` attributes become stale after edits, causing `serializeRawFromDom` to return incorrect values.
- **Newline handling with React:** When content contains newlines, React renders `<br>` elements. If iOS modifies the DOM directly around `<br>` elements, React reconciliation fails with "NotFoundError". Solution: use a `valueRef` to detect newlines synchronously (before React re-renders) and call `preventDefault()` when newlines exist, handling the input via the controlled path.
- **Swipe-text after newlines:** iOS sends swipe data with a leading space even at the start of a line (after `\n`). This space is stripped. iOS may also send the space as a SEPARATE event before the word—single-space insertions at line start are skipped entirely.
- **Swipe-text word deletion:** When user swipe-types a word and presses backspace, iOS sends a single `deleteContentBackward` event with a targetRange covering only the last character. However, if we don't `preventDefault()`, iOS fires 5 rapid delete events and deletes the whole word natively. Since we need to `preventDefault()` to maintain controlled state, we track multi-char inserts and delete the entire chunk when backspace is pressed immediately after.
- **Swipe-text space preservation:** iOS auto-inserts a leading space when swipe-typing after existing text (e.g., "hello" + swipe "world" → "hello world"). When deleting, only the word is removed, preserving the auto-inserted space.
- **Autocomplete suggestions:** For `insertReplacementText` (autocomplete), iOS may not provide the replacement data when `preventDefault()` is called. On iOS, autocomplete is always handled via DOM sync regardless of newlines.
- **Autocomplete state reset:** After pressing Enter, the `autocomplete` attribute is briefly toggled to reset iOS's autocomplete context. This prevents iOS from suggesting merged words like "helloworld" when the actual text is "hello\nworld".

### Android-Specific Handling

- **GBoard predictions:** Handles `insertReplacementText` input type for word predictions. Replacement text is in `event.data`.
- **Delete variations:** Handles `deleteWordBackward`, `deleteWordForward`, `deleteSoftLineBackward`, `deleteSoftLineForward` input types.

### iOS Safari Text Suggestions

When a user taps a keyboard suggestion on iOS Safari:
1. iOS fires `insertReplacementText` with `data: null` and the replacement text in `event.dataTransfer.getData('text/plain')`
2. This differs from Android which puts the text in `event.data`
3. The handler checks both `data` and `dataTransfer` to support both platforms

### Testing Mobile

Mobile tests use Playwright with device emulation:

```bash
# Run mobile-specific tests
bun run test:ct -- --project=mobile-chrome
bun run test:ct -- --project=mobile-safari
```

Test files in `__ct__/inlay.mobile.spec.tsx` cover:
- Touch-based caret positioning
- Mobile attribute presence
- Portal touch navigation
- Token interaction on touch

## Accessibility

Inlay provides baseline accessibility out of the box:

- `role="textbox"` and `aria-multiline` are set automatically
- Default `aria-label="Text input"` — consumers should override with context-specific labels
- Placeholder is marked `aria-hidden="true"` to avoid duplicate announcements

**Automated a11y testing:** Uses `@axe-core/playwright` to catch WCAG violations in CI. Tests cover empty state, with-tokens, and focused states.

**Consumer responsibilities:**
- Provide meaningful `aria-label` or `aria-labelledby` for the editor context
- Ensure token visual styling meets contrast requirements
- Test with actual screen readers (VoiceOver, NVDA) for announcement quality

## Testing

- **`__ct__/`** — Playwright component tests (real browser, keyboard simulation)
- **`__tests__/`** — Vitest unit tests (JSDOM, faster iteration)

Run with:
```bash
bun run test:ct -- src/inlay/__ct__/  # Playwright
bun run test -- src/inlay/            # Vitest
```

## Common Patterns

### Adding a new keyboard shortcut
1. Add handler in `use-key-handlers.ts` `onKeyDown`
2. Check for modifier keys, prevent default, update value
3. Use `setDomSelection` to position cursor after state update

### Adding clipboard behavior
1. Modify `use-clipboard.ts`
2. Use `getSelectionFromDom` for token-aware selection
3. Use `cfg.getValue()` to read raw value, `cfg.setValue()` to update

### Creating a new token type
1. Define a `Matcher` in `string-utils.ts` format
2. Use with `Inlay.StructuredInlay` plugins or manually with `<Inlay.Token value="...">`

## Known Limitations

- Single-line by default (`multiline` prop enables multi-line)
- No rich formatting (bold, italic) — tokens only
- No nested tokens
- IME composition with tokens at boundaries can be tricky
- Mobile autocorrect is disabled by default (would interfere with tokens)
- Samsung keyboard may have composition quirks (test thoroughly)

