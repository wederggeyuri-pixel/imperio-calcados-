import { randomUUID } from 'node:crypto';
import { envCheck, getPublicSiteUrl, json, supabaseRest } from '../lib/server.js';

function rejectWrongOrigin(req, siteUrl) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).origin !== new URL(siteUrl).origin; } catch { return true; }
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function safeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'refunded' || s === 'charged_back') return 'refunded';
  return 'pending';
}
function isSafeIdType(type) { return type === 'CPF' || type === 'CNPJ'; }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  const missing = envCheck();
  if (missing.length) return json(res, 503, { error: 'A loja ainda não terminou a configuração do servidor de pagamento.', missing });
  const siteUrl = getPublicSiteUrl();
  if (rejectWrongOrigin(req, siteUrl)) return json(res, 403, { error: 'Origem não autorizada.' });

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const orderId = String(body.orderId || '');
    const token = typeof body.token === 'string' ? body.token : '';
    const paymentMethodId = String(body.payment_method_id || '');
    const installments = Number(body.installments);
    const identification = body.payer?.identification || {};
    const idType = String(identification.type || '').toUpperCase();
    const idNumber = String(identification.number || '').replace(/\D/g, '');
    const issuerId = body.issuer_id;

    if (!uuidPattern.test(orderId)) return json(res, 400, { error: 'Pedido inválido. Volte à sacola e tente novamente.' });
    if (token.length < 10 || token.length > 1000) return json(res, 400, { error: 'O provedor não gerou um token de cartão válido. Confira os campos e tente novamente.' });
    if (!/^[a-z0-9_-]{2,40}$/i.test(paymentMethodId)) return json(res, 400, { error: 'Bandeira do cartão inválida.' });
    if (!Number.isInteger(installments) || installments < 1 || installments > 24) return json(res, 400, { error: 'Quantidade de parcelas inválida.' });
    if (!isSafeIdType(idType) || !((idType === 'CPF' && idNumber.length === 11) || (idType === 'CNPJ' && idNumber.length === 14))) return json(res, 400, { error: 'Confira o CPF/CNPJ do titular do cartão.' });

    const orderRows = await supabaseRest(`orders?select=id,total,customer_email,customer_name,payment_status,payment_provider_payment_id&id=eq.${orderId}&limit=1`);
    const order = Array.isArray(orderRows) ? orderRows[0] : null;
    if (!order) return json(res, 404, { error: 'Pedido não encontrado. Volte à loja e tente novamente.' });
    if (order.payment_status === 'approved') return json(res, 409, { error: 'Este pedido já foi pago.' });
    if (order.payment_status === 'cancelled' || order.payment_status === 'refunded') return json(res, 409, { error: 'Este pedido não aceita uma nova tentativa de pagamento. Crie um novo pedido.' });
    if (order.payment_provider_payment_id && order.payment_status === 'pending') return json(res, 409, { error: 'Este pagamento está em análise. Consulte o status do pedido antes de tentar novamente.' });

    const items = await supabaseRest(`order_items?select=product_name,unit_price,quantity&order_id=eq.${orderId}`);
    const amount = Number(order.total);
    if (!Number.isFinite(amount) || amount <= 0 || !Array.isArray(items) || !items.length) return json(res, 409, { error: 'Não foi possível validar o total do pedido.' });

    const fullName = String(order.customer_name || '').trim().split(/\s+/);
    const payer = {
      email: String(order.customer_email || '').trim().toLowerCase(),
      first_name: fullName[0] || undefined,
      last_name: fullName.slice(1).join(' ') || undefined,
      identification: { type: idType, number: idNumber }
    };
    const paymentBody = {
      transaction_amount: Math.round(amount * 100) / 100,
      token,
      description: `Império Calçados - Pedido ${orderId.slice(0,8).toUpperCase()}`,
      installments,
      payment_method_id: paymentMethodId,
      payer,
      external_reference: orderId,
      notification_url: `${siteUrl}/api/payment-webhook`,
      additional_info: {
        items: items.map(item => ({
          title: String(item.product_name || 'Produto').slice(0, 120),
          quantity: Number(item.quantity),
          unit_price: Math.round(Number(item.unit_price) * 100) / 100,
          currency_id: 'BRL'
        }))
      }
    };
    if (issuerId !== undefined && issuerId !== null && String(issuerId) !== '' && Number.isFinite(Number(issuerId))) paymentBody.issuer_id = Number(issuerId);

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID()
      },
      body: JSON.stringify(paymentBody)
    });
    const mpData = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok || !mpData.id || !mpData.status) {
      console.error('Mercado Pago payment failed:', mpResponse.status, String(mpData?.message || mpData?.error || 'unknown error').slice(0,160));
      return json(res, 502, { error: 'O Mercado Pago não conseguiu processar a tentativa. Confira os dados e tente novamente.' });
    }

    const status = safeStatus(mpData.status);
    const detail = String(mpData.status_detail || mpData.status || 'unknown').slice(0,100);
    await supabaseRest(`orders?id=eq.${orderId}`, {
      method: 'PATCH',
      body: { payment_provider_payment_id: String(mpData.id), payment_status: status, payment_status_detail: detail }
    });

    let message = 'Pagamento recebido e aguardando confirmação do provedor.';
    if (status === 'approved') message = 'Pagamento aprovado!';
    if (status === 'rejected') message = 'Pagamento recusado. Confira os dados ou tente outro cartão.';
    if (status === 'cancelled') message = 'Pagamento cancelado.';
    if (status === 'refunded') message = 'O pagamento consta como estornado.';
    // Deliberadamente não registramos nem retornamos número de cartão, validade ou CVV.
    return json(res, 201, { orderId, paymentId: String(mpData.id), status, message });
  } catch (err) {
    console.error('process-payment error:', err.message || err);
    return json(res, 500, { error: 'Não foi possível processar o pagamento. Tente novamente.' });
  }
}
