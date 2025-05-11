import * as React from 'react'
import { ZWS } from '../inlay.constants'

// Adapted from useKeydownHandler.ts
function getActualTextForToken<T>(
  tok: T | undefined | null,
  tokenIndex: number,
  _getEditableTextValue: (index: number) => string | undefined
): string {
  if (tok === undefined || tok === null) return ''

  const registeredValue = _getEditableTextValue(tokenIndex)
  if (registeredValue !== undefined) {
    return registeredValue
  }

  if (typeof tok === 'string') {
    return tok
  }

  if (typeof tok === 'object') {
    console.warn(
      `[getActualTextForToken] Token at index ${tokenIndex} is an object but has no registered EditableText value. Returning empty string for copy.`,
      tok
    )
    return ''
  }
  return ''
}

// Adapted from useSelectionChangeHandler.ts
function getOffsetInToken(
  tokenEl: HTMLElement,
  container: Node,
  offsetInContainer: number
): number {
  if (!tokenEl || typeof tokenEl.textContent !== 'string') {
    return 0
  }
  const tokenTextContent = tokenEl.textContent

  if (
    tokenTextContent === ZWS &&
    tokenEl.getAttribute('data-token-editable') === 'true'
  ) {
    return 0
  }

  const editableRegion = tokenEl.querySelector(
    '[data-inlay-editable-region="true"]'
  ) as HTMLElement | null

  if (editableRegion) {
    const editableRegionText = editableRegion.textContent || ''
    if (container === editableRegion || editableRegion.contains(container)) {
      let relativeOffset = 0
      if (
        editableRegion.firstChild &&
        container.nodeType === Node.TEXT_NODE &&
        editableRegion.contains(container)
      ) {
        let currentNode: Node | null = editableRegion.firstChild
        while (currentNode && currentNode !== container) {
          relativeOffset += (currentNode.textContent || '').length
          currentNode = currentNode.nextSibling
        }
        if (currentNode === container) {
          relativeOffset += offsetInContainer
        } else {
          relativeOffset = offsetInContainer
        }
      } else if (container === editableRegion) {
        relativeOffset = offsetInContainer
      } else {
        relativeOffset = offsetInContainer
      }
      return Math.min(
        relativeOffset,
        editableRegionText.length === 1 && editableRegionText === ZWS
          ? 0
          : editableRegionText.length
      )
    }
    return editableRegionText === ZWS ? 0 : editableRegionText.length
  }

  if (container.nodeType === Node.TEXT_NODE && tokenEl.contains(container)) {
    let relativeOffset = 0
    let currentNode: Node | null = tokenEl.firstChild
    while (currentNode && currentNode !== container) {
      relativeOffset += (currentNode.textContent || '').length
      currentNode = currentNode.nextSibling
    }
    if (currentNode === container) {
      relativeOffset += offsetInContainer
    } else {
      relativeOffset = offsetInContainer
    }
    return Math.min(
      relativeOffset,
      tokenTextContent.length === 1 && tokenTextContent === ZWS
        ? 0
        : tokenTextContent.length
    )
  }

  if (container === tokenEl) {
    return Math.min(
      offsetInContainer,
      tokenTextContent.length === 1 && tokenTextContent === ZWS
        ? 0
        : tokenTextContent.length
    )
  }
  return tokenTextContent.length === 1 && tokenTextContent === ZWS
    ? 0
    : tokenTextContent.length
}

export interface UseCopyHandlerProps<T> {
  mainDivRef: React.RefObject<HTMLDivElement | null>
  tokens: Readonly<T[]>
  spacerChars: (string | null)[]
  _getEditableTextValue: (index: number) => string | undefined
}

export function useCopyHandler<T>({
  mainDivRef,
  tokens,
  spacerChars,
  _getEditableTextValue
}: UseCopyHandlerProps<T>): void {
  React.useEffect(() => {
    const mainDiv = mainDivRef.current
    if (!mainDiv) return

    const handleCopy = (event: ClipboardEvent) => {
      if (
        !mainDivRef.current ||
        !event.target ||
        !mainDivRef.current.contains(event.target as Node)
      ) {
        // Copy event originated outside the inlay component
        return
      }

      event.preventDefault()
      const sel = window.getSelection()

      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        event.clipboardData?.setData('text/plain', '')
        return
      }

      const range = sel.getRangeAt(0)
      const {
        startContainer,
        startOffset: domStartOffset,
        endContainer,
        endOffset: domEndOffset
      } = range

      const commonAncestor = range.commonAncestorContainer
      if (!mainDivRef.current || !mainDivRef.current.contains(commonAncestor)) {
        event.clipboardData?.setData('text/plain', '')
        return
      }

      const startTokenEl =
        startContainer.nodeType === Node.ELEMENT_NODE &&
        (startContainer as HTMLElement).hasAttribute('data-token-id')
          ? (startContainer as HTMLElement)
          : (startContainer.parentElement?.closest(
              '[data-token-id]'
            ) as HTMLElement | null)

      const endTokenEl =
        endContainer.nodeType === Node.ELEMENT_NODE &&
        (endContainer as HTMLElement).hasAttribute('data-token-id')
          ? (endContainer as HTMLElement)
          : (endContainer.parentElement?.closest(
              '[data-token-id]'
            ) as HTMLElement | null)

      if (!startTokenEl || !endTokenEl) {
        // Selection does not properly start and end within tokens
        // Check if selection is within the main div but not in any token (e.g. selecting spaces between tokens)
        let textToCopy = ''
        if (
          mainDivRef.current &&
          mainDivRef.current.contains(range.commonAncestorContainer)
        ) {
          // A more general approach if selection is not neatly within tokens:
          // Clone the selection range's contents and extract text.
          // This might grab text from non-token elements if they exist between tokens.
          // For now, if not in tokens, copy selected text as is from the fragment.
          // This might re-introduce some of the original issues if the selection is complex and not token-bound.
          // However, the primary goal is fixing token-bound copies.
          const clonedSelection = range.cloneContents()
          const tempDiv = document.createElement('div')
          tempDiv.appendChild(clonedSelection)
          textToCopy = tempDiv.textContent || ''
        }
        event.clipboardData?.setData('text/plain', textToCopy)
        return
      }

      // Determine actual start and end tokens if selection is backwards
      let actualStartTokenEl = startTokenEl
      let actualEndTokenEl = endTokenEl
      let actualStartContainer = startContainer
      let actualEndContainer = endContainer
      let actualDomStartOffset = domStartOffset
      let actualDomEndOffset = domEndOffset

      const comparison = startTokenEl.compareDocumentPosition(endTokenEl)
      if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
        // startTokenEl is after endTokenEl
        ;[actualStartTokenEl, actualEndTokenEl] = [endTokenEl, startTokenEl]
        ;[actualStartContainer, actualEndContainer] = [
          endContainer,
          startContainer
        ]
        ;[actualDomStartOffset, actualDomEndOffset] = [
          domEndOffset,
          domStartOffset
        ]
      } else if (comparison === 0) {
        // Same token
        // Ensure offsets are ordered if selection is backwards within the same token
        if (domStartOffset > domEndOffset) {
          ;[actualDomStartOffset, actualDomEndOffset] = [
            domEndOffset,
            domStartOffset
          ]
        }
      }

      const finalStartIdx = parseInt(actualStartTokenEl.dataset.tokenId!, 10)
      const finalEndIdx = parseInt(actualEndTokenEl.dataset.tokenId!, 10)
      const finalStartOffset = getOffsetInToken(
        actualStartTokenEl,
        actualStartContainer,
        actualDomStartOffset
      )
      const finalEndOffset = getOffsetInToken(
        actualEndTokenEl,
        actualEndContainer,
        actualDomEndOffset
      )

      const textParts: string[] = []

      for (let i = finalStartIdx; i <= finalEndIdx; i++) {
        if (i < 0 || i >= tokens.length) continue // Should not happen with valid token IDs

        const currentToken = tokens[i]
        const tokenText = getActualTextForToken(
          currentToken,
          i,
          _getEditableTextValue
        )

        if (finalStartIdx === finalEndIdx) {
          // Selection within a single token
          textParts.push(tokenText.slice(finalStartOffset, finalEndOffset))
        } else if (i === finalStartIdx) {
          // First token in multi-token selection
          textParts.push(tokenText.slice(finalStartOffset))
        } else if (i === finalEndIdx) {
          // Last token in multi-token selection
          textParts.push(tokenText.slice(0, finalEndOffset))
        } else {
          // A token fully between start and end
          textParts.push(tokenText)
        }

        // Add spacer if it's not the last token in the overall selection
        // and a spacer character exists for the current token
        if (i < finalEndIdx) {
          if (spacerChars[i]) {
            textParts.push(spacerChars[i]!)
          }
        }
      }
      const textToCopy = textParts.join('')
      event.clipboardData?.setData('text/plain', textToCopy)
    }

    mainDiv.addEventListener('copy', handleCopy as EventListener)
    return () => {
      mainDiv.removeEventListener('copy', handleCopy as EventListener)
    }
  }, [mainDivRef, tokens, spacerChars, _getEditableTextValue])
}
