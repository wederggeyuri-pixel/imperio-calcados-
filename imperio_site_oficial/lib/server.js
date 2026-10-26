import { createHmac, timingSafeEqual } from 'node:crypto';

export function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(payload));
}

export function envCheck() {
  const missing = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','MP_ACCESS_TOKEN','PUBLIC_SITE_URL'].filter(k => !process.env[k]);
  return missing;
}

export async function supabaseRest(path, { method='GET', body, prefer } = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Supabase server credentials are not configured.');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${base.replace(/\/$/,'')}/rest/v1/${path}`, {
    method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const content = await response.text();
  let parsed = null;
  try { parsed = content ? JSON.parse(content) : null; } catch { parsed = { raw: content.slice(0,500) }; }
  if (!response.ok) {
    const err = new Error(parsed?.message || parsed?.hint || `Supabase REST returned ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return parsed;
}

export function verifyMercadoPagoSignature(signatureHeader, requestId, dataId, secret) {
  if (!signatureHeader || !requestId || !dataId || !secret) return false;
  const parts = Object.fromEntries(String(signatureHeader).split(',').map(part => part.trim().split('=').map(x => x.trim())).filter(pair => pair.length === 2));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  let received;
  try { received = Buffer.from(parts.v1, 'hex'); } catch { return false; }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function getPublicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
}

export function paymentStatusFromMercadoPago(order) {
  const status = String(order?.status || '').toLowerCase();
  const detail = String(order?.status_detail || '').toLowerCase();
  if (status === 'processed' && (detail === 'accredited' || detail === 'partially_refunded')) return detail === 'partially_refunded' ? 'refunded' : 'approved';
  if (status === 'refunded' || status === 'charged_back') return 'refunded';
  if (status === 'cancelled' || status === 'expired') return 'cancelled';
  if (status === 'failed' || status === 'rejected') return 'rejected';
  return 'pending';
}
