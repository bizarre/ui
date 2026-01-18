import { useLayoutEffect } from 'react'

export function usePlaceholderSync(
  editorRef: React.RefObject<HTMLDivElement | null>,
  placeholderRef: React.RefObject<HTMLDivElement | null>,
  deps: unknown[]
) {
  useLayoutEffect(() => {
    if (editorRef.current && placeholderRef.current) {
      const editorStyles = window.getComputedStyle(editorRef.current)
      const stylesToCopy: (keyof CSSStyleDeclaration)[] = [
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'fontFamily',
        'fontSize',
        'lineHeight',
        'letterSpacing',
        'textAlign'
      ]

      stylesToCopy.forEach((styleName) => {
        const v = editorStyles[styleName]
        if (v !== null) {
          // @ts-expect-error - Style name is a valid CSSStyleDeclaration property
          placeholderRef.current!.style[styleName] = v as string
        }
      })
      placeholderRef.current!.style.borderStyle = editorStyles.borderStyle
      placeholderRef.current!.style.borderColor = 'transparent'
    }
  }, deps)
}
