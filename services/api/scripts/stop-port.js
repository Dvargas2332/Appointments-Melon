const { execFileSync } = require("child_process");

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Puerto invalido: ${value ?? ""}`);
  }
  return port;
}

function getPidsOnWindows(port) {
  const output = execFileSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
  const lines = output.split(/\r?\n/);
  const pids = new Set();

  for (const line of lines) {
    if (!line.includes("LISTENING")) continue;
    if (!line.includes(`:${port}`)) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const localAddress = parts[1];
    const pid = Number(parts[4]);
    if (!localAddress.endsWith(`:${port}`)) continue;
    if (!Number.isInteger(pid) || pid <= 0) continue;
    pids.add(pid);
  }

  return [...pids];
}

function stopPidOnWindows(pid) {
  execFileSync("taskkill", ["/PID", String(pid), "/F", "/T"], { stdio: "ignore" });
}

function main() {
  const port = parsePort(process.argv[2] || process.env.PORT || "3000");

  if (process.platform !== "win32") {
    console.log(`stop-port omitido: plataforma no soportada (${process.platform})`);
    return;
  }

  const pids = getPidsOnWindows(port);
  if (pids.length === 0) {
    console.log(`Puerto ${port} libre`);
    return;
  }

  for (const pid of pids) {
    try {
      stopPidOnWindows(pid);
      console.log(`Proceso detenido en puerto ${port}: PID ${pid}`);
    } catch (error) {
      console.error(`No se pudo detener PID ${pid} en puerto ${port}`);
      throw error;
    }
  }
}

main();
