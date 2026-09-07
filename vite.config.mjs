import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { HttpsProxyAgent } from "https-proxy-agent";

const workerOrigin = "https://dazzjun-workspace.dazzjun04.workers.dev";
const systemProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;

const workerProxy = {
  target: workerOrigin,
  changeOrigin: true,
  headers: { origin: workerOrigin },
  ...(systemProxy ? { agent: new HttpsProxyAgent(systemProxy) } : {}),
  configure(proxy) {
    proxy.on("proxyRes", (proxyResponse) => {
      const cookies = proxyResponse.headers["set-cookie"];
      if (cookies) proxyResponse.headers["set-cookie"] = cookies.map((value) => value.replace(/;\s*Secure/gi, ""));
    });
  },
};

export default defineConfig({
  base: "/",
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: { "/api": workerProxy },
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      manifest: {
        id: "/",
        name: "Dazzjun工作台",
        short_name: "Dazzjun",
        description: "个人创意成长工作台",
        lang: "zh-CN",
        theme_color: "#050711",
        background_color: "#03050d",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["productivity", "lifestyle"],
        icons: [
          { src: "/dazzjun-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}", "icon-*.png"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
