import * as React from 'react'
// import { ZWS } from '../inlay.constants'
import { calculateOffsetInTextProvider } from '../utils/domNavigationUtils'

// Define HighlightRect locally for this hook
export interface HighlightRect {
  x: number
  y: number
  width: number
}

// Helper to find the actual text node and offset for a character offset
// This is crucial for creating precise DOM ranges on text.
const findTextNodeAndInnerOffset = (
  parentElement: HTMLElement,
  charOffset: number
): { node: Node; offset: number } | null => {
  let accumulatedOffset = 0
  const walker = document.createTreeWalker(parentElement, NodeFilter.SHOW_TEXT)
  let currentNode = walker.nextNode()
  while (currentNode) {
    const nodeText = currentNode.textContent || ''
    const nodeLength = nodeText.length
    if (charOffset <= accumulatedOffset + nodeLength) {
      return { node: currentNode, offset: charOffset - accumulatedOffset }
    }
    accumulatedOffset += nodeLength
    currentNode = walker.nextNode()
  }
  // If charOffset is at the very end, point to the end of the last text node found
  if (
    charOffset === accumulatedOffset &&
    parentElement.lastChild &&
    parentElement.lastChild.nodeType === Node.TEXT_NODE
  ) {
    return {
      node: parentElement.lastChild,
      offset: (parentElement.lastChild.textContent || '').length
    }
  }
  // Fallback if offset is out of bounds or no text nodes
  const firstTextNode = document
    .createTreeWalker(parentElement, NodeFilter.SHOW_TEXT)
    .firstChild()
  if (firstTextNode) return { node: firstTextNode, offset: 0 } // Default to start of first text node
  return null
}

export interface UseCustomSelectionDrawingProps<T = unknown> {
  mainDivRef: React.RefObject<HTMLDivElement | null>
  isEnabled: boolean // To easily turn custom drawing on/off
  tokens: Readonly<T[]>
  spacerChars: (string | null)[]
  _getEditableTextValue: (index: number) => string | undefined
  // Expose logical selection details if useSelectionChangeHandler already computes them reliably
  // This avoids re-calculating or duplicating complex DOM walking for selection boundaries.
  // For now, this hook will re-derive them for simplicity of this step.
}

export function useCustomSelectionDrawing<T>({
  mainDivRef,
  isEnabled,
  tokens,
  spacerChars,
  _getEditableTextValue
}: UseCustomSelectionDrawingProps<T>): HighlightRect[] {
  const [highlightRects, setHighlightRects] = React.useState<HighlightRect[]>(
    []
  )

  React.useEffect(() => {
    if (!isEnabled || !mainDivRef.current) {
      setHighlightRects([])
      return
    }

    const handleSelectionChange = () => {
      if (!mainDivRef.current) {
        setHighlightRects([])
        return
      }
      const selection = window.getSelection()
      const finalMergedRects: HighlightRect[] = []

      console.log(
        '[useCustomSelectionDrawing] handleSelectionChange fired.',
        selection
      )

      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0)
        console.log('[useCustomSelectionDrawing] Range details:', {
          startContainer: range.startContainer,
          startOffset: range.startOffset,
          endContainer: range.endContainer,
          endOffset: range.endOffset,
          commonAncestorContainer: range.commonAncestorContainer
        })

        if (mainDivRef.current.contains(range.commonAncestorContainer)) {
          const inlayRootRect = mainDivRef.current.getBoundingClientRect()
          const containerWidth = inlayRootRect.width
          const newRawRects: HighlightRect[] = []

          const editableRegionOrToken = (tokenEl: HTMLElement): HTMLElement =>
            (tokenEl.querySelector(
              '[data-inlay-editable-region="true"]'
            ) as HTMLElement) || tokenEl

          const startNode = range.startContainer
          const endNode = range.endContainer
          const domStartOffset = range.startOffset
          const domEndOffset = range.endOffset

          let startTokenEl: HTMLElement | null = null
          let endTokenEl: HTMLElement | null = null

          if (startNode === mainDivRef.current) {
            startTokenEl = mainDivRef.current.querySelector('[data-token-id]')
          } else if (startNode.nodeType === Node.ELEMENT_NODE) {
            startTokenEl =
              (startNode as Element).closest('[data-token-id]') ||
              ((startNode as Element).querySelector(
                '[data-token-id]'
              ) as HTMLElement | null)
          } else {
            startTokenEl =
              startNode.parentElement?.closest('[data-token-id]') || null
          }

          if (endNode === mainDivRef.current) {
            const allTokens =
              mainDivRef.current.querySelectorAll('[data-token-id]')
            if (allTokens.length > 0) {
              endTokenEl = allTokens[allTokens.length - 1] as HTMLElement
            }
          } else if (endNode.nodeType === Node.ELEMENT_NODE) {
            endTokenEl = (endNode as Element).closest('[data-token-id]')
            if (!endTokenEl && (endNode as Element).querySelectorAll) {
              const allTokensInEndNode = (endNode as Element).querySelectorAll(
                '[data-token-id]'
              )
              if (allTokensInEndNode.length > 0) {
                endTokenEl = allTokensInEndNode[
                  allTokensInEndNode.length - 1
                ] as HTMLElement
              }
            }
          } else {
            endTokenEl =
              endNode.parentElement?.closest('[data-token-id]') || null
          }

          console.log('[useCustomSelectionDrawing] Identified elements:', {
            startTokenEl,
            endTokenEl
          })

          let startTokenIdx = -1,
            startCharOffset = 0,
            endTokenIdx = -1,
            endCharOffset = 0

          if (startTokenEl && endTokenEl) {
            startTokenIdx = parseInt(startTokenEl.dataset.tokenId || '-1', 10)
            endTokenIdx = parseInt(endTokenEl.dataset.tokenId || '-1', 10)

            const textProviderForStart = editableRegionOrToken(startTokenEl)

            const isIntraTokenSelectAll =
              startTokenEl === endTokenEl &&
              tokens[startTokenIdx] !== undefined &&
              range.startContainer === startTokenEl &&
              domStartOffset === 0 &&
              range.endContainer === startTokenEl &&
              domEndOffset === startTokenEl.childNodes.length

            const isFullInlaySelection =
              !isIntraTokenSelectAll &&
              range.commonAncestorContainer === mainDivRef.current &&
              startNode === mainDivRef.current &&
              domStartOffset === 0 &&
              endNode === mainDivRef.current &&
              (domEndOffset === mainDivRef.current.childNodes.length ||
                domEndOffset === mainDivRef.current.childElementCount) &&
              tokens.length > 0 &&
              startTokenIdx === 0 &&
              endTokenIdx === tokens.length - 1

            if (isIntraTokenSelectAll) {
              console.log(
                '[useCustomSelectionDrawing] Intra-token select all detected for token:',
                startTokenIdx
              )
              startCharOffset = 0
              endCharOffset =
                tokens[startTokenIdx] !== undefined &&
                tokens[startTokenIdx] !== null
                  ? _getEditableTextValue(startTokenIdx) !== undefined
                    ? (_getEditableTextValue(startTokenIdx) as string).length
                    : String(tokens[startTokenIdx]).length
                  : 0
            } else if (isFullInlaySelection) {
              console.log(
                '[useCustomSelectionDrawing] Global select all detected.'
              )
              startCharOffset = 0
              endCharOffset =
                tokens[endTokenIdx] !== undefined &&
                tokens[endTokenIdx] !== null
                  ? _getEditableTextValue(endTokenIdx) !== undefined
                    ? (_getEditableTextValue(endTokenIdx) as string).length
                    : String(tokens[endTokenIdx]).length
                  : 0
            } else {
              const textProviderForEnd = editableRegionOrToken(endTokenEl)
              startCharOffset = calculateOffsetInTextProvider(
                textProviderForStart,
                startNode,
                domStartOffset,
                selection.anchorNode,
                selection.anchorOffset
              )
              endCharOffset = calculateOffsetInTextProvider(
                textProviderForEnd,
                endNode,
                domEndOffset,
                selection.focusNode,
                selection.focusOffset
              )
            }

            console.log(
              '[useCustomSelectionDrawing] Initial derived indices/offsets:',
              { startTokenIdx, startCharOffset, endTokenIdx, endCharOffset }
            )

            if (
              startTokenIdx > endTokenIdx ||
              (startTokenIdx === endTokenIdx && startCharOffset > endCharOffset)
            ) {
              ;[startTokenIdx, endTokenIdx] = [endTokenIdx, startTokenIdx]
              const tempOffset = startCharOffset
              startCharOffset = endCharOffset
              endCharOffset = tempOffset
              console.log(
                '[useCustomSelectionDrawing] Swapped indices/offsets:',
                { startTokenIdx, startCharOffset, endTokenIdx, endCharOffset }
              )
            }
          } else {
            console.log(
              '[useCustomSelectionDrawing] Could not identify start or end token element robustly for full range.'
            )
            startTokenIdx = -1
            endTokenIdx = -1
          }

          console.log(
            '[useCustomSelectionDrawing] Final indices/offsets before loop:',
            { startTokenIdx, endTokenIdx, startCharOffset, endCharOffset }
          )

          if (startTokenIdx !== -1 && endTokenIdx !== -1) {
            for (let i = startTokenIdx; i <= endTokenIdx; i++) {
              const currentTokenElement = mainDivRef.current.querySelector(
                `[data-token-id="${i}"]`
              ) as HTMLElement | null
              if (!currentTokenElement) continue

              const textProvider = editableRegionOrToken(currentTokenElement)
              const tokenLogicalTextLength =
                tokens[i] !== undefined && tokens[i] !== null
                  ? _getEditableTextValue(i) !== undefined
                    ? (_getEditableTextValue(i) as string).length
                    : String(tokens[i]).length
                  : 0

              const selectionStartForThisToken =
                i === startTokenIdx ? startCharOffset : 0
              const selectionEndForThisToken =
                i === endTokenIdx ? endCharOffset : tokenLogicalTextLength

              if (selectionStartForThisToken < selectionEndForThisToken) {
                const startPoint = findTextNodeAndInnerOffset(
                  textProvider,
                  selectionStartForThisToken
                )
                const endPoint = findTextNodeAndInnerOffset(
                  textProvider,
                  selectionEndForThisToken
                )

                if (startPoint && endPoint) {
                  try {
                    const subRange = document.createRange()
                    // Ensure startPoint.offset and endPoint.offset are within the bounds of their respective text nodes
                    const safeStartOffset = Math.min(
                      startPoint.offset,
                      (startPoint.node.textContent || '').length
                    )
                    const safeEndOffset = Math.min(
                      endPoint.offset,
                      (endPoint.node.textContent || '').length
                    )

                    if (
                      startPoint.node === endPoint.node &&
                      safeStartOffset > safeEndOffset
                    ) {
                      // If offsets are inverted within the same node, skip or log error
                      console.warn(
                        '[useCustomSelectionDrawing] Inverted offsets in the same node',
                        startPoint,
                        endPoint,
                        safeStartOffset,
                        safeEndOffset
                      )
                    } else {
                      subRange.setStart(startPoint.node, safeStartOffset)
                      subRange.setEnd(endPoint.node, safeEndOffset)
                      const clientRects = subRange.getClientRects()
                      for (let k = 0; k < clientRects.length; k++) {
                        const r = clientRects[k]
                        if (r.width > 0 && r.height > 0) {
                          newRawRects.push({
                            x: r.left - inlayRootRect.left,
                            y: r.top - inlayRootRect.top,
                            width: r.width
                          })
                        }
                      }
                    }
                  } catch (e) {
                    console.error(
                      'Error creating sub-range for token part:',
                      i,
                      e
                    )
                  }
                }
              }

              // Add spacer rect if applicable and this is not the very last token in the entire selection
              if (i < endTokenIdx && spacerChars[i]) {
                // Use the data-attribute to find the spacer span
                const spacerElement = mainDivRef.current.querySelector(
                  `span[data-spacer-after-token="${i}"]`
                ) as HTMLElement | null

                if (spacerElement) {
                  const spacerRects = spacerElement.getClientRects()
                  for (let k = 0; k < spacerRects.length; k++) {
                    const r = spacerRects[k]
                    if (r.width > 0 && r.height > 0) {
                      newRawRects.push({
                        x: r.left - inlayRootRect.left,
                        y: r.top - inlayRootRect.top,
                        width: r.width
                      })
                    }
                  }
                } else {
                  console.warn(
                    `[useCustomSelectionDrawing] Spacer element after token ${i} not found.`
                  )
                }
              }
            }
          }

          console.log(
            '[DEBUG] Raw rectangles before merge:',
            JSON.stringify(
              newRawRects.map((r) => ({ x: r.x, y: r.y, width: r.width }))
            )
          )

          // Apply merging logic to newRawRects
          if (newRawRects.length > 0) {
            const lines = new Map<number, HighlightRect[]>()
            const Y_TOLERANCE = 4
            newRawRects.forEach((rect) => {
              let foundLine = false
              for (const yKey of Array.from(lines.keys())) {
                if (Math.abs(yKey - rect.y) < Y_TOLERANCE) {
                  lines.get(yKey)!.push(rect)
                  foundLine = true
                  break
                }
              }
              if (!foundLine) lines.set(rect.y, [rect])
            })

            // Get all lines sorted by y position
            const sortedLines = Array.from(lines.entries()).sort(
              ([y1], [y2]) => y1 - y2
            )

            // Process each line
            for (
              let lineIndex = 0;
              lineIndex < sortedLines.length;
              lineIndex++
            ) {
              const [yPos, lineRects] = sortedLines[lineIndex]
              if (lineRects.length === 0) continue

              // Sort rectangles within this line by x position
              lineRects.sort((a: HighlightRect, b: HighlightRect) => a.x - b.x)

              // For multi-line selections, extend intermediate lines to full width
              const isFirstLine = lineIndex === 0
              const isLastLine = lineIndex === sortedLines.length - 1
              const isSingleLineSelection = sortedLines.length === 1

              if (lineRects.length > 0) {
                // Start with the first rect in the line
                let currentMergedRect = { ...lineRects[0] }

                // Merge adjacent rectangles in this line
                for (let i = 1; i < lineRects.length; i++) {
                  const nextRect = lineRects[i]
                  const MAX_HORIZONTAL_GAP_TO_MERGE = 15
                  if (
                    nextRect.x <=
                    currentMergedRect.x +
                      currentMergedRect.width +
                      MAX_HORIZONTAL_GAP_TO_MERGE
                  ) {
                    const newEndX = Math.max(
                      currentMergedRect.x + currentMergedRect.width,
                      nextRect.x + nextRect.width
                    )
                    currentMergedRect.width = newEndX - currentMergedRect.x
                  } else {
                    // Different segment on the same line
                    // For lines that aren't the first or last, we might want to extend them
                    // but for now we'll push this merged segment
                    finalMergedRects.push(currentMergedRect)
                    currentMergedRect = { ...nextRect }
                  }
                }

                // For multi-line selections:
                // - Extend non-last lines to container width
                // - Leave last line and single-line selections as natural width
                if (!isLastLine && !isSingleLineSelection) {
                  // For intermediate lines in multi-line selection, extend to container width
                  currentMergedRect.width = containerWidth - currentMergedRect.x
                }
                // Otherwise, keep the rect as is (last line or single line selection)

                finalMergedRects.push(currentMergedRect)

                // If this is a middle line (not first, not last), add a rect from x=0 to the first rect
                if (!isFirstLine && !isLastLine && lineRects[0].x > 0) {
                  finalMergedRects.push({
                    x: 0,
                    y: yPos,
                    width: lineRects[0].x
                  })
                }
              }
            }
          }
        } else {
          // console.log('[useCustomSelectionDrawing] Selection is outside mainDivRef');
        }
      }
      console.log(
        '[DEBUG] Final merged rectangles:',
        JSON.stringify(
          finalMergedRects.map((r) => ({ x: r.x, y: r.y, width: r.width }))
        )
      )
      setHighlightRects(finalMergedRects)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    // Initial calculation in case selection already exists
    handleSelectionChange()

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      setHighlightRects([]) // Clear rects on cleanup
    }
  }, [
    isEnabled,
    mainDivRef,
    tokens,
    spacerChars,
    _getEditableTextValue,
    setHighlightRects
  ])

  return highlightRects
}
