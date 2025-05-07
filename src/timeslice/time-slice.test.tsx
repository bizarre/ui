import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Root as TimeSlice,
  Input,
  Portal,
  Trigger,
  Shortcut
} from './time-slice'
import '@testing-library/jest-dom'
import { vi } from 'vitest'

describe('TimeSlice Component Family', () => {
  describe('TimeSlice (Root)', () => {
    it('should render without crashing with minimal props', () => {
      render(
        <TimeSlice>
          <Input />
          <Portal>
            <div>Portal Content</div>
          </Portal>
        </TimeSlice>
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should be closed by default', () => {
      render(
        <TimeSlice>
          <Input />
          <Portal data-testid="portal-closed-default">
            <div>Portal Content</div>
          </Portal>
        </TimeSlice>
      )
      expect(screen.getByTestId('portal-closed-default')).toHaveStyle({
        display: 'none'
      })
    })

    it('should respect defaultOpen prop', () => {
      render(
        <TimeSlice defaultOpen>
          <Input />
          <Portal>
            <div>Portal Content</div>
          </Portal>
        </TimeSlice>
      )
      expect(screen.getByText('Portal Content')).toBeVisible()
    })

    it('should handle controlled open state and onOpenChange', () => {
      const handleOpenChange = vi.fn()
      const mockOnDateRangeChange = vi.fn()
      const { rerender } = render(
        <TimeSlice
          open={false}
          onOpenChange={handleOpenChange}
          onDateRangeChange={mockOnDateRangeChange}
        >
          <Input />
          <Portal data-testid="portal-controlled-open">
            <div>Portal Content</div>
          </Portal>
        </TimeSlice>
      )
      expect(screen.getByTestId('portal-controlled-open')).toHaveStyle({
        display: 'none'
      })

      rerender(
        <TimeSlice
          open={true}
          onOpenChange={handleOpenChange}
          onDateRangeChange={mockOnDateRangeChange}
        >
          <Input />
          <Portal data-testid="portal-controlled-open">
            <div>Portal Content</div>
          </Portal>
        </TimeSlice>
      )
      expect(screen.getByTestId('portal-controlled-open')).not.toHaveStyle({
        display: 'none'
      })
      expect(screen.getByText('Portal Content')).toBeVisible()
    })

    it('should use defaultDateRange and call onDateRangeChange', () => {
      const startDate = new Date('2024-01-01T00:00:00Z')
      const endDate = new Date('2024-01-01T01:00:00Z')
      const handleDateRangeChange = vi.fn()
      render(
        <TimeSlice
          defaultDateRange={{ startDate, endDate }}
          onDateRangeChange={handleDateRangeChange}
        >
          <Input />
        </TimeSlice>
      )

      expect(screen.getByRole('combobox')).toHaveValue(
        'Jan 1, 12:00\u202FAM – Jan 1, 1:00\u202FAM'
      )
    })

    it('should handle controlled dateRange and onDateRangeConfirm on close', () => {
      const startDate = new Date('2024-02-10T10:00:00Z')
      const endDate = new Date('2024-02-10T12:00:00Z')
      const handleDateRangeConfirm = vi.fn()
      const mockOnOpenChange = vi.fn()

      const { rerender } = render(
        <TimeSlice
          open={true}
          onOpenChange={mockOnOpenChange}
          dateRange={{ startDate, endDate }}
          onDateRangeConfirm={handleDateRangeConfirm}
        >
          <Input />
          <Portal>
            <div>Portal</div>
          </Portal>
        </TimeSlice>
      )
      expect(screen.getByRole('combobox')).toHaveValue(
        'Feb 10, 10:00\u202FAM – Feb 10, 12:00\u202FPM'
      )

      rerender(
        <TimeSlice
          open={false}
          onOpenChange={mockOnOpenChange}
          dateRange={{ startDate, endDate }}
          onDateRangeConfirm={handleDateRangeConfirm}
        >
          <Input />
          <Portal>
            <div>Portal</div>
          </Portal>
        </TimeSlice>
      )
      expect(handleDateRangeConfirm).toHaveBeenCalledWith({
        startDate,
        endDate
      })
    })

    it('should respect timeZone prop for display', () => {
      const startDateNY = new Date('2024-01-01T12:00:00Z')
      const endDateNY = new Date('2024-01-01T14:00:00Z')
      render(
        <TimeSlice
          dateRange={{ startDate: startDateNY, endDate: endDateNY }}
          timeZone="America/New_York"
        >
          <Input />
        </TimeSlice>
      )

      expect(screen.getByRole('combobox')).toHaveValue(
        'Jan 1, 7:00\u202FAM – Jan 1, 9:00\u202FAM'
      )
    })

    it('should use custom formatInput function', () => {
      const startDate = new Date('2024-04-01T10:00:00Z')
      const endDate = new Date('2024-04-01T12:00:00Z')
      const customFormat = vi.fn(({ startDate, endDate }) => {
        if (startDate && endDate)
          return `Custom: ${startDate.getUTCHours()} to ${endDate.getUTCHours()}`
        return 'Custom Empty'
      })
      render(
        <TimeSlice
          dateRange={{ startDate, endDate }}
          formatInput={customFormat}
        >
          <Input />
        </TimeSlice>
      )

      expect(customFormat).toHaveBeenCalledWith({
        startDate,
        endDate,
        isRelative: false
      })

      expect(screen.getByRole('combobox')).toHaveValue('Custom: 10 to 12')
    })
  })

  describe('TimeSliceTrigger', () => {
    it('should render a div by default and focus input on click', () => {
      render(
        <TimeSlice>
          <Trigger>
            <span>Click Me</span>
          </Trigger>
          <Input data-testid="input-for-trigger1" />
        </TimeSlice>
      )

      const triggerElement = screen.getByText('Click Me').parentElement
      expect(triggerElement).toBeInTheDocument()
      expect(triggerElement?.tagName).toBe('DIV')

      fireEvent.click(triggerElement!)
      const inputElement = screen.getByTestId('input-for-trigger1')
      expect(document.activeElement).toBe(inputElement)
    })

    it('should render as child and forward props when asChild is true', () => {
      render(
        <TimeSlice>
          <Trigger asChild data-testid="custom-trigger">
            <button>Custom Button</button>
          </Trigger>
          <Input data-testid="input-for-trigger2" />
        </TimeSlice>
      )

      const triggerButton = screen.getByRole('button', {
        name: 'Custom Button'
      })
      expect(triggerButton).toBeInTheDocument()
      expect(triggerButton.tagName).toBe('BUTTON')
      expect(triggerButton).toHaveAttribute('data-testid', 'custom-trigger')

      fireEvent.click(triggerButton)
      const inputElement = screen.getByTestId('input-for-trigger2')
      expect(document.activeElement).toBe(inputElement)
    })
  })

  describe('TimeSliceInput', () => {
    const initialStartDate = new Date('2024-07-04T10:00:00Z')
    const initialEndDate = new Date('2024-07-04T12:00:00Z')
    const initialFormattedValue = 'Jul 4, 10:00\u202FAM – Jul 4, 12:00\u202FPM'

    it('should render with initial value from context and open portal on focus', () => {
      render(
        <TimeSlice
          defaultDateRange={{
            startDate: initialStartDate,
            endDate: initialEndDate
          }}
        >
          <Input data-testid="input-control" />
          <Portal>
            <div>Portal Content For Input</div>
          </Portal>
        </TimeSlice>
      )
      const inputEl = screen.getByTestId('input-control')
      expect(inputEl).toHaveValue(initialFormattedValue)

      fireEvent.focus(inputEl)

      expect(inputEl).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText('Portal Content For Input')).toBeVisible()
    })

    it('should update dateRange on valid input change', () => {
      const handleDateRangeChange = vi.fn()
      render(
        <TimeSlice onDateRangeChange={handleDateRangeChange}>
          <Input data-testid="input-change" />
        </TimeSlice>
      )
      const inputEl = screen.getByTestId('input-change')
      fireEvent.change(inputEl, {
        target: { value: 'Jul 5, 2024, 2:00 PM – Jul 5, 2024, 4:00 PM' }
      })

      expect(handleDateRangeChange).toHaveBeenCalled()
      const newRange = handleDateRangeChange.mock.calls[0][0]
      expect(newRange.startDate).toEqual(new Date('Jul 5, 2024, 2:00 PM'))
      expect(newRange.endDate).toEqual(new Date('Jul 5, 2024, 4:00 PM'))
    })

    it('should clear dateRange on empty input change', () => {
      const handleDateRangeChange = vi.fn()
      render(
        <TimeSlice
          defaultDateRange={{
            startDate: initialStartDate,
            endDate: initialEndDate
          }}
          onDateRangeChange={handleDateRangeChange}
        >
          <Input data-testid="input-clear" />
        </TimeSlice>
      )
      const inputEl = screen.getByTestId('input-clear')
      fireEvent.change(inputEl, { target: { value: '' } })
      expect(handleDateRangeChange).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined
      })
    })

    it('should call useSegmentNavigation handleKeyDown on key press', () => {
      render(
        <TimeSlice
          defaultDateRange={{
            startDate: initialStartDate,
            endDate: initialEndDate
          }}
        >
          <Input data-testid="input-keydown" />
        </TimeSlice>
      )
      const inputEl = screen.getByTestId('input-keydown')
      fireEvent.focus(inputEl)
      fireEvent.keyDown(inputEl, { key: 'Enter', code: 'Enter' })
    })

    it('should render as child and forward props, maintaining functionality', () => {
      const handleDateRangeChange = vi.fn()
      render(
        <TimeSlice onDateRangeChange={handleDateRangeChange}>
          <Input asChild data-testid="custom-input-aschild">
            <textarea />
          </Input>
        </TimeSlice>
      )
      const textareaEl = screen.getByTestId('custom-input-aschild')
      expect(textareaEl.tagName).toBe('TEXTAREA')

      fireEvent.focus(textareaEl)
      expect(textareaEl).toHaveAttribute('aria-expanded', 'true')

      fireEvent.change(textareaEl, {
        target: { value: 'Jul 6, 2024, 1:00 PM – Jul 6, 2024, 3:00 PM' }
      })
      expect(handleDateRangeChange).toHaveBeenCalled()
      const newRange = handleDateRangeChange.mock.calls[0][0]
      expect(newRange.startDate).toEqual(new Date('Jul 6, 2024, 1:00 PM'))
      expect(newRange.endDate).toEqual(new Date('Jul 6, 2024, 3:00 PM'))
    })
  })

  describe('TimeSlicePortal', () => {
    it('should not render if open is false', () => {
      render(
        <TimeSlice open={false}>
          <Input />
          <Portal data-testid="portal-visibility-test">
            <div>Portal Content Here</div>
          </Portal>
        </TimeSlice>
      )
      expect(screen.getByTestId('portal-visibility-test')).toHaveStyle({
        display: 'none'
      })
    })

    it('should render if open is true', () => {
      render(
        <TimeSlice defaultOpen>
          {' '}
          {/* Or open={true} */}
          <Input />
          <Portal>
            <div>Portal Visible</div>
          </Portal>
        </TimeSlice>
      )
      expect(screen.getByText('Portal Visible')).toBeVisible()
    })

    it('Escape key should close portal and focus input', () => {
      render(
        <TimeSlice defaultOpen>
          <Input data-testid="portal-input-escape" />
          <Portal ariaLabel="Escape Test Portal">
            {/* Ensure there's a genuinely focusable child for the event target */}
            <button
              data-testid="focusable-child-in-portal"
              data-shortcut-item="true"
            >
              Focus Me
            </button>
            <div tabIndex={-1}>Some other content</div>
          </Portal>
        </TimeSlice>
      )
      const focusableChild = screen.getByTestId('focusable-child-in-portal')
      const inputEl = screen.getByTestId('portal-input-escape')

      focusableChild.focus()
      expect(document.activeElement).toBe(focusableChild)

      fireEvent.keyDown(focusableChild, { key: 'Escape', code: 'Escape' })

      expect(screen.getByTestId('focusable-child-in-portal')).not.toBeVisible()
      expect(document.activeElement).toBe(inputEl)
    })

    describe('Keyboard navigation within Portal', () => {
      const setupPortalWithItems = () => {
        const onItemClick = vi.fn()
        render(
          <TimeSlice defaultOpen>
            <Input data-testid="portal-input-nav" />
            <Portal ariaLabel="Test Portal Navigation">
              <button
                data-shortcut-item="true"
                onClick={onItemClick}
                data-testid="item1"
              >
                Item 1
              </button>
              <button
                data-shortcut-item="true"
                onClick={onItemClick}
                data-testid="item2"
              >
                Item 2
              </button>
              <button
                data-shortcut-item="true"
                onClick={onItemClick}
                data-testid="item3"
              >
                Item 3
              </button>
            </Portal>
          </TimeSlice>
        )
        return {
          item1: screen.getByTestId('item1'),
          item2: screen.getByTestId('item2'),
          item3: screen.getByTestId('item3'),
          portal: screen.getByRole('listbox', {
            name: 'Test Portal Navigation'
          }),
          input: screen.getByTestId('portal-input-nav'),
          onItemClick
        }
      }

      it('ArrowDown should navigate focus between items', () => {
        const { item1, item2, item3, portal } = setupPortalWithItems()
        item1.focus()
        expect(document.activeElement).toBe(item1)

        fireEvent.keyDown(portal, { key: 'ArrowDown' })
        expect(document.activeElement).toBe(item2)

        fireEvent.keyDown(portal, { key: 'ArrowDown' })
        expect(document.activeElement).toBe(item3)

        fireEvent.keyDown(portal, { key: 'ArrowDown' })
        expect(document.activeElement).toBe(item1)
      })

      it('ArrowUp should navigate focus between items', () => {
        const { item1, item2, item3, portal } = setupPortalWithItems()
        item1.focus()

        fireEvent.keyDown(portal, { key: 'ArrowUp' })
        expect(document.activeElement).toBe(item3)

        fireEvent.keyDown(portal, { key: 'ArrowUp' })
        expect(document.activeElement).toBe(item2)

        fireEvent.keyDown(portal, { key: 'ArrowUp' })
        expect(document.activeElement).toBe(item1)
      })

      it('Tab should navigate focus and then to input', () => {
        const { item1, item2, item3, portal, input } = setupPortalWithItems()
        item1.focus()

        fireEvent.keyDown(portal, { key: 'Tab' })
        expect(document.activeElement).toBe(item2)
        fireEvent.keyDown(portal, { key: 'Tab' })
        expect(document.activeElement).toBe(item3)
        fireEvent.keyDown(portal, { key: 'Tab' })
        expect(document.activeElement).toBe(input)
      })

      it('Shift+Tab should navigate focus in reverse and then to input', () => {
        const { item1, item2, item3, portal, input } = setupPortalWithItems()
        item3.focus()

        fireEvent.keyDown(portal, { key: 'Tab', shiftKey: true })
        expect(document.activeElement).toBe(item2)
        fireEvent.keyDown(portal, { key: 'Tab', shiftKey: true })
        expect(document.activeElement).toBe(item1)
        fireEvent.keyDown(portal, { key: 'Tab', shiftKey: true })
        expect(document.activeElement).toBe(input)
      })

      it('Enter key should click the focused item', () => {
        const { item2, portal, onItemClick } = setupPortalWithItems()
        item2.focus()
        fireEvent.keyDown(portal, { key: 'Enter', code: 'Enter' })
        expect(onItemClick).toHaveBeenCalledTimes(1)
      })
    })

    it('should render as child and forward props, maintaining functionality', () => {
      render(
        <TimeSlice defaultOpen>
          <Input />
          <Portal asChild data-testid="custom-portal-aschild">
            <section>Custom Portal Section</section>
          </Portal>
        </TimeSlice>
      )
      const portalSection = screen.getByTestId('custom-portal-aschild')
      expect(portalSection.tagName).toBe('SECTION')
      expect(screen.getByText('Custom Portal Section')).toBeVisible()
    })
  })

  describe('TimeSliceShortcut', () => {
    const mockSetDateRange = vi.fn()
    const mockSetIsRelative = vi.fn()
    const mockSetOpen = vi.fn()
    const mockInputBlur = vi.fn()

    const baseDate = new Date(2024, 0, 15, 12, 0, 0)

    beforeEach(() => {
      vi.useRealTimers()
      vi.useFakeTimers()
      vi.setSystemTime(baseDate)
      mockSetDateRange.mockClear()
      mockSetIsRelative.mockClear()
      mockSetOpen.mockClear()
      mockInputBlur.mockClear()
    })

    afterEach(() => {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    })

    const renderShortcutInsideProvider = (
      shortcutProps: React.ComponentProps<typeof Shortcut>,
      inputTestId = 'input-for-shortcut'
    ) => {
      const mockSetDateRange = vi.fn()
      const mockSetOpen = vi.fn()
      const mockInputBlur = vi.fn()

      const mockInputRef = { current: document.createElement('input') }
      mockInputRef.current.blur = mockInputBlur

      render(
        <TimeSlice
          defaultOpen
          onDateRangeChange={mockSetDateRange}
          onOpenChange={mockSetOpen}
        >
          {/* Pass the test ID to the Input component */}
          <Input data-testid={inputTestId} />
          <Portal>
            <Shortcut {...shortcutProps} />
          </Portal>
        </TimeSlice>
      )
      const inputElement = screen.getByTestId(inputTestId)
      inputElement.focus()
      return { inputElement, mockSetDateRange, mockSetOpen }
    }

    it('should render as a div by default', () => {
      const duration = { days: 7 }
      renderShortcutInsideProvider({ duration, children: 'Past 7 Days' })
      const shortcutElement = screen.getByText('Past 7 Days')
      expect(shortcutElement).toBeInTheDocument()
      expect(shortcutElement.tagName).toBe('DIV')
      expect(shortcutElement).toHaveAttribute('role', 'option')
    })

    it('clicking shortcut should set date range, close portal, blur input, and show relative format', () => {
      const duration = { days: 7 }
      const inputId = 'shortcut-input-1'
      const { inputElement, mockSetDateRange, mockSetOpen } =
        renderShortcutInsideProvider(
          {
            duration,
            children: 'Past 7 Days'
          },
          inputId
        )

      const shortcutElement = screen.getByText('Past 7 Days')
      expect(inputElement).toHaveFocus()
      fireEvent.click(shortcutElement)

      expect(mockSetDateRange).toHaveBeenCalledTimes(1)
      const expectedEndDate = baseDate
      const expectedStartDate = new Date(
        baseDate.getTime() - 7 * 24 * 60 * 60 * 1000
      )
      expect(mockSetDateRange.mock.calls[0][0].startDate).toEqual(
        expectedStartDate
      )
      expect(mockSetDateRange.mock.calls[0][0].endDate).toEqual(expectedEndDate)

      expect(mockSetOpen).toHaveBeenCalledWith(false)
      expect(inputElement).not.toHaveFocus()

      expect(inputElement).toHaveValue('Past 7 days')
    })

    it('should render as child, forward props, and maintain click functionality (relative format)', () => {
      const duration = { hours: 1 }
      const inputId = 'shortcut-input-aschild'
      const mockSetDateRange = vi.fn()
      const mockSetOpen = vi.fn()
      render(
        <TimeSlice
          defaultOpen
          onDateRangeChange={mockSetDateRange}
          onOpenChange={mockSetOpen}
        >
          <Input asChild data-testid={inputId}>
            <textarea />
          </Input>
          <Portal>
            <Shortcut duration={duration} asChild>
              <button data-testid="custom-shortcut">Past Hour Custom</button>
            </Shortcut>
          </Portal>
        </TimeSlice>
      )
      const textareaElement = screen.getByTestId(inputId)
      textareaElement.focus()

      const shortcutButton = screen.getByRole('option', {
        name: 'Past Hour Custom'
      })
      expect(shortcutButton).toBeInTheDocument()
      expect(shortcutButton).toHaveAttribute('data-testid', 'custom-shortcut')

      expect(textareaElement).toHaveFocus()
      fireEvent.click(shortcutButton)

      expect(mockSetDateRange).toHaveBeenCalledTimes(1)
      const expectedEndDate = baseDate
      const expectedStartDate = new Date(
        baseDate.getTime() - 1 * 60 * 60 * 1000
      )
      expect(mockSetDateRange.mock.calls[0][0].startDate).toEqual(
        expectedStartDate
      )
      expect(mockSetDateRange.mock.calls[0][0].endDate).toEqual(expectedEndDate)

      expect(mockSetOpen).toHaveBeenCalledWith(false)
      expect(textareaElement).not.toHaveFocus()

      expect(textareaElement).toHaveValue('Past 1 hour')
    })
  })
})
