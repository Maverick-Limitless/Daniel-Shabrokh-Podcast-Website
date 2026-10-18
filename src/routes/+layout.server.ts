import { SITE_BASE_URL } from '$app/env/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url }) => {
	// Canonical base for canonical URLs / OG tags (PRD §11). Deployment
	// configuration wins; the request origin is the development fallback.
	return {
		canonicalBase: SITE_BASE_URL?.replace(/\/$/, '') || url.origin
	};
};
