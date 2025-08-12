import '@testing-library/jest-dom/vitest'
import '@formatjs/intl-datetimeformat/polyfill'
import '@formatjs/intl-datetimeformat/locale-data/en'
import '@formatjs/intl-datetimeformat/add-all-tz'

// Polyfill missing Range geometry APIs in jsdom so selection sync doesn't crash
const RangeProto: any = (global as any).Range?.prototype
if (RangeProto) {
  if (!RangeProto.getClientRects) {
    RangeProto.getClientRects = () => []
  }
  if (!RangeProto.getBoundingClientRect) {
    RangeProto.getBoundingClientRect = () =>
      typeof (global as any).DOMRect !== 'undefined'
        ? new (global as any).DOMRect(0, 0, 0, 0)
        : ({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            toJSON() {}
          } as any)
  }
}
