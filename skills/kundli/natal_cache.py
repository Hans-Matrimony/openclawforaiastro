"""Bounded optional SQLite cache for immutable natal calculations only.

No response text, user IDs or current dashas are stored. Cache failures must not
prevent a calculation. Use a private writable state directory, never the skill.
"""
import hashlib
import json
import os
import sqlite3
import time
from contextlib import closing
from pathlib import Path

MAX_ENTRIES = 4096
TTL_SECONDS = 30 * 86400


def cached_natal(key_data, compute, validate):
    path = os.getenv('KUNDLI_NATAL_CACHE_PATH', '').strip()
    if not path:
        return compute()
    key = hashlib.sha256(json.dumps(key_data, sort_keys=True, allow_nan=False).encode()).hexdigest()
    connection = None
    try:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Set restrictive permissions at creation, before SQLite writes data.
        descriptor = os.open(target, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(descriptor)
        connection = sqlite3.connect(target, timeout=0.25)
        connection.execute('CREATE TABLE IF NOT EXISTS natal (key TEXT PRIMARY KEY, value TEXT NOT NULL, created REAL NOT NULL)')
        row = connection.execute('SELECT value, created FROM natal WHERE key = ?', (key,)).fetchone()
        now = time.time()
        if row and 0 <= now - row[1] < TTL_SECONDS:
            value = json.loads(row[0])
            validate(value)
            return value
    except (OSError, sqlite3.Error, ValueError, TypeError, KeyError):
        # Corrupt, expired and incompatible entries are cache misses.
        pass
    finally:
        if connection is not None:
            connection.close()

    value = compute()
    validate(value)
    try:
        with closing(sqlite3.connect(path, timeout=0.25)) as connection:
            with connection:
                connection.execute('INSERT OR REPLACE INTO natal VALUES (?, ?, ?)',
                                   (key, json.dumps(value, allow_nan=False), time.time()))
                connection.execute('DELETE FROM natal WHERE created < ?', (time.time() - TTL_SECONDS,))
                connection.execute('DELETE FROM natal WHERE key IN (SELECT key FROM natal ORDER BY created DESC, key DESC LIMIT -1 OFFSET ?)', (MAX_ENTRIES,))
    except (OSError, sqlite3.Error):
        pass
    return value
