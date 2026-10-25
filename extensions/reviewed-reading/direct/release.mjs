export function directReleaseEnabled(env = process.env, userId) {
  if (
    env.ASTROFRIEND_DIRECT_MODE !== undefined ||
    env.ASTROFRIEND_DIRECT_ENVIRONMENT !== undefined
  ) {
    if (
      env.ASTROFRIEND_DIRECT_MODE !== "pilot" ||
      !["staging", "production"].includes(env.ASTROFRIEND_DIRECT_ENVIRONMENT)
    ) {
      return false;
    }
    const users = (env.ASTROFRIEND_DIRECT_TEST_USERS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return userId === undefined ? users.length > 0 : users.includes(userId);
  }
  return (
    env.VEDASTRO_DIRECT_DEV_ENABLED === "1" && env.VEDASTRO_DIRECT_ENVIRONMENT === "development"
  );
}
