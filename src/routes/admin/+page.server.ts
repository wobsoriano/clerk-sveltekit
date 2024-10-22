import type { PageServerLoad } from './$types.js'
import { sharedAuth } from '$lib/shared/store.js'
import { get } from 'svelte/store'

export const load = (() => {
	return {
		secret: `Hello ${get(sharedAuth).userId}! Here is a random number from the server: ${Math.random()}`,
	}
}) satisfies PageServerLoad
