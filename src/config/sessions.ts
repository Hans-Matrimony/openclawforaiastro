export * from "./sessions/group.js";
export * from "./sessions/metadata.js";
export * from "./sessions/main-session.js";
export * from "./sessions/paths.js";
export * from "./sessions/reset.js";
export * from "./sessions/session-key.js";
export * from "./sessions/types.js";

// Session store: filesystem (default) or MongoDB
const USE_MONGODB_STORE = !!(
  process.env.OPENCLAW_MONGODB_URI ||
  process.env.MONGODB_URI ||
  process.env.OPENCLAW_SESSION_STORE === "mongodb"
);

console.log('==============================================');
console.log('[SESSION STORE] INITIALIZING...');
console.log('[SESSION STORE] Mode:', USE_MONGODB_STORE ? 'MONGODB' : 'FILESYSTEM');
console.log('[SESSION STORE] OPENCLAW_MONGODB_URI:', process.env.OPENCLAW_MONGODB_URI || 'not set');
console.log('[SESSION STORE] MONGODB_URI:', process.env.MONGODB_URI || 'not set');
console.log('[SESSION STORE] OPENCLAW_SESSION_STORE:', process.env.OPENCLAW_SESSION_STORE || 'not set');
console.log('==============================================');

if (USE_MONGODB_STORE) {
  // Export MongoDB-based store functions
  export * from "./sessions/store-mongodb.js";
  // Export MongoDB-based transcript functions
  export * from "./sessions/transcript-mongodb.js";
} else {
  // Export filesystem-based store functions
  export * from "./sessions/store.js";
  // Export filesystem-based transcript functions
  export * from "./sessions/transcript.js";
}
