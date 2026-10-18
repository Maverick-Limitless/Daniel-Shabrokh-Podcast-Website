declare global {
	namespace App {
		interface Locals {
			administrator: { id: string; username: string; mustChangePassword: boolean } | null;
			/** SHA-256 id of the current session row, when a valid session cookie is present. */
			sessionId: string | null;
		}
	}
}

export {};
