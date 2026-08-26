// Web authentication login component for Tauri
import { FormEvent, useState } from "react"
import "./WebAuthLogin.css"

interface WebAuthLoginProps {
	onSubmit: (username: string, password: string) => void
	onCancel: () => void
	error?: string
}

export default function WebAuthLogin({ onSubmit, onCancel, error }: WebAuthLoginProps) {
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		if (username && password) {
			onSubmit(username, password)
		}
	}

	return (
		<div className="web-auth-login">
			<h2>echo</h2>
			<p>Enter your local credentials</p>
			{error && <div className="error-message">{error}</div>}
			<form onSubmit={handleSubmit}>
				<input
					type="text"
					placeholder="Username"
					value={username}
					onChange={e => setUsername(e.target.value)}
					autoFocus
				/>
				<input
					type="password"
					placeholder="Password"
					value={password}
					onChange={e => setPassword(e.target.value)}
				/>
				<div className="button-row">
					<button type="button" onClick={onCancel}>Cancel</button>
					<button type="submit" disabled={!username || !password}>Login</button>
				</div>
			</form>
		</div>
	)
}
