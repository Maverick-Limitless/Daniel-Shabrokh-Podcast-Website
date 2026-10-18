const dateFmt = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: 'short',
	day: 'numeric'
});

export function formatDate(d: Date | string | null | undefined): string {
	if (!d) return '';
	return dateFmt.format(new Date(d));
}

export function formatDuration(seconds: number | null | undefined): string {
	if (!seconds || seconds < 0 || !Number.isFinite(seconds)) return '';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
	return `${m}:${String(s).padStart(2, '0')}`;
}
