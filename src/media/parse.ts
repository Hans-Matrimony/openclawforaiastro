// Shared helpers for parsing MEDIA tokens from command/stdout text.

import { parseFenceSpans } from "../markdown/fences.js";
import { parseAudioTag } from "./audio-tags.js";

// Allow optional wrapping backticks and punctuation after the token; capture the core token.
export const MEDIA_TOKEN_RE = /\bMEDIA:\s*`?([^\n]+)`?/gi;

export function normalizeMediaSource(src: string) {
  return src.startsWith("file://") ? src.replace("file://", "") : src;
}

function cleanCandidate(raw: string) {
  return raw.replace(/^[`"'[{(]+/, "").replace(/[`"'\\})\],]+$/, "");
}

function isValidMedia(candidate: string, opts?: { allowSpaces?: boolean }) {
  if (!candidate) {
    return false;
  }
  if (candidate.length > 4096) {
    return false;
  }
  if (!opts?.allowSpaces && /\s/.test(candidate)) {
    return false;
  }
  if (/^https?:\/\//i.test(candidate)) {
    return true;
  }

  // Allow paths within ~/.openclaw/ (the app's own data directory).
  // loadWebMedia already handles tilde expansion; we scope to .openclaw to
  // prevent arbitrary home-directory LFI.
  if (candidate.startsWith("~/.openclaw/") && !candidate.includes("..")) {
    return true;
  }

  // Local paths: only allow safe relative paths starting with ./ that do not traverse upwards.
  return candidate.startsWith("./") && !candidate.includes("..");
}

function unwrapQuoted(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return undefined;
  }
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (first !== last) {
    return undefined;
  }
  if (first !== `"` && first !== "'" && first !== "`") {
    return undefined;
  }
  return trimmed.slice(1, -1).trim();
}

// Check if a character offset is inside any fenced code block
function isInsideFence(fenceSpans: Array<{ start: number; end: number }>, offset: number): boolean {
  return fenceSpans.some((span) => offset >= span.start && offset < span.end);
}

export function splitMediaFromOutput(raw: string): {
  text: string;
  mediaUrls?: string[];
  mediaUrl?: string; // legacy first item for backward compatibility
  audioAsVoice?: boolean; // true if [[audio_as_voice]] tag was found
} {
  // KNOWN: Leading whitespace is semantically meaningful in Markdown (lists, indented fences).
  // We only trim the end; token cleanup below handles removing `MEDIA:` lines.
  const trimmedRaw = raw.trimEnd();
  if (!trimmedRaw.trim()) {
    return { text: "" };
  }

  const media: string[] = [];
  let foundMediaToken = false;

  // Parse fenced code blocks to avoid extracting MEDIA tokens from inside them
  const fenceSpans = parseFenceSpans(trimmedRaw);

  // Collect tokens line by line so we can strip them cleanly.
  const lines = trimmedRaw.split("\n");
  const keptLines: string[] = [];

  let lineOffset = 0; // Track character offset for fence checking
  for (const line of lines) {
    // Skip MEDIA extraction if this line is inside a fenced code block
    if (isInsideFence(fenceSpans, lineOffset)) {
      keptLines.push(line);
      lineOffset += line.length + 1; // +1 for newline
      continue;
    }

    const trimmedStart = line.trimStart();
    if (!trimmedStart.startsWith("MEDIA:")) {
      keptLines.push(line);
      lineOffset += line.length + 1; // +1 for newline
      continue;
    }

    const matches = Array.from(line.matchAll(MEDIA_TOKEN_RE));
    if (matches.length === 0) {
      keptLines.push(line);
      lineOffset += line.length + 1; // +1 for newline
      continue;
    }

    const pieces: string[] = [];
    let cursor = 0;

    for (const match of matches) {
      const start = match.index ?? 0;
      pieces.push(line.slice(cursor, start));

      const payload = match[1];
      const unwrapped = unwrapQuoted(payload);
      const payloadValue = unwrapped ?? payload;
      const parts = unwrapped ? [unwrapped] : payload.split(/\s+/).filter(Boolean);
      const mediaStartIndex = media.length;
      let validCount = 0;
      const invalidParts: string[] = [];
      let hasValidMedia = false;
      for (const part of parts) {
        const candidate = normalizeMediaSource(cleanCandidate(part));
        if (isValidMedia(candidate, unwrapped ? { allowSpaces: true } : undefined)) {
          media.push(candidate);
          hasValidMedia = true;
          foundMediaToken = true;
          validCount += 1;
        } else {
          invalidParts.push(part);
        }
      }

      const trimmedPayload = payloadValue.trim();
      const looksLikeLocalPath =
        trimmedPayload.startsWith("/") ||
        trimmedPayload.startsWith("./") ||
        trimmedPayload.startsWith("../") ||
        trimmedPayload.startsWith("~") ||
        trimmedPayload.startsWith("file://");
      if (
        !unwrapped &&
        validCount === 1 &&
        invalidParts.length > 0 &&
        /\s/.test(payloadValue) &&
        looksLikeLocalPath
      ) {
        const fallback = normalizeMediaSource(cleanCandidate(payloadValue));
        if (isValidMedia(fallback, { allowSpaces: true })) {
          media.splice(mediaStartIndex, media.length - mediaStartIndex, fallback);
          hasValidMedia = true;
          foundMediaToken = true;
          validCount = 1;
          invalidParts.length = 0;
        }
      }

      if (!hasValidMedia) {
        const fallback = normalizeMediaSource(cleanCandidate(payloadValue));
        if (isValidMedia(fallback, { allowSpaces: true })) {
          media.push(fallback);
          hasValidMedia = true;
          foundMediaToken = true;
          invalidParts.length = 0;
        }
      }

      if (hasValidMedia) {
        if (invalidParts.length > 0) {
          pieces.push(invalidParts.join(" "));
        }
      } else {
        // If no valid media was found in this match, keep the original token text.
        pieces.push(match[0]);
      }

      cursor = start + match[0].length;
    }

    pieces.push(line.slice(cursor));

    const cleanedLine = pieces
      .join("")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    // If the line becomes empty, drop it.
    if (cleanedLine) {
      keptLines.push(cleanedLine);
    }
    lineOffset += line.length + 1; // +1 for newline
  }

  let cleanedText = keptLines
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  // Detect and strip [[audio_as_voice]] tag
  const audioTagResult = parseAudioTag(cleanedText);
  const hasAudioAsVoice = audioTagResult.audioAsVoice;
  if (audioTagResult.hadTag) {
    cleanedText = audioTagResult.text.replace(/\n{2,}/g, "\n").trim();
  }

  if (media.length === 0) {
    // FALLBACK: The AI may format MEDIA tags using Markdown link syntax:
    //   MEDIA: [Kundli Chart](https://oaidalleapiprodscus.blob.core.windows.net/...)
    // or split across lines:
    //   MEDIA:[Kundli
    //   Chart](https://oaidalleapiprodscus...)
    // The line-by-line parser above misses these, so scan the full text as a fallback.

    // Try Markdown link syntax: [text](url)
    const mdLinkRe = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi;
    for (const m of trimmedRaw.matchAll(mdLinkRe)) {
      const url = m[2];
      if (isValidMedia(url)) {
        media.push(url);
        foundMediaToken = true;
        // Remove the entire markdown link from the kept lines
        const fullMatch = m[0];
        const idx = keptLines.findIndex((l) => l.includes(fullMatch) || l.includes(url));
        if (idx !== -1) {
          const cleaned = keptLines[idx].replace(fullMatch, "").trim();
          if (cleaned) {
            keptLines[idx] = cleaned;
          } else {
            keptLines.splice(idx, 1);
          }
        }
      }
    }

    // Try standalone DALL-E URLs anywhere in the text (handles multi-line MEDIA tags)
    if (media.length === 0) {
      const dalleRe = /https:\/\/oaidalleapiprodscus\.[^\s"')]+/gi;
      for (const m of trimmedRaw.matchAll(dalleRe)) {
        const url = m[0].replace(/[)\]]+$/, ""); // strip trailing ) or ]
        if (isValidMedia(url)) {
          media.push(url);
          foundMediaToken = true;
          // Remove lines containing the URL
          for (let i = keptLines.length - 1; i >= 0; i--) {
            if (keptLines[i].includes("oaidalleapiprodscus")) {
              keptLines.splice(i, 1);
            }
          }
          break; // only need the first DALL-E URL
        }
      }
    }

    // Also remove any leftover "MEDIA:" lines that had no valid payload
    if (media.length > 0) {
      for (let i = keptLines.length - 1; i >= 0; i--) {
        if (/^\s*MEDIA:\s*/i.test(keptLines[i]) && keptLines[i].trim().length < 30) {
          keptLines.splice(i, 1);
        }
      }
    }
  }

  if (media.length === 0) {
    const result: ReturnType<typeof splitMediaFromOutput> = {
      // Return cleaned text if we found a media token OR audio tag, otherwise original
      text: foundMediaToken || hasAudioAsVoice ? cleanedText : trimmedRaw,
    };
    if (hasAudioAsVoice) {
      result.audioAsVoice = true;
    }
    return result;
  }

  // Re-clean the text if we modified keptLines in the fallback
  let finalCleanedText = keptLines
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  // Detect and strip [[audio_as_voice]] tag from the re-cleaned text
  const finalAudioResult = parseAudioTag(finalCleanedText);
  if (finalAudioResult.hadTag) {
    finalCleanedText = finalAudioResult.text.replace(/\n{2,}/g, "\n").trim();
  }

  return {
    text: finalCleanedText,
    mediaUrls: media,
    mediaUrl: media[0],
    ...(hasAudioAsVoice || finalAudioResult.audioAsVoice ? { audioAsVoice: true } : {}),
  };
}
