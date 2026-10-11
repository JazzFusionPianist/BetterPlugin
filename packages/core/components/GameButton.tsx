'use client'

import {Children, cloneElement, forwardRef, isValidElement, type ButtonHTMLAttributes, type ReactNode} from 'react'

/** Sentence case the label without changing names, acronyms, numbers, or icons. */
export function gameButtonLabel(children:ReactNode):ReactNode {
  let found = false
  const visit = (nodes:ReactNode):ReactNode => Children.map(nodes, node => {
    if (found) return node
    if (typeof node === 'number') { found = true; return node }
    if (typeof node === 'string' && node.trim()) {
      found = true
      return node.replace(/^(\s*)(\p{Ll})/u, (_,space,letter) => space + letter.toUpperCase())
    }
    if (isValidElement<{children?:ReactNode}>(node) && node.props.children != null) {
      return cloneElement(node, {children:visit(node.props.children)})
    }
    return node
  })
  return visit(children)
}

export const GameButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {preserveCase?:boolean}>(
  function GameButton({children,style,preserveCase=false,...props},ref) {
    return <button {...props} style={{...style,textTransform:'none'}} ref={ref}>{preserveCase ? children : gameButtonLabel(children)}</button>
  },
)
