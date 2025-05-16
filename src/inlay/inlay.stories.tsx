import type { Meta } from '@storybook/react'

import * as Inlay from './inlay'
import { createInlay } from './inlay'
import * as React from 'react'
import type { OnInputContext } from './inlay.types'

/**
 * Inlay is a composable input for structured text, allowing for component-driven tokens
 * and rich interactive experiences.
 *
 * ## Features
 *
 * - 🧩 **Component-driven tokens** - Create custom UI elements for your tokens
 * - 🔄 **Custom parsing** - Transform text input into structured data
 * - 💻 **Native-like UX** - Provides a familiar editing experience
 * - ⌨️ **Keyboard navigation** - Navigate between tokens with arrow keys
 *
 * ## Parameters
 *
 * | Name | Type | Description |
 * |------|------|-------------|
 * | `parse` | `(value: string) => T` | Function to transform text input into tokens |
 * | `onChange` | `(value: T[]) => void` | Called when tokens change |
 * | `onTokenChange` | `(index: number, value: T) => void` | Called when a specific token changes |
 * | `value` | `T[]` | Controlled value array |
 * | `commitOnChars` | `string[]` | Characters that trigger token creation |
 * | `addNewTokenOnCommit` | `boolean` | Whether to create a new token on commit |
 *
 * ## Usage
 *
 * ```tsx
 * <Inlay.Root
 *   parse={(value) => value}
 *   onChange={(tokens) => setTokens(tokens)}
 *   commitOnChars={[' ', 'Enter']}
 * >
 *   {tokens.map((token, index) => (
 *     <Inlay.Token key={index} index={index}>
 *       <Inlay.EditableText value={token} index={index} />
 *     </Inlay.Token>
 *   ))}
 * </Inlay.Root>
 * ```
 *
 * ## Use Cases
 *
 * - Mentions in chat/comment systems
 * - Search filters and query builders
 * - AI prompt builders
 * - Tag inputs
 */
const meta: Meta<typeof Inlay.Root> = {
  component: Inlay.Root,
  title: 'Components/Inlay',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A composable input for structured text'
      }
    }
  }
}

export default meta

/**
 * Basic example of the Inlay component showing tokenization of text input.
 * Type text and press space or Enter to create tokens.
 */
export const Basic = () => {
  const [value, setValue] = React.useState<string[]>([])
  const [activeTokenIndex, setActiveTokenIndex] = React.useState<number | null>(
    null
  )
  return (
    <>
      <Inlay.Root
        data-testid="inlay__root"
        parse={(value) => {
          return value
        }}
        onChange={(value) => {
          console.log('onChange', value)
          setValue(value)
        }}
        onTokenChange={(index, value) => {
          console.log('onTokenChange', index, value)
        }}
        onFocus={(index) => {
          setActiveTokenIndex(index)
        }}
        style={{
          border: '1px solid black',
          display: 'flex',
          outline: 'none'
        }}
        onInput={(context) => {
          console.log('onInput', context)
        }}
        commitOnChars={[' ', 'Enter']}
        displayCommitCharSpacer
        addNewTokenOnCommit
        insertSpacerOnCommit
      >
        {value.map((token, index) => (
          <Inlay.Token key={index} index={index} editable>
            <Inlay.EditableText value={token} index={index} />
          </Inlay.Token>
        ))}
      </Inlay.Root>

      <pre>
        {JSON.stringify(
          {
            value,
            activeToken:
              activeTokenIndex !== null ? value[activeTokenIndex] : undefined
          },
          null,
          2
        )}
      </pre>
    </>
  )
}

// Define a proper Mention type for our Twitter-like UI
type Mention = {
  username: string
  display: string
}

type TweetToken = Mention | string

// Twitter-like mention Inlay component
const TweetInlay = createInlay<TweetToken>()

// Mock Twitter users for autocomplete
const TWITTER_USERS = [
  {
    username: 'elonmusk',
    name: 'Elon Musk',
    verified: true,
    followers: '128.3M'
  },
  {
    username: 'BarackObama',
    name: 'Barack Obama',
    verified: true,
    followers: '132.9M'
  },
  { username: 'NASA', name: 'NASA', verified: true, followers: '71.6M' },
  {
    username: 'BillGates',
    name: 'Bill Gates',
    verified: true,
    followers: '62.9M'
  },
  {
    username: 'taylorswift13',
    name: 'Taylor Swift',
    verified: true,
    followers: '94.5M'
  },
  {
    username: 'KimKardashian',
    name: 'Kim Kardashian',
    verified: true,
    followers: '74.5M'
  },
  { username: 'rihanna', name: 'Rihanna', verified: true, followers: '100.7M' },
  {
    username: 'Cristiano',
    name: 'Cristiano Ronaldo',
    verified: true,
    followers: '108.3M'
  },
  {
    username: 'neiltyson',
    name: 'Neil deGrasse Tyson',
    verified: true,
    followers: '14.1M'
  },
  {
    username: 'JKRowling',
    name: 'J.K. Rowling',
    verified: true,
    followers: '14.2M'
  }
]

/**
 * Twitter-like tweet composer with mention autocomplete.
 *
 * Features:
 * - Type '@' to trigger mention suggestions
 * - Use keyboard up/down to navigate suggestions
 * - Press Enter or Tab to select a mention
 * - Escape to dismiss suggestions
 * - Rich Twitter-like styling
 */
export const TwitterMentions = () => {
  const [tokens, setTokens] = React.useState<TweetToken[]>([])
  const [activeTokenIndex, setActiveTokenIndex] = React.useState<number | null>(
    null
  )
  const [caret, setCaret] = React.useState<{
    index: number
    offset: number
  } | null>(null)
  const [showMentions, setShowMentions] = React.useState(false)
  const [mentionFilter, setMentionFilter] = React.useState('')
  const [selectedMentionIndex, setSelectedMentionIndex] = React.useState(0)
  const [caretPosition, setCaretPosition] = React.useState<{
    top: number
    left: number
  } | null>(null)
  const tweetContainerRef = React.useRef<HTMLDivElement>(null)
  const tokenHandleRef = React.useRef<OnInputContext<TweetToken>['token']>(null)
  const actionsRef = React.useRef<OnInputContext<TweetToken>['actions']>(null)

  // Filter users based on mention text
  const filteredUsers = React.useMemo(() => {
    if (!mentionFilter) return TWITTER_USERS
    const filter = mentionFilter.toLowerCase()
    return TWITTER_USERS.filter(
      (user) =>
        user.username.toLowerCase().startsWith(filter) ||
        user.name.toLowerCase().startsWith(filter)
    ).slice(0, 5) // Limit to 5 results like Twitter
  }, [mentionFilter])

  // Parse function for converting mentioned text to mention objects
  const parseInput = React.useCallback((text: string): TweetToken => {
    const mentionRegex = /^@([a-zA-Z0-9_]{1,15})$/
    const match = text.match(mentionRegex)

    if (match && match[1]) {
      // Valid username format, return a mention token
      return {
        username: match[1],
        display: text
      }
    }

    // Not a mention, return as regular text
    return text
  }, [])

  // Calculate caret position for popover
  const updateCaretPosition = React.useCallback(() => {
    if (tweetContainerRef.current) {
      setTimeout(() => {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          const containerRect =
            tweetContainerRef.current?.getBoundingClientRect()
          if (containerRect) {
            setCaretPosition({
              top: rect.bottom - containerRect.top,
              left: rect.left - containerRect.left
            })
          }
        }
      }, 0)
    }
  }, [])

  // Handle mention selection - now much simpler
  const selectMention = React.useCallback((username: string) => {
    // Just replace the token with the mention
    if (tokenHandleRef.current) {
      // Create the mention string
      const mentionText = `@${username}`

      // Simply update the token text
      tokenHandleRef.current.update(mentionText)
      tokenHandleRef.current.commit({
        valueForNewToken: '',
        spacerChar: ' '
      })
    }

    setTimeout(() => {
      setShowMentions(false)
      setMentionFilter('')
    }, 0)
  }, [])

  // Handle input for mentions - now much simpler
  const handleInput = React.useCallback(
    (context: OnInputContext<TweetToken>) => {
      const { token, key, actions } = context

      if (!token) return

      // Handle special cases for mention tokens
      if (typeof token.value === 'object') {
        // These are characters that break the mention regex pattern
        // Only alphanumeric and underscore are valid in mentions
        const invalidMentionChars = /[^a-zA-Z0-9_]/

        // If typing a character that would break the mention pattern
        if (key && key.length === 1 && invalidMentionChars.test(key)) {
          // Commit the current mention and create a new token with the typed character
          token.commit({
            valueForNewToken: key === ' ' ? '' : key,
            spacerChar: key === ' ' ? key : null
          })

          setTimeout(() => {
            setShowMentions(false)
          }, 0)
          actions.preventDefault()
          return
        }
      }

      // Store token handle and actions for mention selection
      tokenHandleRef.current = token
      actionsRef.current = actions

      // Handle keyboard navigation in mention suggestions
      if (showMentions && filteredUsers.length > 0) {
        if (key === 'ArrowDown') {
          actions.preventDefault()
          setSelectedMentionIndex((prev) =>
            prev < filteredUsers.length - 1 ? prev + 1 : prev
          )
        } else if (key === 'ArrowUp') {
          actions.preventDefault()
          setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0))
        } else if (key === 'Enter' || key === 'Tab') {
          actions.preventDefault()
          if (filteredUsers[selectedMentionIndex]) {
            selectMention(filteredUsers[selectedMentionIndex].username)
          }
        } else if (key === 'Escape') {
          actions.preventDefault()
          setShowMentions(false)
        } else if (key === ' ') {
          // Space should close the mentions dropdown
          setShowMentions(false)
        }
      }
    },
    [showMentions, filteredUsers, selectedMentionIndex, selectMention]
  )

  React.useEffect(() => {
    if (activeTokenIndex === null) return

    const token = tokens[activeTokenIndex]
    if (!token) return
    if (typeof token === 'string') {
      setShowMentions(false)
      return
    }
    if (caret?.index !== activeTokenIndex) return
    if (caret?.offset !== token.username.length + 1) {
      setShowMentions(false)
      return
    }

    setMentionFilter(token.username)
    setShowMentions(true)
    updateCaretPosition()
  }, [tokens, activeTokenIndex, caret])

  // When clicking outside the mention popover, close it
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showMentions &&
        !tweetContainerRef.current?.contains(e.target as Node)
      ) {
        setShowMentions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMentions])

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto">
      <div className="border border-gray-200 rounded-2xl p-4 bg-white">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex-shrink-0"></div>

          <div className="flex-grow" ref={tweetContainerRef}>
            <div
              className="min-h-[120px] w-full text-xl text-gray-900 outline-none"
              style={{ position: 'relative' }}
            >
              <TweetInlay.Root
                parse={parseInput}
                onChange={setTokens}
                onFocus={setActiveTokenIndex}
                onInput={handleInput}
                value={tokens}
                commitOnChars={[' ']} // We handle commits manually for mentions
                className="w-full outline-none overflow"
                caret={caret}
                onCaretChange={setCaret}
                multiline
              >
                {tokens.map((token, index) => (
                  <TweetInlay.Token key={index} index={index} editable>
                    {typeof token === 'string' ? (
                      <TweetInlay.EditableText value={token} index={index} />
                    ) : (
                      <span className="text-blue-500 font-medium">
                        <TweetInlay.EditableText
                          value={token.display}
                          index={index}
                        />
                      </span>
                    )}
                  </TweetInlay.Token>
                ))}
              </TweetInlay.Root>

              {/* Mention autocomplete popover */}
              {showMentions && caretPosition && filteredUsers.length > 0 && (
                <div
                  className="absolute z-10 bg-white shadow-lg rounded-lg border border-gray-200 w-80 max-h-80 overflow-auto"
                  style={{
                    top: `${caretPosition.top + 10}px`,
                    left: `${caretPosition.left}px`
                  }}
                >
                  <div className="py-1">
                    {filteredUsers.map((user, idx) => (
                      <div
                        key={user.username}
                        className={`flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer ${
                          idx === selectedMentionIndex ? 'bg-gray-100' : ''
                        }`}
                        onClick={() => selectMention(user.username)}
                        onMouseEnter={() => setSelectedMentionIndex(idx)}
                      >
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex-shrink-0 mr-3"></div>
                        <div className="flex flex-col">
                          <div className="flex items-center">
                            <span className="font-bold">{user.name}</span>
                            {user.verified && (
                              <svg
                                className="h-4 w-4 ml-1 text-blue-500"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                              </svg>
                            )}
                          </div>
                          <div className="text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 border-t border-gray-200 pt-4">
              <div className="flex items-center space-x-4 text-blue-500">
                <button className="rounded-full hover:bg-blue-50 p-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 1.75C6.34 1.75 1.75 6.34 1.75 12S6.34 22.25 12 22.25 22.25 17.66 22.25 12 17.66 1.75 12 1.75zm-.25 10.48L10.5 17.5l-2-1.5v-3.5L7.5 9 10.5 7l1.25 5.23zm1.5 1.52L9 16.5l2.5 1.5 2.5-1.5-3.5-1.5V9L14 7.5 15.5 9v3.5z" />
                  </svg>
                </button>
                <button className="rounded-full hover:bg-blue-50 p-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM19 15.414l-3-3-5 5-3-3-3 3V18.5c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-3.086zM9.75 7C8.784 7 8 7.784 8 8.75s.784 1.75 1.75 1.75 1.75-.784 1.75-1.75S10.716 7 9.75 7z" />
                  </svg>
                </button>
                <button className="rounded-full hover:bg-blue-50 p-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 9.5C8 8.119 8.672 7 9.5 7S11 8.119 11 9.5 10.328 12 9.5 12 8 10.881 8 9.5zm6.5 2.5c.828 0 1.5-1.119 1.5-2.5S15.328 7 14.5 7 13 8.119 13 9.5s.672 2.5 1.5 2.5zM12 16c-2.224 0-3.021-2.227-3.051-2.316l-1.897.633c.05.15 1.271 3.684 4.949 3.684s4.898-3.533 4.949-3.684l-1.896-.638c-.033.095-.83 2.322-3.053 2.322zm10.25-4.001c0 5.652-4.598 10.25-10.25 10.25S1.75 17.652 1.75 12 6.348 1.75 12 1.75 22.25 6.348 22.25 12zm-2 0c0-4.549-3.701-8.25-8.25-8.25S3.75 7.451 3.75 12s3.701 8.25 8.25 8.25 8.25-3.701 8.25-8.25z" />
                  </svg>
                </button>
              </div>

              <button
                className={`rounded-full px-5 py-2 bg-blue-500 text-white font-bold ${
                  tokens.length === 0
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-blue-600'
                }`}
                disabled={tokens.length === 0}
              >
                Tweet
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-1">Features:</h3>
        <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
          <li>
            Type <span className="font-mono bg-gray-200 px-1">@</span> to
            trigger mention suggestions
          </li>
          <li>Use keyboard up/down to navigate suggestions</li>
          <li>Press Enter or Tab to select a mention</li>
          <li>Escape or click outside to dismiss suggestions</li>
          <li>Mentions are displayed in Twitter blue</li>
          <li>Handles mention tracking within text properly</li>
        </ul>
      </div>

      <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
        {JSON.stringify(
          {
            tokens,
            activeTokenIndex,
            activeToken: tokenHandleRef.current?.text,
            mentionFilter,
            showMentions,
            caret
          },
          null,
          2
        )}
      </pre>
    </div>
  )
}
