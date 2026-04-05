// サーバーと Vite を同時に起動する
import { spawn } from "node:child_process";
import { platform } from "node:os";

const isWin = platform() === "win32";
const npx = isWin ? "npx.cmd" : "npx";

// 校正 API サーバー
const server = spawn("node", ["server.js"], { stdio: "inherit" });

// Vite dev server
const vite = spawn(npx, ["vite"], { stdio: "inherit" });

process.on("SIGINT", () => {
  server.kill();
  vite.kill();
  process.exit();
});

server.on("exit", () => { vite.kill(); process.exit(); });
vite.on("exit", () => { server.kill(); process.exit(); });
