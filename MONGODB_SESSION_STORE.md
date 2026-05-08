# MongoDB Session Store

This project now supports MongoDB as a backend for session storage instead of the default filesystem-based storage.

## Features

- **Persistent session storage** in MongoDB
- **Automatic indexing** for fast queries
- **Connection pooling** for performance
- **In-memory caching** with configurable TTL
- **Atomic operations** (no file locking needed)
- **Full compatibility** with existing session APIs

## Setup

### 1. Install MongoDB Driver

The MongoDB driver is already included in `package.json`. Run:

```bash
pnpm install
```

### 2. Start MongoDB

Make sure MongoDB is running. Default connection: `mongodb://localhost:27017`

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or install locally
# Ubuntu/Debian: sudo apt install mongodb
# macOS: brew install mongodb-community
```

### 3. Configure MongoDB

#### Option A: Environment Variables

```bash
export OPENCLAW_MONGODB_URI="mongodb://localhost:27017"
export OPENCLAW_MONGODB_DB="openclaw"
export OPENCLAW_MONGODB_COLLECTION="sessions"
```

#### Option B: Config File

Add to `openclaw.json`:

```json
{
  "session": {
    "store": "mongodb",
    "mongoDb": {
      "uri": "mongodb://localhost:27017",
      "dbName": "openclaw",
      "collectionName": "sessions",
      "transcriptsCollectionName": "session_transcripts",
      "maxPoolSize": 10,
      "minPoolSize": 2,
      "serverSelectionTimeoutMs": 5000,
      "socketTimeoutMs": 30000
    }
  }
}
```

#### Option C: MongoDB Atlas (Cloud)

```json
{
  "session": {
    "mongoDb": {
      "uri": "mongodb+srv://username:password@cluster.mongodb.net/openclaw?retryWrites=true&w=majority",
      "dbName": "openclaw"
    }
  }
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `uri` | string | `mongodb://localhost:27017` | MongoDB connection URI |
| `dbName` | string | `openclaw` | Database name |
| `collectionName` | string | `sessions` | Sessions collection name |
| `transcriptsCollectionName` | string | `session_transcripts` | Transcripts collection name |
| `maxPoolSize` | number | `10` | Maximum connections in pool |
| `minPoolSize` | number | `2` | Minimum connections in pool |
| `serverSelectionTimeoutMs` | number | `5000` | Server selection timeout (ms) |
| `socketTimeoutMs` | number | `30000` | Socket timeout (ms) |

## Cache Configuration

Control in-memory caching with environment variable:

```bash
export OPENCLAW_SESSION_CACHE_TTL_MS=45000  # 45 seconds
```

Set to `0` to disable caching.

## Data Schema

### Sessions Collection (`sessions`)

```javascript
{
  _id: "sessionKey",           // Primary key
  sessionKey: "main",
  sessionId: "uuid",
  createdAt: 1234567890,
  updatedAt: 1234567890,
  label: "My Session",
  channel: "telegram",
  model: "gpt-4",
  // ... other session fields
}
```

### Transcripts Collection (`session_transcripts`)

```javascript
{
  _id: "sessionKey",
  sessionKey: "main",
  sessionId: "uuid",
  version: 1,
  messages: [
    { role: "user", content: [...], timestamp: 1234567890 },
    { role: "assistant", content: [...], timestamp: 1234567890 }
  ],
  createdAt: ISODate("2026-01-01"),
  updatedAt: ISODate("2026-01-01")
}
```

## Indexes

Automatic indexes are created on startup:

- `sessions`
  - `sessionKey` (unique)
  - `createdAt` (descending)
  - `updatedAt` (descending)
  - `channel`

- `session_transcripts`
  - `sessionKey` (unique)
  - `sessionId`
  - `updatedAt` (descending)

## Switching Between Stores

The system automatically detects which store to use:

1. If `OPENCLAW_MONGODB_URI` or `MONGODB_URI` env var is set → **MongoDB**
2. If `session.store` is set to `"mongodb"` → **MongoDB**
3. Otherwise → **Filesystem** (default)

## Migration from Filesystem

To migrate existing sessions from filesystem to MongoDB:

```bash
# Backup existing sessions
cp -r ~/.openclaw/agents/main/sessions ~/.openclaw/agents/main/sessions.backup

# Set MongoDB environment
export OPENCLAW_MONGODB_URI="mongodb://localhost:27017"

# Run the application (sessions will be created in MongoDB on first use)
node scripts/run-node.mjs
```

Note: Existing filesystem sessions are not automatically migrated. They will be created fresh in MongoDB when first accessed.

## Troubleshooting

### Connection Failed

```
Error: Failed to connect to MongoDB: MongoServerSelectionError
```

**Solution:** Check MongoDB is running and the URI is correct.

```bash
# Test connection
mongosh "mongodb://localhost:27017"
```

### Authentication Failed

```
Error: Authentication failed
```

**Solution:** Include credentials in URI:

```
mongodb://username:password@localhost:27017/openclaw
```

### Sessions Not Persisting

**Solution:** Check MongoDB is writable:

```bash
mongosh "mongodb://localhost:27017/openclaw" --eval "db.sessions.countDocuments()"
```

## Performance Tips

1. **Use connection pooling** - Default `maxPoolSize: 10` works for most cases
2. **Enable caching** - Default TTL is 45 seconds, tune based on your needs
3. **Create indexes** - Automatic indexes handle most queries
4. **Use MongoDB Atlas** - For production, use Atlas for automatic scaling

## Production Checklist

- [ ] Use MongoDB Atlas or a replica set
- [ ] Enable authentication (`username:password` in URI)
- [ ] Enable TLS (`mongodb+srv://` for Atlas)
- [ ] Set appropriate connection pool sizes
- [ ] Monitor connection metrics
- [ ] Set up backups (Atlas has automatic backups)
- [ ] Consider using a dedicated database for sessions

## API Reference

### New Functions (MongoDB only)

```typescript
// Load a single session entry by key
await loadSessionEntry(sessionKey: string): Promise<SessionEntry | null>

// Delete a session entry
await deleteSessionEntry(sessionKey: string): Promise<boolean>

// List sessions with filters
await listSessions(params?: {
  channel?: string;
  limit?: number;
  activeSince?: number;
}): Promise<SessionEntry[]>

// Get total session count
await getSessionCount(): Promise<number>

// Close MongoDB connection
await disconnectMongoDB(): Promise<void>
```

### Existing Functions (Compatible)

All existing session functions work with MongoDB:
- `loadSessionStore()`
- `saveSessionStore()`
- `updateSessionStore()`
- `recordSessionMetaFromInbound()`
- `updateLastRoute()`
