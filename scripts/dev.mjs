#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const children = [
  spawn(process.execPath, [path.join(root, "backend", "server.mjs")], { cwd: root, env: process.env, stdio: "inherit" }),
  spawn(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), ...process.argv.slice(2)], { cwd: root, env: process.env, stdio: "inherit" }),
];

const stop = (signal = "SIGTERM") => { for (const child of children) if (!child.killed) child.kill(signal); };
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
for (const child of children) child.on("exit", (code) => { if (code && code !== 0) { stop(); process.exitCode = code; } });
