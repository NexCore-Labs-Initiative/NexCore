const SUPABASE_URL = "https://qacupmuqeuqspfhwosfu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhY3VwbXVxZXVxc3BmaHdvc2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODc0MDksImV4cCI6MjA3NjQ2MzQwOX0.wg3Csls252_yP4P0-CgYrop0W1DqtlyNO2XpbdZ5Zzk";

function createClient() {
	try {
		if (window.supabase && typeof window.supabase.createClient === 'function') {
			window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
		} else {
			console.warn('Supabase SDK not present on window; attempting to load UMD bundle.');
			loadSupabaseUmd().then(() => {
				if (window.supabase && typeof window.supabase.createClient === 'function') {
					window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
				} else {
					console.error('Supabase SDK loaded but `supabase.createClient` not available.');
				}
			}).catch((err) => {
				console.error('Failed to load Supabase SDK:', err);
			});
		}
	} catch (err) {
		console.error('Error creating Supabase client:', err);
	}
}

function loadSupabaseUmd() {
	return new Promise((resolve, reject) => {
		if (document.querySelector('script[data-supabase-umd]')) return resolve();
		const s = document.createElement('script');
		s.setAttribute('data-supabase-umd', 'true');
		s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
		s.onload = () => resolve();
		s.onerror = (e) => reject(e || new Error('Failed to load supabase UMD script'));
		document.head.appendChild(s);
	});
}

createClient();