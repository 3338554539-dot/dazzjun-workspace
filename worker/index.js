import { handleApiRequest, isApiRoute } from "./api.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isApiRoute(url.pathname)) return handleApiRequest(request, env);
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    const location = response.headers.get("location");
    const redirectsToRoot =
      response.status >= 300 &&
      response.status < 400 &&
      location &&
      new URL(location, request.url).pathname === "/";

    if ((response.status !== 404 && !redirectsToRoot) || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
