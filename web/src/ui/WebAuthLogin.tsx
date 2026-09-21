// The backend session screen: shown when the gomuks server behind the app will not accept us.
import { FormEvent, useState } from "react"
import { isTauri } from "@/api/backend.ts"
import { restartApp } from "@/util/updater.ts"

interface WebAuthLoginProps {
	onSubmit: (username: string, password: string) => void
	error?: string
}

/*
 * In the packaged app this is almost never a real credentials prompt.
 *
 * echo writes its own backend config at first launch with a random password, hashes it, and
 * throws the password away — nothing stores it, and nobody can type it. Authentication is a
 * session token the app mints for itself at launch (lib.rs), and that token lasts 24 hours.
 * When it runs out, the backend stops accepting us and the frontend lands here.
 *
 * So the honest primary action is to relaunch, not to ask for a password that does not exist.
 * The form is still reachable, because someone running their own gomuks server does have real
 * credentials — but it is a disclosure behind the explanation rather than the whole screen.
 *
 * Outside Tauri there is no self-minted token and no relaunch to offer, so the form leads.
 */
export default function WebAuthLogin({ onSubmit, error }: WebAuthLoginProps) {
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	// A rejected attempt means they are already in the form; keep them there.
	const [showForm, setShowForm] = useState(!isTauri || Boolean(error))

	const handleSubmit = (evt: FormEvent) => {
		evt.preventDefault()
		if (username && password) {
			onSubmit(username, password)
		}
	}

	if (!showForm) {
		return <main className="signin-column errored">
			<div className="signin-head">
				<h1 className="signin-title">
					<span className="signin-glyph" />
					This session expired
				</h1>
				<p className="signin-body">
					echo signs itself in to its own local server each time it launches, and that
					pass lasts 24 hours. This copy has been open longer, so it ran out. Nothing is
					lost — restarting issues a new one.
				</p>
			</div>
			<div className="signin-buttons">
				<button type="button" className="signin-danger" onClick={restartApp}>
					Restart echo
				</button>
			</div>
			<div className="signin-disclose">
				Running a gomuks server you host?{" "}
				<button type="button" className="signin-link" onClick={() => setShowForm(true)}>
					Sign in with its credentials
				</button>
			</div>
		</main>
	}

	return <main className="signin-column">
		<div className="signin-head">
			<h1 className="signin-title">Sign in to this server</h1>
			<p className="signin-body">
				These are the credentials for the gomuks server echo is connecting to — not your
				Matrix account.
			</p>
		</div>
		<form className="signin-fields" onSubmit={handleSubmit}>
			<div>
				<label className="signin-label" htmlFor="backend-username">Username</label>
				<input
					id="backend-username"
					type="text"
					placeholder="Your server username"
					value={username}
					onChange={evt => setUsername(evt.target.value)}
					autoFocus
				/>
			</div>
			<div>
				<label className="signin-label" htmlFor="backend-password">Password</label>
				<input
					id="backend-password"
					type="password"
					placeholder="Your server password"
					value={password}
					onChange={evt => setPassword(evt.target.value)}
					aria-invalid={error ? "true" : undefined}
				/>
				{error && <div className="signin-field-error">
					<span className="signin-glyph" />
					{error}
				</div>}
			</div>
			<div className="signin-buttons">
				<button type="submit" className="signin-primary" disabled={!username || !password}>
					Sign in
				</button>
				{isTauri && <button type="button" className="signin-ghost" onClick={restartApp}>
					Restart echo
				</button>}
			</div>
		</form>
	</main>
}
