
// Supabase Configuration
// Keys provided by user
const SUPABASE_URL = 'https://ijmgvsztgljribnogtsx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tHrPQdJlE9sOPkAr_muBlQ_bGDx8pxU'; // User provided key

// Initialize Supabase Client
// We use 'supabaseApp' to avoid conflict with the global 'supabase' object provided by the SDK
if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    window.supabaseApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase App initialized and exported to window.supabaseApp");
} else {
    console.error("❌ Supabase SDK not found! Make sure to include the CDN script.");
}
