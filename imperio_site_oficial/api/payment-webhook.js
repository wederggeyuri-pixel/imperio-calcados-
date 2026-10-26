import { envCheck, json, paymentStatusFromMercadoPago, supabaseRest, verifyMercadoPagoSignature } from '../lib/server.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function safePaymentStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'refunded' || s === 'charged_back') return 'refunded';
  return 'pending';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error:'Método não permitido.' });
  if (!process.env.MP_WEBHOOK_SECRET) return json(res, 503, { error:'Webhook não configurado.' });
  const missing = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','MP_ACCESS_TOKEN'].filter(k => !process.env[k]);
  if (missing.length) return json(res, 503, { error:'Servidor não configurado.' });

  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const dataId = url.searchParams.get('data.id') || req.body?.data?.id;
  const type = url.searchParams.get('type') || req.body?.type || url.searchParams.get('topic') || req.body?.topic;
  if (!dataId || !type) return json(res, 400, { error:'Notificação incompleta.' });
  if (!verifyMercadoPagoSignature(req.headers['x-signature'], req.headers['x-request-id'], dataId, process.env.MP_WEBHOOK_SECRET)) {
    return json(res, 401, { error:'Assinatura de webhook inválida.' });
  }

  try {
    if (String(type).toLowerCase() === 'payment') {
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(dataId))}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const payment = await mpResponse.json().catch(() => ({}));
      if (!mpResponse.ok || !payment.external_reference || !payment.id) {
        console.error('Could not fetch Mercado Pago payment:', mpResponse.status);
        return json(res, 502, { error:'Não foi possível consultar o pagamento.' });
      }
      const orderId = String(payment.external_reference);
      if (!uuidPattern.test(orderId)) return json(res, 200, { received:true, ignored:true });
      const rows = await supabaseRest(`orders?select=id,payment_provider_payment_id&id=eq.${orderId}&limit=1`);
      const order = Array.isArray(rows) ? rows[0] : null;
      if (!order) return json(res, 200, { received:true, ignored:true });
      if (order.payment_provider_payment_id && String(order.payment_provider_payment_id) !== String(payment.id)) {
        return json(res, 200, { received:true, ignored:true, stale:true });
      }
      const status = safePaymentStatus(payment.status);
      const detail = String(payment.status_detail || payment.status || 'unknown').slice(0,100);
      await supabaseRest(`orders?id=eq.${orderId}`, {
        method:'PATCH',
        body:{ payment_provider_payment_id:String(payment.id), payment_status:status, payment_status_detail:detail }
      });
      return json(res, 200, { received:true });
    }

    // Compatibilidade com pedidos criados pelo checkout anterior baseado em Orders API.
    if (String(type).toLowerCase() === 'order') {
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(String(dataId))}`, { headers:{Authorization:`Bearer ${process.env.MP_ACCESS_TOKEN}`} });
      const mpOrder = await mpResponse.json().catch(()=>({}));
      if (!mpResponse.ok || !mpOrder.external_reference) return json(res, 502, { error:'Não foi possível consultar a order do provedor.' });
      const orderId = String(mpOrder.external_reference);
      if (!uuidPattern.test(orderId)) return json(res, 200, { received:true, ignored:true });
      const status = paymentStatusFromMercadoPago(mpOrder);
      const detail = String(mpOrder.status_detail || mpOrder.status || 'unknown').slice(0,100);
      await supabaseRest(`orders?id=eq.${orderId}`, { method:'PATCH', body:{payment_provider_order_id:String(mpOrder.id || dataId),payment_status:status,payment_status_detail:detail} });
      return json(res, 200, { received:true });
    }
    return json(res, 200, { received:true, ignored:true });
  } catch (err) {
    console.error('payment-webhook error:',err.message||err);
    return json(res, 500, { error:'Falha ao processar notificação.' });
  }
}
