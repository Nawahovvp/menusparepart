import { onRequestGet, onRequestPost } from '../functions/api/proxy.js';
import { runCloudflareHandler } from '../lib/vercel.js';

export default async function handler(req, res) {
    return runCloudflareHandler(req, res, { onRequestGet, onRequestPost });
}
