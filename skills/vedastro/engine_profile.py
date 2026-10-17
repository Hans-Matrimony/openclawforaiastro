"""Explicit calculation profiles; settings must be selected before using a provider."""
import os
from typing import NamedTuple


class EngineProfile(NamedTuple):
    identifier: str
    ayanamsa: str
    ayanamsa_code: int
    year_days: float

    def native_settings(self):
        return {'ayanamsa': self.ayanamsa, 'node': 'true',
                'dasha_year_days': self.year_days, 'house_system': 'vedastro_bhava',
                'engine': 'VedAstro.Library'}


LAHIRI = EngineProfile('lahiri365_25', 'LAHIRI', 1, 365.25)
RAMAN = EngineProfile('raman360', 'RAMAN', 3, 360.0)


def configured_profile(env=None):
    env = os.environ if env is None else env
    selected = env.get('VEDASTRO_NATIVE_PROFILE', '')
    if selected in ('', LAHIRI.identifier):
        return LAHIRI
    if (selected == RAMAN.identifier and
            env.get('VEDASTRO_NATIVE_PROFILE_ENVIRONMENT') == 'development'):
        return RAMAN
    raise ValueError('Unsupported or non-development calculation profile')
