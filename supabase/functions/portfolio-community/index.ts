import { createCommunityHandler, allowedOrigins } from './handler.js';

// Supabase injects these server-only variables. Never copy their values to the frontend.
const secretKeys: Record<string, string> = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const publicKeys: Record<string, string> = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
const extraOrigins = (Deno.env.get('PORTFOLIO_ALLOWED_ORIGINS') || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
Deno.serve(
  createCommunityHandler({
    url: Deno.env.get('SUPABASE_URL'),
    backendKey: secretKeys.default || Object.values(secretKeys)[0],
    publishableKeys: Object.values(publicKeys),
    origins: [...allowedOrigins, ...extraOrigins],
  }),
);
