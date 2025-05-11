import type { Preview, Parameters } from '@storybook/react'
import './tailwind.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
}

export const parameters: Parameters = {
  storyFilter: (story) => story.name.startsWith('Test')
}

export default preview
