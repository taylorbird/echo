// gomuks - A Matrix client written in Go.
// Copyright (C) 2024 Tulir Asokan
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
import React, { useCallback, useEffect, useState } from "react"
import { BACKEND_CREDENTIALS, BACKEND_URL } from "@/api/backend.ts"
import type Client from "@/api/client.ts"
import type { ClientState } from "@/api/types"
import BeeperLogin from "./BeeperLogin.tsx"
import "./LoginScreen.css"

export interface LoginScreenProps {
	client: Client
	clientState: ClientState
}

const beeperServerRegex = /^https:\/\/matrix\.(beeper(?:-dev|-staging)?\.com)$/

export const LoginScreen = ({ client }: LoginScreenProps) => {
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [homeserverURL, setHomeserverURL] = useState("")
	const [loginFlows, setLoginFlows] = useState<string[] | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState("")

	const loginSSO = () => {
		setLoading(true)
		fetch(`${BACKEND_URL}_gomuks/sso`, {
			method: "POST",
			body: JSON.stringify({ homeserver_url: homeserverURL }),
			headers: { "Content-Type": "application/json" },
			credentials: BACKEND_CREDENTIALS,
		}).then(resp => resp.json()).then(
			resp => {
				// The homeserver redirects a real browser back here, so this has to be the
				// backend's own URL, not the document's (which is tauri:// under Tauri).
				const redirectURL = new URL(BACKEND_URL || window.location.href, window.location.href)
				if (!redirectURL.pathname.endsWith("/")) {
					redirectURL.pathname += "/"
				}
				redirectURL.pathname += "_gomuks/sso"
				redirectURL.search = `?gomuksSession=${resp.session_id}`
				redirectURL.hash = ""
				const redir = encodeURIComponent(redirectURL.toString())
				window.location.href = `${homeserverURL}/_matrix/client/v3/login/sso/redirect?redirectUrl=${redir}`
			},
			err => setError(`Failed to start SSO login: ${err}`),
		).finally(() => setLoading(false))
	}

	const login = (evt: React.FormEvent) => {
		evt.preventDefault()
		if (!loginFlows) {
			// do nothing
		} else if (!loginFlows.includes("m.login.password")) {
			loginSSO()
		} else {
			setLoading(true)
			client.rpc.login(homeserverURL, username, password).then(
				() => {},
				err => setError(err.toString()),
			).finally(() => setLoading(false))
		}
	}

	const resolveLoginFlows = useCallback((serverURL: string) => {
		client.rpc.getLoginFlows(serverURL).then(
			resp => {
				setLoginFlows(resp.flows.map(flow => flow.type))
				setError("")
			},
			err => setError(`Failed to get login flows: ${err}`),
		)
	}, [client])
	const resolveHomeserver = useCallback(() => {
		client.rpc.discoverHomeserver(username).then(
			resp => {
				const url = resp["m.homeserver"].base_url
				setLoginFlows([])
				setHomeserverURL(url)
				resolveLoginFlows(url)
			},
			err => setError(`Failed to resolve homeserver: ${err}`),
		)
	}, [client, username, resolveLoginFlows])

	useEffect(() => {
		if (!username.startsWith("@") || !username.includes(":") || !username.includes(".")) {
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

	const supportsSSO = loginFlows?.includes("m.login.sso") ?? false
	const supportsPassword = loginFlows?.includes("m.login.password")
	const beeperDomain = homeserverURL.match(beeperServerRegex)?.[1]
	// Attached under the password field when there is one, so the message sits with the
	// input it is about. With SSO-only servers there is no such field, so it falls to the
	// end of the form instead of having nowhere to go.
	const errorBlock = error
		? <div className="signin-field-error">
			<span className="signin-glyph" />
			{error}
		</div>
		: null
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
				{supportsSSO && <button
					className={supportsPassword ? "signin-ghost" : "signin-primary"}
					type={supportsPassword ? "button" : "submit"}
					disabled={loading}
					onClick={supportsPassword ? loginSSO : undefined}
				>Use single sign-on</button>}
			</div>
			{!supportsPassword && errorBlock}
		</form>

		{beeperDomain && <>
			<hr/>
			<BeeperLogin domain={beeperDomain} client={client}/>
		</>}
	</main>
}
