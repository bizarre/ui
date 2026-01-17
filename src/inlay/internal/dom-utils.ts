const isTokenElement = (el: Element): boolean =>
  el.hasAttribute('data-token-text')

const getTokenRawLength = (el: Element): number =>
  (el.getAttribute('data-token-text') || '').length

const getRenderedTextLength = (el: Element): number => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
  let total = 0
  let n: Node | null
  while ((n = walker.nextNode())) total += (n.textContent || '').length
  return total
}

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

export function getClosestTokenEl(node: Node | null): HTMLElement | null {
  let curr: Node | null = node
  while (curr) {
    if (curr.nodeType === Node.ELEMENT_NODE) {
      const el = curr as HTMLElement
      if (el.hasAttribute('data-token-text')) return el
    }
    curr = curr.parentNode
  }
  return null
}

export function getTokenRawRange(
  root: HTMLElement,
  tokenEl: HTMLElement
): { start: number; end: number } | null {
  const rawText = tokenEl.getAttribute('data-token-text')
  if (!rawText) return null

  const walker = document.createTreeWalker(tokenEl, NodeFilter.SHOW_TEXT, null)
  const firstText = walker.nextNode()
  if (!firstText) return null

  const start = getAbsoluteOffset(root, firstText, 0)
  return { start, end: start + rawText.length }
}

export const getTextNodeAtOffset = (
  root: HTMLElement,
  offset: number
): [ChildNode | null, number] => {
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

          const found = traverse(el, remaining)
          if (found) return found
          continue
        }

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

  const result = traverse(root, { value: Math.max(0, offset) })
  if (result) return result

  // Fallback: place at end of last text node
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
): number => {
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

  // Handle element node containers (e.g. Firefox Ctrl+a sets selection on element, not text node)
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    const children = el.childNodes

    let total = 0
    const measure = (n: Node): number => {
      if (n.nodeType === Node.TEXT_NODE) {
        return (n.textContent || '').length
      }
      if (n.nodeType === Node.ELEMENT_NODE) {
        const e = n as Element
        if (isTokenElement(e)) return getTokenRawLength(e)
        let sum = 0
        for (let i = 0; i < e.childNodes.length; i++) {
          sum += measure(e.childNodes[i])
        }
        return sum
      }
      return 0
    }

    for (let i = 0; i < offset && i < children.length; i++) {
      total += measure(children[i])
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

          if (el.contains(node)) {
            const inner = traverse(el, acc)
            if (inner != null) return inner
          } else {
            acc.value += renderedLen
          }
          continue
        }

        if (el.contains(node)) {
          const inner = traverse(el, acc)
          if (inner != null) return inner
        } else {
          const measureSubtree = (e: Element): number => {
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
                  total += measureSubtree(ce)
                }
              }
            }
            return total
          }
          acc.value += measureSubtree(el)
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

  // Fallback: total length
  let total = 0
  const stack: Node[] = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element
      if (isTokenElement(el)) {
        const rl = getTokenRawLength(el)
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

export const serializeRawFromDom = (root: HTMLElement): string => {
  const clone = root.cloneNode(true) as HTMLElement
  const tokenEls = clone.querySelectorAll('[data-token-text]')
  tokenEls.forEach((el) => {
    const raw = el.getAttribute('data-token-text') || ''
    const renderedLen = getRenderedTextLength(el)
    if (renderedLen !== raw.length) {
      ;(el as HTMLElement).textContent = raw
    }
  })
  return (clone as HTMLElement).innerText
}
