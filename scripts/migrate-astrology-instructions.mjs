import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_BYTES = 128 * 1024;
export const REVIEWED_REVISIONS = {
  "AGENTS.md": {
    previous: [
      "3bfa2c4b03400acbb6b34b6e54fd5efdfc33f228d384fc00e7e82bbf4d41b75b",
      "81338ac526bd54527d76b298f253ec027b5fc971caa89fe0e6d2b98ef0dabb65",
      "d764c1b738f12c52e4c1cee703c421e1ba2e464593d22b305a810a8e3c6fd2a5",
      "cd1d11716dea93cb0d584b3a81225ad75d7fedcef12d5bf40b73f62b3e6486b4",
    ],
    replacement: "0eaa28b471b240426d127cac5296bb108627cfdb74ce2c0380ada24eed310d96",
  },
  "SOUL.md": {
    previous: [
      "a787b8079c8066fdb628b2da56018ba4ecbf924722924b16c422fa8542a45f8f",
      "51f9f0c3d5561a23a2ca29f9a32799b45b2d49b37d1ff9d5046b1747ce75cbc5",
    ],
    replacement: "1231d9b3fc50a4bdb02de01c0a1be6b7f33997b6bba341251a7ab0ea8f1e97b8",
  },
};

export function instructionHash(bytes) {
  return createHash("sha256").update(bytes.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
}

function regularFile(file) {
  const stat = fs.lstatSync(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    fs.realpathSync(file) !== file ||
    stat.size > MAX_BYTES
  ) {
    throw new Error("Unsafe astrology instruction file");
  }
  return fs.readFileSync(file);
}

function syncDirectory(directory) {
  if (process.platform === "win32") {
    return; // Windows does not expose directory fsync through this API.
  }
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function migrateAstrologyInstructions(appDir, stateDir, revisions = REVIEWED_REVISIONS) {
  const plans = [],
    report = [];
  // Only these two names can be migrated. No directory-wide persona copy.
  for (const name of ["AGENTS.md", "SOUL.md"]) {
    const target = path.resolve(stateDir, "workspace-astrologer", name);
    if (!fs.existsSync(target)) {
      report.push({ file: name, status: "absent_preserved" });
      continue;
    }
    const original = regularFile(target),
      revision = revisions[name];
    const current = instructionHash(original);
    if (current === revision.replacement) {
      report.push({ file: name, status: "already_current" });
      continue;
    }
    const predecessors = Array.isArray(revision.previous) ? revision.previous : [revision.previous];
    if (!predecessors.includes(current)) {
      report.push({ file: name, status: "customized_preserved" });
      continue;
    }
    const source = path.resolve(appDir, "bootstrap/instruction-source", name);
    const replacement = regularFile(source);
    if (instructionHash(replacement) !== revision.replacement) {
      throw new Error("Unreviewed bundled astrology instruction revision");
    }
    plans.push({
      name,
      target,
      original,
      replacement,
      revision: { ...revision, previous: current },
    });
  }
  // Validate both plans and preserve both original files before replacing any.
  const backupDir = path.resolve(stateDir, "instruction-backups");
  if (plans.length) {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    if (fs.realpathSync(backupDir) !== backupDir) {
      throw new Error("Redirected instruction backup directory");
    }
  }
  for (const plan of plans) {
    const backup = path.join(backupDir, `${plan.name}.${plan.revision.previous}`);
    if (fs.existsSync(backup)) {
      if (!regularFile(backup).equals(plan.original)) {
        throw new Error("Existing instruction backup differs");
      }
    } else {
      const descriptor = fs.openSync(backup, "wx", 0o600);
      try {
        fs.writeFileSync(descriptor, plan.original);
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
    }
  }
  if (plans.length) {
    syncDirectory(backupDir);
  }
  for (const plan of plans) {
    const temporary = `${plan.target}.instruction-${process.pid}`;
    let descriptor,
      created = false;
    try {
      descriptor = fs.openSync(temporary, "wx", 0o600);
      created = true;
      fs.writeFileSync(descriptor, plan.replacement);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      if (!regularFile(plan.target).equals(plan.original)) {
        throw new Error("Instruction changed during migration");
      }
      fs.renameSync(temporary, plan.target);
      syncDirectory(path.dirname(plan.target));
      report.push({ file: plan.name, status: "reviewed_revision_migrated" });
    } finally {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
      }
      if (created && fs.existsSync(temporary)) {
        fs.unlinkSync(temporary);
      }
    }
  }
  return report;
}
