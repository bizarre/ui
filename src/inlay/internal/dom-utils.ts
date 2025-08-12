export const getTextNodeAtOffset = (
  root: HTMLElement,
  offset: number
): [ChildNode | null, number] => {
  // Helper predicates and utilities
  const isTokenElement = (el: Element): boolean =>
    el.hasAttribute('data-token-text')
  const getTokenRawLength = (el: Element): number =>
    (el.getAttribute('data-token-text') || '').length

  const findFirstTextNode = (el: Element): ChildNode | null => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
    return walker.nextNode() as ChildNode | null
  }
  const findLastTextNode = (el: Element): ChildNode | null => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
    let last: Node | null = null
    let n: Node | null
    while ((n = walker.nextNode())) last = n
    return last as ChildNode | null
  }
  const getRenderedTextLength = (el: Element): number => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
    let total = 0
    let n: Node | null
    while ((n = walker.nextNode())) total += (n.textContent || '').length
    return total
  }

  const traverse = (
    container: Node,
    remaining: { value: number }
  ): [ChildNode | null, number] | null => {
    const children = container.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children[i]

      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element

        if (isTokenElement(el)) {
          const rawLen = getTokenRawLength(el)
          const renderedLen = getRenderedTextLength(el)
          const isDiverged = renderedLen !== rawLen

          if (isDiverged) {
            if (remaining.value <= rawLen) {
              // Inside this token's raw span: snap to nearest token edge visually
              const first = findFirstTextNode(el)
              const last = findLastTextNode(el)
              if (!first && !last) return null

              const snapToStart = remaining.value <= rawLen / 2
              if (snapToStart) {
                if (first) return [first, 0]
              } else {
                if (last) return [last, (last.textContent || '').length]
              }
              if (first) return [first, 0]
              if (last) return [last, (last.textContent || '').length]
              return null
            }
            remaining.value -= rawLen
            continue
          }

          // Not diverged: traverse inside normally (rendered == raw)
          const found = traverse(el, remaining)
          if (found) return found
          continue
        }

        // Non-token element: traverse into it
        const found = traverse(el, remaining)
        if (found) return found
        continue
      }

      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || ''
        if (remaining.value <= text.length) {
          return [child as ChildNode, remaining.value]
        }
        remaining.value -= text.length
      }
    }

    return null
  }

  // Execute traversal
  const result = traverse(root, { value: Math.max(0, offset) })
  if (result) return result

  // Fallbacks: try to place at the end of the last token or last text
  const allTokenTextNodes = Array.from(
    root.querySelectorAll('[data-token-text]')
  )
    .map((el) => findLastTextNode(el))
    .filter(Boolean) as ChildNode[]
  if (allTokenTextNodes.length > 0) {
    const lastNode = allTokenTextNodes[allTokenTextNodes.length - 1]
    return [lastNode, (lastNode.textContent || '').length]
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let last: Node | null = null
  let n: Node | null
  while ((n = walker.nextNode())) last = n
  if (last) return [last as ChildNode, (last.textContent || '').length]

  return [null, 0]
}

export const getAbsoluteOffset = (
  root: HTMLElement,
  node: Node,
  offset: number
) => {
  // Helper predicates and utilities
  const isTokenElement = (el: Element): boolean =>
    el.hasAttribute('data-token-text')
  const getTokenRawLength = (el: Element): number =>
    (el.getAttribute('data-token-text') || '').length

  const getRenderedTextLength = (el: Element): number => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
    let total = 0
    let n: Node | null
    while ((n = walker.nextNode())) {
      total += (n.textContent || '').length
    }
    return total
  }

  const getOffsetWithinElement = (
    el: Element,
    target: Node,
    targetOffset: number
  ): number => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
    let total = 0
    let n: Node | null
    while ((n = walker.nextNode())) {
      if (n === target) {
        total += Math.min(targetOffset, (n.textContent || '').length)
        break
      }
      total += (n.textContent || '').length
    }
    return total
  }

  const traverse = (container: Node, acc: { value: number }): number | null => {
    const children = container.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children[i]

      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element

        if (isTokenElement(el)) {
          const rawLen = getTokenRawLength(el)
          const renderedLen = getRenderedTextLength(el)
          const isDiverged = renderedLen !== rawLen

          if (isDiverged) {
            if (el.contains(node)) {
              const withinRendered = getOffsetWithinElement(el, node, offset)
              const snapToStart = withinRendered <= renderedLen / 2
              return acc.value + (snapToStart ? 0 : rawLen)
            }
            acc.value += rawLen
            continue
          }

          // Not diverged: allow interior positions to map naturally
          if (el.contains(node)) {
            const inner = traverse(el, acc)
            if (inner != null) return inner
          } else {
            // Add rendered length (equals raw length here)
            acc.value += renderedLen
          }
          continue
        }

        // Non-token element
        if (el.contains(node)) {
          const inner = traverse(el, acc)
          if (inner != null) return inner
        } else {
          // Sum subtree rendered length for non-token elements
          const measure = (e: Element): number => {
            let total = 0
            const cn = e.childNodes
            for (let j = 0; j < cn.length; j++) {
              const c = cn[j]
              if (c.nodeType === Node.TEXT_NODE) {
                total += (c.textContent || '').length
              } else if (c.nodeType === Node.ELEMENT_NODE) {
                const ce = c as Element
                if (isTokenElement(ce)) {
                  const rl = getTokenRawLength(ce)
                  const rr = getRenderedTextLength(ce)
                  total += rr === rl ? rr : rl
                } else {
                  total += measure(ce)
                }
              }
            }
            return total
          }
          acc.value += measure(el)
        }
        continue
      }

      if (child.nodeType === Node.TEXT_NODE) {
        if (child === node) {
          return acc.value + Math.min(offset, (child.textContent || '').length)
        } else {
          acc.value += (child.textContent || '').length
        }
      }
    }
    return null
  }

  const result = traverse(root, { value: 0 })
  if (result != null) return result

  // Fallback: compute total length blending raw/rendered appropriately
  const totalLength = (() => {
    let total = 0
    const stack: Node[] = [root]
    const isTok = (el: Element) => el.hasAttribute('data-token-text')
    while (stack.length) {
      const n = stack.pop()!
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element
        if (isTok(el)) {
          const rl = (el.getAttribute('data-token-text') || '').length
          const rr = getRenderedTextLength(el)
          total += rr === rl ? rr : rl
          continue
        }
        const cn = el.childNodes
        for (let i = cn.length - 1; i >= 0; i--) stack.push(cn[i])
      } else if (n.nodeType === Node.TEXT_NODE) {
        total += (n.textContent || '').length
      }
    }
    return total
  })()

  return totalLength
}

export const setDomSelection = (
  root: HTMLElement,
  start: number,
  end?: number
) => {
  const [startNode, startOffset] = getTextNodeAtOffset(root, start)
  const [endNode, endOffset] = end
    ? getTextNodeAtOffset(root, end)
    : [startNode, startOffset]

  if (startNode && endNode) {
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }
}
