import { json, supabaseRest } from '../lib/server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res,405,{error:'Método não permitido.'});
  const id = String(req.query?.id || new URL(req.url, `https://${req.headers.host || 'localhost'}`).searchParams.get('id') || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return json(res,400,{error:'Pedido inválido.'});
  try {
    const rows=await supabaseRest(`orders?select=id,created_at,total,payment_status,payment_status_detail,fulfillment_status&id=eq.${id}&limit=1`);
    if (!Array.isArray(rows) || !rows[0]) return json(res,404,{error:'Pedido não encontrado.'});
    return json(res,200,{order:rows[0]});
  } catch(err) {
    console.error('order-status error:',err.message||err);
    return json(res,500,{error:'Não foi possível consultar o pedido.'});
  }
}
