import { onRequestGet } from '../functions/api/web-data.js';
import { runCloudflareHandler } from '../lib/vercel.js';

export default async function handler(req, res) {
    return runCloudflareHandler(req, res, { onRequestGet });
}
