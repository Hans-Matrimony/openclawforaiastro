const LAHIRI = Object.freeze({ id: "lahiri365_25", ayanamsa: "LAHIRI", yearDays: 365.25 });
const RAMAN = Object.freeze({ id: "raman360", ayanamsa: "RAMAN", yearDays: 360 });

export function configuredCalculationProfile(env = process.env) {
  const selected = env.VEDASTRO_NATIVE_PROFILE;
  if (selected === undefined || selected === "" || selected === LAHIRI.id) {
    return LAHIRI;
  }
  if (selected === RAMAN.id && env.VEDASTRO_NATIVE_PROFILE_ENVIRONMENT === "development") {
    return RAMAN;
  }
  return null;
}

export function matchesCalculationProfile(settings, env = process.env) {
  const profile = configuredCalculationProfile(env);
  return Boolean(
    profile &&
    settings &&
    settings.ayanamsa === profile.ayanamsa &&
    settings.dasha_year_days === profile.yearDays,
  );
}
