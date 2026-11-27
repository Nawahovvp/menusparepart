import { jsonResponse, readJsonBody, verifySession } from '../_shared.js';

const DEFAULT_SHEET_ID_PRODUCT = '1A2N5hGjeFljUMa9ouWvlioSIcdj-SpZA708fUczhNV8';
const DEFAULT_SHEET_ID_STORE = '1AfChl2ikkXb7FQJn72h-CvfIq8tKTb2ERz9z3WVK1KY';
const DEFAULT_SHEET_ID_BLUETAP_CLAIM = '1hDRfqxWE9SRCBcw4Ru2FfMxW029j49bkFzB_WUzvZqo';
const DEFAULT_LOG_URL = 'https://script.google.com/macros/s/AKfycbzOUOSw8ddxXs-7Aij47vE98fG6In0FT6X53QReilYmD8ZBt6ssXXhXSI4EMa6-6dDYQg/exec';

function getProxyTarget(type, env) {
    const config = {
        product: { id: env?.SHEET_ID_PRODUCT || DEFAULT_SHEET_ID_PRODUCT, name: 'WebTSCDummy' },
        brand: { id: env?.SHEET_ID_STORE || DEFAULT_SHEET_ID_STORE, name: 'TscBrand' },
        tsc: { id: env?.SHEET_ID_STORE || DEFAULT_SHEET_ID_STORE, name: 'TSCData' },
        bluetap_claim: { id: env?.SHEET_ID_BLUETAP_CLAIM || DEFAULT_SHEET_ID_BLUETAP_CLAIM, name: 'Bluetap' },
        log: { url: env?.TSC_LOG_URL || env?.LOG_URL || DEFAULT_LOG_URL },
    };
    return config[type] || null;
}

export async function onRequestGet({ request, env }) {
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
    }

    const type = new URL(request.url).searchParams.get('type');
    const target = getProxyTarget(type, env);
    if (!target || type === 'log') {
        return jsonResponse({ error: 'Invalid proxy type' }, 400);
    }

    try {
        const url = `https://opensheet.elk.sh/${target.id}/${encodeURIComponent(target.name)}`;
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            return jsonResponse({ error: `Failed to fetch from source (HTTP ${response.status})` }, 502);
        }
        const data = await response.json();
        return jsonResponse(data, 200, {
            'Cache-Control': 'private, max-age=60',
        });
    } catch (error) {
        console.error('[TSC proxy GET error]:', error);
        return jsonResponse({ error: 'Failed to fetch TSC data' }, 502);
    }
}

export async function onRequestPost({ request, env, waitUntil }) {
    const session = await verifySession(request, env);
    if (!session) {
        return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
    }

    const type = new URL(request.url).searchParams.get('type');
    const target = getProxyTarget(type, env);
    if (type !== 'log' || !target?.url) {
        return jsonResponse({ error: 'Invalid proxy type' }, 400);
    }

    const parsed = await readJsonBody(request);
    if (parsed.error) return parsed.error;

    try {
        const postPromise = fetch(target.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(parsed.data),
        }).catch((err) => console.warn('[TSC log error]:', err));

        if (typeof waitUntil === 'function') {
            waitUntil(postPromise);
        } else {
            await postPromise;
        }
        return jsonResponse({ status: 'logged' }, 200);
    } catch (error) {
        console.error('[TSC proxy POST error]:', error);
        return jsonResponse({ status: 'ignored' }, 200);
    }
}
