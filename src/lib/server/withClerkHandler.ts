import { type Handle } from '@sveltejs/kit'
import { clerkClient } from './clerkClient.js'
import * as constants from './constants.js'
import {
	AuthStatus,
	type AuthObject,
	makeAuthObjectSerializable,
	stripPrivateDataFromObject,
	createClerkRequest,
	type AuthenticateRequestOptions,
} from '@clerk/backend/internal'

export type ClerkSvelteKitMiddlewareOptions = AuthenticateRequestOptions & { debug?: boolean }

export default function withClerkHandler(middlewareOptions?: ClerkSvelteKitMiddlewareOptions) {
	return (async ({ event, resolve }) => {
		const { debug = false, ...options } = middlewareOptions ?? {}

		const clerkWebRequest = createClerkRequest(event.request)
		if (debug) {
			console.log('[Clerk SvelteKit] ' + JSON.stringify(clerkWebRequest.toJSON()))
		}

		const requestState = await clerkClient.authenticateRequest(clerkWebRequest, {
			...options,
			secretKey: options?.secretKey ?? constants.SECRET_KEY,
			publishableKey: options?.publishableKey ?? constants.PUBLISHABLE_KEY,
		})

		const locationHeader = requestState.headers.get(constants.Headers.Location)
		if (locationHeader) {
			if (debug) {
				console.log('[Clerk SvelteKit] Handshake redirect triggered')
			}
			return new Response(null, { status: 307, headers: requestState.headers })
		}

		if (requestState.status === AuthStatus.Handshake) {
			throw new Error('[Clerk SvelteKit] Handshake status without redirect')
		}

		const authObject = requestState.toAuth()
		event.locals.auth = authObject
		if (debug) {
			console.log('[Clerk SvelteKit] ' + JSON.stringify(authObject))
		}

		if (requestState.headers) {
			event.setHeaders(Object.fromEntries(requestState.headers))
		}

		return resolve(event, {
			transformPageChunk({ html }) {
				return attachAuthObjectToHTML(html, authObject)
			},
		})
	}) satisfies Handle
}

/**
 * Attaches the auth object to the HTML string for hydration.
 */
function attachAuthObjectToHTML(html: string, authObject: AuthObject) {
	const initialState = makeAuthObjectSerializable(stripPrivateDataFromObject(authObject))

	const script = `
    <script>
      window.__CLERK_SK_AUTH__ = ${JSON.stringify(initialState)};
    </script>
  `

	const headClosingTag = '</head>'
	const indexOfHeadClosingTag = html.indexOf(headClosingTag)

	if (indexOfHeadClosingTag === -1) {
		throw new Error('No </head> tag found in the HTML string')
	}

	return html.slice(0, indexOfHeadClosingTag) + script + html.slice(indexOfHeadClosingTag)
}
