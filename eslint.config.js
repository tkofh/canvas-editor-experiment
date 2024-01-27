import antfu from '@antfu/eslint-config'
import prettier from 'eslint-config-prettier'

export default [
  // eslint-disable-next-line ts/no-unsafe-assignment
  ...(await antfu({
    typescript: {
      tsconfigPath: './tsconfig.json',
    },
    stylistic: false,
  })),
  prettier,
  {
    rules: {
      'no-console': 'off',
    },
  },
]
