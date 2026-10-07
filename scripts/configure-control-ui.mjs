import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function httpsOrigin(raw) {
  try {
    const url = new URL(raw);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      !url.hostname.includes("*")
    ) {
      return url.origin;
    }
  } catch {}
  throw new Error("Control UI requires explicit HTTPS origins");
}

export function secureControlUi(config, origins = "") {
  const port = config.gateway?.port ?? 8000;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid gateway port");
  }
  const allowed = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);
  const supplied = origins
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (supplied.length) {
    // An explicit allowlist replaces old domains, permitting revocation.
    for (const raw of supplied) {
      allowed.add(httpsOrigin(raw));
    }
  } else {
    // Preserve approved HTTPS domains; legacy wildcards stay excluded.
    for (const raw of config.gateway.controlUi?.allowedOrigins ?? []) {
      if (typeof raw !== "string") {
        continue;
      }
      try {
        allowed.add(httpsOrigin(raw));
      } catch {}
    }
  }
  config.gateway.controlUi = {
    ...config.gateway.controlUi,
    allowInsecureAuth: false,
    dangerouslyDisableDeviceAuth: false,
    dangerouslyAllowHostHeaderOriginFallback: false,
    allowedOrigins: [...allowed],
  };
  return config;
}

export function writeControlUiConfig(file, origins = "", storage = fs) {
  const config = secureControlUi(JSON.parse(storage.readFileSync(file, "utf8")), origins);
  const temporary = `${file}.secure-${randomUUID()}`;
  try {
    // Keep the old config intact if the filesystem runs out of space.
    storage.writeFileSync(temporary, JSON.stringify(config, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    storage.renameSync(temporary, file);
  } finally {
    if (storage.existsSync(temporary)) {
      storage.unlinkSync(temporary);
    }
  }
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = process.env.OPENCLAW_CONFIG_PATH || "/app/openclaw.json";
  writeControlUiConfig(file, process.env.OPENCLAW_CONTROL_UI_ORIGINS || "");
  console.log("[startup] Control UI requires device authentication and explicit origins");
}
