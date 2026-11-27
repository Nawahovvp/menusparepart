import { jsonResponse, verifySession } from '../_shared.js';

const WEB_URL = 'https://opensheet.elk.sh/1r418cqPa92z1_tO62z369pvQrzD3MVlaAfISMXSGFMc/Web';

export async function onRequestGet({ request, env }) {
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
    }

    try {
        const response = await fetch(WEB_URL, {
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
            return jsonResponse({ error: `Upstream error: ${response.status}` }, 502);
        }
        const data = await response.json();
        return jsonResponse(data, 200, {
            'Cache-Control': 'private, max-age=60'
        });
    } catch (error) {
        console.error('[web-data] fetch failed:', error);
        return jsonResponse({ error: 'Failed to fetch StockDay data' }, 502);
    }
}
