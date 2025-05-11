import { ZWS } from '../inlay.constants'

/**
 * Calculates the character offset of a DOM selection point (container + offsetInContainer)
 * within a given textProvider element (e.g., a token or its editable region).
 * This utility aims to translate a DOM range point into a plain text character offset.
 *
 * @param textProvider The HTMLElement (e.g., token span or editable region) to calculate offset within.
 * @param container The DOM Node where the selection point resides (e.g., range.startContainer).
 * @param offsetInContainer The offset within the container Node (e.g., range.startOffset).
 * @param selectionRefNode Typically window.getSelection().anchorNode or .focusNode, used to refine offset if container is textProvider itself.
 * @param selectionRefOffset Typically window.getSelection().anchorOffset or .focusOffset.
 * @returns The numerical character offset within the text content of the textProvider.
 */
export const calculateOffsetInTextProvider = (
  textProvider: HTMLElement,
  container: Node,
  offsetInContainer: number,
  selectionRefNode: Node | null,
  selectionRefOffset: number
): number => {
  console.log('[calculateOffsetInTextProvider] Inputs:', {
    textProviderContent: textProvider.textContent,
    containerType: container.nodeType,
    containerContent: container.textContent,
    offsetInContainer,
    selectionRefNodeContent: selectionRefNode?.textContent,
    selectionRefOffset
  })

  let calculatedInternalOffset = 0
  if (textProvider.contains(container)) {
    if (container === textProvider) {
      // Selection is directly on the textProvider element itself.
      // OffsetInContainer might be a child index.
      // We need to sum lengths of preceding child nodes.
      let child = textProvider.firstChild
      let currentCount = 0
      while (child && currentCount < offsetInContainer) {
        calculatedInternalOffset += (child.textContent || '').length
        child = child.nextSibling
        currentCount++
      }
      // If the actual selection reference (e.g., anchorNode) is a text node within this textProvider,
      // it might give a more precise location than just summing up to an element child index.
      if (
        selectionRefNode &&
        selectionRefNode.nodeType === Node.TEXT_NODE &&
        container === textProvider && // Ensure context is still selection on provider
        textProvider.contains(selectionRefNode)
      ) {
        let tempRefCalc = 0
        let tempNodeWalker: Node | null = textProvider.firstChild
        while (tempNodeWalker && tempNodeWalker !== selectionRefNode) {
          tempRefCalc += (tempNodeWalker.textContent || '').length
          tempNodeWalker = tempNodeWalker.nextSibling
        }
        if (tempNodeWalker === selectionRefNode) {
          // Found the selectionRefNode
          // Use this more precise offset based on the text node selection
          calculatedInternalOffset = tempRefCalc + selectionRefOffset
        }
      }
    } else {
      // Container is a descendant of textProvider (e.g., a text node or nested element).
      // We need to walk from the start of textProvider to the container.
      let tempNode: Node | null = textProvider.firstChild
      while (
        tempNode &&
        tempNode !== container &&
        !tempNode.contains(container)
      ) {
        calculatedInternalOffset += (tempNode.textContent || '').length
        tempNode = tempNode.nextSibling
      }

      // At this point, tempNode is either the container, contains the container, or null.
      if (
        tempNode &&
        (tempNode === container || tempNode.contains(container))
      ) {
        let localOffset = offsetInContainer

        // If tempNode is not the container itself, it means container is a child of tempNode.
        // We need to add offsets of siblings before container, up to tempNode.
        if (tempNode !== container) {
          // Walk upwards from container to tempNode, summing lengths of previous siblings at each level.
          // This handles cases where container is nested within elements inside tempNode.
          let currentWalkingNode: Node | null = container
          while (currentWalkingNode && currentWalkingNode !== tempNode) {
            let previousSibling = currentWalkingNode.previousSibling
            while (previousSibling) {
              localOffset += (previousSibling.textContent || '').length
              previousSibling = previousSibling.previousSibling
            }
            currentWalkingNode = currentWalkingNode.parentElement
            // If currentWalkingNode becomes tempNode, the localOffset is now relative to tempNode's start.
          }
        }
        calculatedInternalOffset += localOffset
      }
      // If tempNode is null, it implies container was not found as expected - this shouldn't happen if textProvider.contains(container)
    }
    const fullText = textProvider.textContent || ''
    // Ensure offset is not greater than the actual text content length (especially after ZWS removal)
    console.log(
      '[calculateOffsetInTextProvider] Result:',
      calculatedInternalOffset,
      'Full text length (for Math.min):',
      (textProvider.textContent || '').length
    )
    const finalOffset = Math.min(
      calculatedInternalOffset,
      fullText === ZWS ? 0 : fullText.length
    )
    console.log(
      '[calculateOffsetInTextProvider] Final clamped result:',
      finalOffset
    )
    return finalOffset
  }
  // Fallback if container is not within textProvider (should ideally not be reached if checks are done prior)
  return (textProvider.textContent || '').length
}
