'use client'

import type { ComponentProps } from 'react'
import ChessView from './ChessView'

export default function Chess3DView(props: ComponentProps<typeof ChessView>) {
  return <ChessView {...props} variant="3d" />
}
