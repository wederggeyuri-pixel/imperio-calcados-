import { envCheck, getPublicSiteUrl, json, supabaseRest } from '../lib/server.js';

function rejectWrongOrigin(req, siteUrl) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).origin !== new URL(siteUrl).origin; } catch { return true; }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  const missing = envCheck();
  if (missing.length) return json(res, 503, { error: 'A loja ainda não terminou a configuração do servidor de pagamento.', missing });
  const siteUrl = getPublicSiteUrl();
  if (rejectWrongOrigin(req, siteUrl)) return json(res, 403, { error: 'Origem não autorizada.' });

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const customer = body.customer || {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length || rawItems.length > 20) return json(res, 400, { error: 'A sacola precisa conter de 1 a 20 itens.' });
    const required = ['name','email','phone','zip','address','number','neighborhood','city','state'];
    for (const key of required) {
      if (typeof customer[key] !== 'string' || !customer[key].trim()) return json(res, 400, { error: 'Preencha todos os campos obrigatórios de entrega e contato.' });
    }
    if (customer.name.trim().length > 120 || customer.email.trim().length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) return json(res, 400, { error: 'Confira o nome e o e-mail informado.' });
    const phone = String(customer.phone).replace(/\D/g,'');
    const zip = String(customer.zip).replace(/\D/g,'');
    const state = String(customer.state).trim().toUpperCase();
    if (phone.length < 10 || phone.length > 13 || zip.length !== 8 || !/^[A-Z]{2}$/.test(state)) return json(res, 400, { error: 'Telefone, CEP ou UF inválidos.' });

    const quantities = new Map();
    for (const row of rawItems) {
      const productId = String(row?.productId || '');
      const quantity = Number(row?.quantity);
      if (!uuidPattern.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return json(res, 400, { error: 'A sacola contém um item inválido. Atualize a loja e tente novamente.' });
      }
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }
    const items = Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
    if (items.length > 20 || items.some(item => item.quantity > 20)) return json(res, 400, { error: 'Quantidade de itens acima do permitido.' });
    const ids = items.map(item => item.productId);
    const query = new URLSearchParams({ select:'id,name,price', active:'eq.true', id:`in.(${ids.join(',')})` });
    const found = await supabaseRest(`products?${query.toString()}`);
    if (!Array.isArray(found) || found.length !== ids.length) return json(res, 409, { error: 'Um ou mais produtos não estão mais disponíveis. Atualize a loja e tente novamente.' });
    const byId = new Map(found.map(p => [p.id, p]));
    const orderLines = items.map(line => {
      const product = byId.get(line.productId);
      const price = Number(product.price);
      if (!Number.isFinite(price) || price < 0) throw new Error('Preço inválido no catálogo.');
      return { productId: product.id, productName: product.name, unitPrice: Math.round(price * 100) / 100, quantity: line.quantity };
    });
    const totalCents = orderLines.reduce((sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity, 0);
    if (totalCents < 1 || totalCents > 100000000) return json(res, 400, { error: 'O total do pedido está fora do limite permitido.' });
    const total = (totalCents / 100).toFixed(2);

    const localOrder = (await supabaseRest('orders', {
      method:'POST', prefer:'return=representation', body:{
        customer_name:customer.name.trim(), customer_email:customer.email.trim().toLowerCase(), customer_phone:phone,
        shipping_zip:zip, shipping_address:customer.address.trim(), shipping_number:customer.number.trim(),
        shipping_complement:String(customer.complement || '').trim().slice(0,80),
        shipping_neighborhood:customer.neighborhood.trim(), shipping_city:customer.city.trim(), shipping_state:state,
        total, payment_provider:'mercado_pago', payment_status:'pending', payment_status_detail:'order_created', fulfillment_status:'new'
      }
    }))?.[0];
    if (!localOrder?.id) throw new Error('Não foi possível registrar o pedido.');

    try {
      await supabaseRest('order_items', { method:'POST', body:orderLines.map(line=>({
        order_id:localOrder.id, product_id:line.productId, product_name:line.productName,
        unit_price:line.unitPrice.toFixed(2), quantity:line.quantity
      })) });
    } catch (err) {
      await supabaseRest(`orders?id=eq.${localOrder.id}`, { method:'PATCH', body:{ payment_status:'error', payment_status_detail:'order_items_creation_failed' } }).catch(()=>{});
      throw err;
    }
    // Nunca recebemos ou gravamos número de cartão, validade ou CVV nesta rota.
    return json(res, 201, { orderId:localOrder.id, total:Number(total) });
  } catch (err) {
    console.error('create-order error:', err.message || err);
    return json(res, 500, { error: 'Erro ao registrar o pedido. Confira as configurações e tente novamente.' });
  }
}
