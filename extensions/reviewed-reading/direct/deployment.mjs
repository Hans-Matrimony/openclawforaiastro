export function deploymentEnvironment(env) {
  const environment = env.VEDASTRO_DIRECT_ENVIRONMENT || "development";
  if (!["development", "production"].includes(environment)) {
    throw new Error("Unknown direct-answer environment");
  }
  return environment;
}

export function directEnabledForEnvironment(env) {
  if (env.VEDASTRO_DIRECT_ENVIRONMENT === "development") {
    return env.VEDASTRO_DIRECT_DEV_ENABLED === "1";
  }
  return (
    env.VEDASTRO_DIRECT_ENVIRONMENT === "production" &&
    env.VEDASTRO_DIRECT_PRODUCTION_ENABLED === "1" &&
    Boolean(env.VEDASTRO_DIRECT_PRODUCTION_USERS?.trim())
  );
}

export function productionUserAllowed(userId, env) {
  if (env.VEDASTRO_DIRECT_ENVIRONMENT !== "production") {
    return true;
  }
  const allowed = new Set(
    (env.VEDASTRO_DIRECT_PRODUCTION_USERS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return directEnabledForEnvironment(env) && (allowed.has("*") || allowed.has(userId));
}

export function memoryEnvironment(env) {
  const environment = deploymentEnvironment(env);
  const expectedHost =
    environment === "production"
      ? env.VEDASTRO_DIRECT_MEM0_PRODUCTION_HOST
      : env.VEDASTRO_DIRECT_MEM0_DEV_HOST;
  if (!expectedHost) {
    throw new Error("Explicit memory target required for this environment");
  }
  return { environment, expectedHost };
}
