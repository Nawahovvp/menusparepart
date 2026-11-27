import * as loginApi from './functions/api/login.js';
import * as logoutApi from './functions/api/logout.js';
import * as dataApi from './functions/api/data.js';
import * as quickDataApi from './functions/api/quick-data.js';
import * as saveApi from './functions/api/save.js';
import * as outsideRequestApi from './functions/api/outside-request.js';

const API_ROUTES = {
  login: loginApi,
  logout: logoutApi,
  data: dataApi,
  'quick-data': quickDataApi,
  save: saveApi,
  'outside-request': outsideRequestApi,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const route = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
      const handlerModule = API_ROUTES[route];

      if (!handlerModule) {
        return new Response(JSON.stringify({ error: `API route not found: ${route}` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      const method = request.method.toUpperCase();
      const handler =
        (method === 'GET' ? handlerModule.onRequestGet : null) ||
        (method === 'POST' ? handlerModule.onRequestPost : null) ||
        handlerModule.onRequest;

      if (!handler) {
        return new Response(JSON.stringify({ error: `Method ${method} not allowed` }), {
          status: 405,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      return handler({
        request,
        env,
        waitUntil: (promise) => ctx.waitUntil(promise),
      });
    }

    // Serve static frontend assets (React Hub + /apps/abc-analysis + /apps/barcode)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
