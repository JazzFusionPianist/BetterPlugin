'use client'
import type { ComponentProps } from 'react'
import { useResolvedUrl } from '@/lib/fileAccess'
export function SecureImage({src,...props}:ComponentProps<'img'>){const url=useResolvedUrl(typeof src==='string'?src:'');return <img {...props} src={url||undefined}/>}
export function SecureVideo({src,...props}:ComponentProps<'video'>){const url=useResolvedUrl(typeof src==='string'?src:'');return <video {...props} src={url||undefined}/>}
export function SecureAudio({src,...props}:ComponentProps<'audio'>){const url=useResolvedUrl(typeof src==='string'?src:'');return <audio {...props} src={url||undefined}/>}
export function SecureLink({href,...props}:ComponentProps<'a'>){const url=useResolvedUrl(href??'');return <a {...props} href={url||undefined} referrerPolicy="no-referrer"/>}
