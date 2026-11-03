import { defineShikiSetup } from '@slidev/types'

export default defineShikiSetup(() => {
  return {
    // Extra grammars beyond Slidev defaults; tahta owns the color themes.
    langs: ['ts', 'rust', 'fsharp', 'gleam'],
  }
})
