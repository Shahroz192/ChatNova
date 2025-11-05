import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: true,
        proxy: {
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
                secure: false,
                configure: (proxy, options) => {
                    proxy.on("proxyReq", (proxyReq, req, res) => {
                        console.log(
                            "Sending Request to Backend:",
                            req.method,
                            req.url,
                        );
                    });
                    proxy.on("proxyRes", (proxyRes, req, res) => {
                        console.log(
                            "Received Response from Backend:",
                            proxyRes.statusCode,
                            req.url,
                        );
                    });
                },
            },
        },
    },
});
