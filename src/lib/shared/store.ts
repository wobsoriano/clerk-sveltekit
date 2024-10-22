import type { InitialState } from '@clerk/types'
import { writable } from 'svelte/store'

export const sharedAuth = writable<InitialState>(undefined)
