const SESSION_BACKUP_KEY = 'catjudge-session-backup'

export const readSessionBackup = () => {
    try {
        const raw = localStorage.getItem(SESSION_BACKUP_KEY)
        if (!raw) return null
        return JSON.parse(raw)
    } catch (_err) {
        return null
    }
}

export const writeSessionBackup = (session) => {
    try {
        if (!session) {
            localStorage.removeItem(SESSION_BACKUP_KEY)
            return
        }

        const payload = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user: session.user
                ? {
                    id: session.user.id,
                    email: session.user.email || null,
                }
                : null,
        }

        localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(payload))
    } catch (_err) {
        // Best-effort only.
    }
}

export const clearSessionBackup = () => {
    try {
        localStorage.removeItem(SESSION_BACKUP_KEY)
    } catch (_err) {
        // Best-effort only.
    }
}

