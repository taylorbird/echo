// gomuks - A Matrix client written in Go.
// Copyright (C) 2026 Tulir Asokan
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import React, { useCallback, useEffect, useRef, useState } from "react"
import type Client from "@/api/client.ts"
import type {
	ClientState,
	OAuthClientMetadataRequest,
	OAuthDeviceCodeResponse,
	OAuthServerMetadata,
} from "@/api/types"
import { HairlineWait } from "../loading"
import BeeperLogin from "./BeeperLogin.tsx"
import CheckIcon from "@/icons/check.svg?react"
import CopyIcon from "@/icons/copy.svg?react"
import "./LoginScreen.css"

export interface LoginScreenProps {
	client: Client
	clientState: ClientState
}

const signInCancelled = "Sign-in cancelled"

const beeperServerRegex = /^https:\/\/matrix\.(beeper(?:-dev|-staging)?\.com)$/

const generateDeviceID = () => {
	let deviceID = Math.random().toString(36).slice(2, 12).toUpperCase()
	if (deviceID.length < 10) {
		deviceID += Math.random().toString(36).slice(2, 12 - deviceID.length).toUpperCase()
	}
	return deviceID
}

// What the homeserver's consent page shows when asking whether to let this app in.
// No logo_uri: echo's mark is not hosted at a public URL, and pointing at gomuks'
// logo would show the wrong app.
const echoClientName = "echo"
const echoClientURI = "https://github.com/taylorbird/echo"

const standardClientRegistrationParams: OAuthClientMetadataRequest = {
	application_type: "native",
	client_name: echoClientName,
	client_uri: echoClientURI,
	grant_types: ["refresh_token", "urn:ietf:params:oauth:grant-type:device_code"],
	token_endpoint_auth_method: "none",
}

const clientURI = window.location.origin + window.location.pathname
const isLocalhost = window.location.hostname === "localhost"
// Both echo origins are plain-HTTP loopback: the Vite dev server (http://localhost:6173)
// and the sidecar the packaged window loads (http://localhost:29325). The client is
// registered with a port-less http://localhost redirect, which OAuth servers match
// against any loopback port for native apps (RFC 8252 section 7.3), so one registration
// covers both. Device code login is still preferred whenever the server offers it.
const isSupportedRedirectURI = window.location.protocol === "https:" || isLocalhost

const redirectClientRegistrationParams: OAuthClientMetadataRequest = {
	application_type: "native",
	client_name: echoClientName,
	client_uri: isLocalhost ? echoClientURI : clientURI,
	logo_uri: isLocalhost ? undefined : (clientURI + "gomuks.png"),
	grant_types: ["refresh_token", "authorization_code", "urn:ietf:params:oauth:grant-type:device_code"],
	token_endpoint_auth_method: "none",
	response_types: ["code"],
	redirect_uris: [isLocalhost ? "http://localhost" + window.location.pathname : clientURI],
}

export const LoginScreen = ({ client }: LoginScreenProps) => {
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [homeserverURL, setHomeserverURL] = useState("")
	const [loginFlows, setLoginFlows] = useState<string[] | null>(null)
	const [oauthServerMeta, setOAuthServerMeta] = useState<OAuthServerMetadata | null>(null)
	const [deviceCode, setDeviceCode] = useState<OAuthDeviceCodeResponse | null>(null)
	const [copySuccess, setCopySuccess] = useState(false)
	const cancelDeviceCodePoll = useRef<(() => void) | null>(null)
	const skipServerResolution = useRef(false)
	const [loading, setLoading] = useState<boolean>(false)
	const [error, setError] = useState("")

	const loginSSOAsync = async () => {
		const clientMeta = await client.rpc.oauthRegisterClient(homeserverURL, standardClientRegistrationParams)
		const deviceID = generateDeviceID()
		const resp = await client.rpc.oauthGenerateDeviceCode({
			homeserver_url: homeserverURL,
			scopes: ["urn:matrix:client:api:*", `urn:matrix:client:device:${deviceID}`],
			user_id_hint: username,
			client_id: clientMeta.client_id,
		})
		setDeviceCode(resp)
		localStorage.pendingDeviceCodeLogin = JSON.stringify({
			homeserver_url: homeserverURL,
			username: username,
			client_id: clientMeta.client_id,
			code_resp: resp,
			login_flows: loginFlows,
			server_metadata: oauthServerMeta,
		})
		await loginSSOPollDeviceCode(homeserverURL, clientMeta.client_id, resp.device_code, resp.interval || 5)
	}
	const loginSSORedirect = async () => {
		const clientMeta = await client.rpc.oauthRegisterClient(homeserverURL, redirectClientRegistrationParams)
		const deviceID = generateDeviceID()
		const resp = await client.rpc.oauthGetAuthorizationURL({
			homeserver_url: homeserverURL,
			scopes: ["urn:matrix:client:api:*", `urn:matrix:client:device:${deviceID}`],
			user_id_hint: username,
			client_id: clientMeta.client_id,
			redirect_uri: clientURI,
			response_mode: "fragment",
		})
		localStorage.pendingAuthorizationCodeLogin = JSON.stringify({
			state: resp.state,
			code_verifier: resp.code_verifier,
			redirect_uri: clientURI,
			homeserver_url: homeserverURL,
			client_id: clientMeta.client_id,
		})
		if (window.gomuksWebWasm) {
			client.rpc.stop()
		}
		window.location.href = resp.url
	}
	const loginSSOPollDeviceCode = useCallback((
		homeserverURL: string, clientID: string, code: string, interval: number,
	) => new Promise<void>((resolve, reject) => {
		let cancelled = false
		let pollTimeout: ReturnType<typeof setTimeout>
		const cancel = () => {
			cancelled = true
			clearTimeout(pollTimeout)
			delete localStorage.pendingDeviceCodeLogin
			reject(new Error(signInCancelled))
		}
		const pollFunc = () => client.rpc.oauthPollDeviceCode(homeserverURL, code, clientID).then(() => {
			console.log("OAuth device code login successful")
			if (!cancelled) {
				resolve()
			}
		}, err => {
			if (cancelled) {
				return
			}
			const errStr = err.toString()
			if (errStr.includes("authorization_pending")) {
				pollTimeout = setTimeout(pollFunc, interval*1000)
			} else if (errStr.includes("slow_down")) {
				interval += 5
				console.log(`Increasing polling interval to ${interval} seconds due to ${err}`)
				pollTimeout = setTimeout(pollFunc, interval*1000)
			} else {
				reject(err)
				cancel()
			}
		})
		pollTimeout = setTimeout(pollFunc, 0)
		cancelDeviceCodePoll.current?.()
		cancelDeviceCodePoll.current = cancel
	}), [client])

	const loginAnySSOAsync = () => {
		if (supportsCodeSSO) {
			return loginSSOAsync()
		} else if (supportsRedirectSSO) {
			return loginSSORedirect()
		} else {
			return Promise.reject(new Error("No supported sign-in method"))
		}
	}

	const loginSSO = () => {
		setLoading(true)
		setError("")
		loginAnySSOAsync()
			.catch(err => {
				// Cancelling is the user's own choice, not something to report back to them.
				if (!(err instanceof Error && err.message === signInCancelled)) {
					setError(err.toString())
				}
			})
			.finally(() => {
				setLoading(false)
				setDeviceCode(null)
			})
	}

	const login = (evt: React.SubmitEvent) => {
		evt.preventDefault()
		if (!loginFlows) {
			// do nothing
		} else if (!loginFlows.includes("m.login.password")) {
			loginSSO()
		} else {
			setLoading(true)
			client.rpc.login(homeserverURL, username, password).then(
				() => {
					client.passwordCache = password
				},
				err => setError(err.toString()),
			).finally(() => setLoading(false))
		}
	}

	const resolveLoginFlows = useCallback((serverURL: string) => {
		client.rpc.getLoginFlows(serverURL).then(
			resp => {
				setLoginFlows(resp.flows?.map(flow => flow.type) ?? [])
				setOAuthServerMeta(resp.oauth ?? null)
				setError("")
			},
			err => setError(`Failed to get login flows: ${err}`),
		)
	}, [client])
	const resolveHomeserver = useCallback(() => {
		client.rpc.discoverHomeserver(username).then(
			resp => {
				const url = resp["m.homeserver"].base_url
				setLoginFlows(null)
				setOAuthServerMeta(null)
				setHomeserverURL(url)
				resolveLoginFlows(url)
			},
			err => setError(`Failed to resolve homeserver: ${err}`),
		)
	}, [client, username, resolveLoginFlows])

	useEffect(() => {
		if (localStorage.pendingDeviceCodeLogin) {
			// A device code sign-in was still waiting when the app last closed. Pick it
			// back up rather than making the user start over with a new code.
			const data = JSON.parse(localStorage.pendingDeviceCodeLogin)
			skipServerResolution.current = true
			setDeviceCode(data.code_resp)
			setLoginFlows(data.login_flows)
			setOAuthServerMeta(data.server_metadata)
			setHomeserverURL(data.homeserver_url)
			setUsername(data.username)
			setLoading(true)
			loginSSOPollDeviceCode(
				data.homeserver_url, data.client_id, data.code_resp.device_code, data.code_resp.interval || 5,
			).catch(err => {
				if (!(err instanceof Error && err.message === signInCancelled)) {
					setError(err.toString())
				}
			}).finally(() => {
				skipServerResolution.current = false
				setLoading(false)
				setDeviceCode(null)
			})
		} else if (localStorage.pendingAuthorizationCodeLogin && window.location.hash) {
			const cache = JSON.parse(localStorage.pendingAuthorizationCodeLogin)
			const params = new URLSearchParams(window.location.hash.slice(1))
			const code = params.get("code")
			if (params.get("state") === cache.state && code) {
				setLoading(true)
				client.rpc.oauthExchangeToken({ ...cache, code }).then(
					() => {
						console.log("OAuth authorization code login successful")
						delete localStorage.pendingAuthorizationCodeLogin
						const newURL = new URL(window.location.href)
						newURL.hash = ""
						history.replaceState({}, "", newURL.toString())
					},
					err => {
						console.error("OAuth authorization code login failed", err)
						setError(err.toString())
					},
				).finally(() => setLoading(false))
			}
		}
	}, [loginSSOPollDeviceCode, client])
	useEffect(() => {
		if (
			!username.startsWith("@")
			|| !username.includes(":")
			|| !username.includes(".")
			|| skipServerResolution.current
		) {
			return
		}
		const timeout = setTimeout(resolveHomeserver, 500)
		return () => {
			clearTimeout(timeout)
		}
	}, [username, resolveHomeserver])
	useEffect(() => {
		if (loginFlows !== null || loginFlows === "resolving" || !homeserverURL) {
			return
		}
		const timeout = setTimeout(() => resolveLoginFlows(homeserverURL), 500)
		return () => {
			clearTimeout(timeout)
		}
	}, [homeserverURL, loginFlows, resolveLoginFlows])
	const onChangeHomeserverURL = (evt: React.ChangeEvent<HTMLInputElement>) => {
		setLoginFlows(null)
		setHomeserverURL(evt.target.value)
	}
	const copyToClipboard = (evt: React.MouseEvent<HTMLButtonElement>) => {
		evt.stopPropagation()
		evt.preventDefault()
		const code = evt.currentTarget.getAttribute("data-code")
		navigator.clipboard.writeText(code!).then(
			() => {
				setCopySuccess(true)
				setTimeout(() => setCopySuccess(false), 2000)
			},
			err => console.error("Failed to copy to clipboard", err),
		)
	}

	const supportsPassword = loginFlows?.includes("m.login.password")
	const beeperDomain = homeserverURL.match(beeperServerRegex)?.[1]
	const supportsCodeSSO = !!oauthServerMeta?.device_authorization_endpoint
	const supportsRedirectSSO = !!oauthServerMeta?.authorization_endpoint
		// Redirects are a pain on wrapped apps, so don't allow it there
		&& !window.gomuksDesktop && !window.gomuksAndroid && isSupportedRedirectURI
	const supportsAnySSO = supportsCodeSSO || supportsRedirectSSO
	const noSupportedMethods = loginFlows !== null && !supportsAnySSO && !supportsPassword && !beeperDomain
	// Attached under the password field when there is one, so the message sits with the
	// input it is about. With OAuth-only servers there is no such field, so it falls to the
	// end of the form instead of having nowhere to go.
	const errorBlock = error
		? <div className="signin-field-error">
			<span className="signin-glyph" />
			{error}
		</div>
		: null

	if (deviceCode) {
		// The sign-in page that opens can take the code pre-filled when the server
		// offers a complete URI. The code stays on screen either way: it is what the
		// user compares to confirm the page belongs to this sign-in.
		const openURL = deviceCode.verification_uri_complete ?? deviceCode.verification_uri
		return <main className="matrix-login signin-column">
			<div className="signin-head">
				<h1 className="signin-title">Finish signing in</h1>
				<p className="signin-body">
					{deviceCode.verification_uri_complete
						? "Your homeserver will ask you to approve echo in your browser. Check that it shows this code."
						: "Open the sign-in page in your browser and enter this code."}
				</p>
			</div>
			<div className="signin-device-code">
				<span className="signin-label">Your code</span>
				<div className="signin-code-row">
					<code className="signin-code" aria-label="Sign-in code">{deviceCode.user_code}</code>
					<button
						type="button"
						className="signin-copy"
						onClick={copyToClipboard}
						data-code={deviceCode.user_code}
						title={copySuccess ? "Copied" : "Copy code"}
						aria-label={copySuccess ? "Copied" : "Copy code"}
					>
						{copySuccess ? <CheckIcon /> : <CopyIcon />}
					</button>
				</div>
			</div>
			<div className="signin-buttons">
				<a
					className="signin-primary signin-link-button"
					href={openURL}
					target="_blank"
					rel="noreferrer noopener"
				>Open sign-in page</a>
				<button
					type="button"
					className="signin-ghost"
					onClick={() => cancelDeviceCodePoll.current?.()}
				>Cancel</button>
			</div>
			<p className="signin-disclose">
				If the page does not open, go to
				{" "}<a href={deviceCode.verification_uri} target="_blank" rel="noreferrer noopener">
					{deviceCode.verification_uri}
				</a>{" "}
				and enter the code there.
			</p>
			<HairlineWait compact label="Waiting for you to approve the sign-in" />
		</main>
	}

	return <main className="matrix-login signin-column">
		<div className="signin-head">
			<h1 className="signin-title">Sign in to Matrix</h1>
			<p className="signin-body">
				echo works with any Matrix account. Your homeserver fills in from your user ID.
			</p>
		</div>
		<form className="signin-fields" onSubmit={login}>
			<div>
				<label className="signin-label" htmlFor="mxlogin-username">Matrix ID</label>
				<input
					type="text"
					id="mxlogin-username"
					placeholder="@you:example.com"
					value={username}
					onChange={evt => setUsername(evt.target.value)}
					disabled={loading}
					autoComplete="username"
					autoFocus
				/>
			</div>
			<div>
				<div className="signin-label-row">
					<label className="signin-label" htmlFor="mxlogin-homeserver-url">Homeserver</label>
					{loginFlows && <span className="signin-resolved">found</span>}
				</div>
				<input
					type="text"
					id="mxlogin-homeserver-url"
					placeholder="Fills in from your Matrix ID"
					value={homeserverURL}
					onChange={onChangeHomeserverURL}
					disabled={loading}
					autoComplete="url"
				/>
			</div>
			{supportsPassword && <div>
				<label className="signin-label" htmlFor="mxlogin-password">Password</label>
				<input
					type="password"
					id="mxlogin-password"
					placeholder="Your Matrix password"
					value={password}
					onChange={evt => setPassword(evt.target.value)}
					disabled={loading}
					autoComplete="current-password"
					aria-invalid={error ? "true" : undefined}
				/>
				{errorBlock}
			</div>}
			<div className="signin-buttons">
				{supportsPassword && <button
					className="signin-primary"
					type="submit"
					disabled={loading}
				>Continue</button>}
				{supportsAnySSO && <button
					className={supportsPassword ? "signin-ghost" : "signin-primary"}
					type={supportsPassword ? "button" : "submit"}
					disabled={loading}
					onClick={supportsPassword ? loginSSO : undefined}
				>{supportsPassword ? "Sign in with your browser" : "Continue in your browser"}</button>}
			</div>
			{noSupportedMethods && <div className="signin-field-error">
				<span className="signin-glyph" />
				This homeserver doesn't offer a way to sign in that echo supports.
			</div>}
			{!supportsPassword && errorBlock}
		</form>

		{beeperDomain && <>
			<hr/>
			<BeeperLogin domain={beeperDomain} client={client}/>
		</>}
	</main>
}
