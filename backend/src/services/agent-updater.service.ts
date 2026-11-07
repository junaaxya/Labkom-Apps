import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import type { AgentUpdateStatus, Prisma } from "@prisma/client";
import prisma from "../config/database";
import { config } from "../config";

export const AGENT_RELEASE_MAX_BYTES = 50 * 1024 * 1024;
export const AGENT_RELEASE_DIR = path.join(config.uploadDir, "agent-releases");
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;
const TERMINAL = new Set<AgentUpdateStatus>(["SUCCEEDED", "FAILED", "ROLLED_BACK", "CANCELLED"]);
const TRANSITIONS: Record<AgentUpdateStatus, AgentUpdateStatus[]> = {
  PENDING: ["DOWNLOADING", "FAILED", "CANCELLED"],
  DOWNLOADING: ["VERIFYING", "FAILED", "CANCELLED"],
  VERIFYING: ["INSTALLING", "FAILED", "CANCELLED"],
  INSTALLING: ["AWAITING_HEARTBEAT", "FAILED", "ROLLING_BACK"],
  AWAITING_HEARTBEAT: ["FAILED", "ROLLING_BACK"],
  SUCCEEDED: ["ROLLING_BACK"],
  FAILED: ["ROLLING_BACK"],
  ROLLING_BACK: ["ROLLED_BACK", "FAILED"],
  ROLLED_BACK: [],
  CANCELLED: [],
};

export function requireSemver(value: unknown, field: string): string {
  if (typeof value !== "string" || !SEMVER.test(value)) throw new Error(`${field} harus SemVer MAJOR.MINOR.PATCH`);
  return value;
}

function semverParts(value: string): number[] { return value.split(".", 3).map((part) => Number.parseInt(part, 10)); }
export function compareSemver(a: string, b: string): number {
  const left = semverParts(requireSemver(a, "version"));
  const right = semverParts(requireSemver(b, "version"));
  for (let i = 0; i < 3; i += 1) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}

function canonicalManifest(data: {
  version: string; platform: string; architecture: string; sha256: string; sizeBytes: number;
  minimumUpdaterVersion: string; mandatory: boolean;
}): string {
  return JSON.stringify({
    version: data.version,
    platform: data.platform,
    architecture: data.architecture,
    sha256: data.sha256,
    sizeBytes: data.sizeBytes,
    minimumUpdaterVersion: data.minimumUpdaterVersion,
    mandatory: data.mandatory,
  });
}

function ownHttpsBase(): URL {
  const url = new URL(config.appUrl);
  if (config.nodeEnv === "production" && url.protocol !== "https:") throw new Error("APP_URL updater wajib HTTPS pada production");
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error("APP_URL updater tidak valid");
  return url;
}

function signingPublicKey(): string {
  const encoded = process.env.AGENT_RELEASE_SIGNING_PRIVATE_KEY_BASE64;
  if (!encoded) throw new Error("AGENT_RELEASE_SIGNING_PRIVATE_KEY_BASE64 belum dikonfigurasi");
  const privateKey = crypto.createPrivateKey({ key: Buffer.from(encoded, "base64"), format: "der", type: "pkcs8" });
  return crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" }).toString("base64");
}

function signManifest(data: Parameters<typeof canonicalManifest>[0]): string {
  const encoded = process.env.AGENT_RELEASE_SIGNING_PRIVATE_KEY_BASE64;
  if (!encoded) throw new Error("AGENT_RELEASE_SIGNING_PRIVATE_KEY_BASE64 belum dikonfigurasi");
  const privateKey = crypto.createPrivateKey({ key: Buffer.from(encoded, "base64"), format: "der", type: "pkcs8" });
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("Signing key harus Ed25519 PKCS8 DER Base64");
  return crypto.sign(null, Buffer.from(canonicalManifest(data)), privateKey).toString("base64");
}

function safeArtifactFilename(version: string): string { return `labkom-agent-${version}.zip`; }
export function canTransitionUpdate(from: AgentUpdateStatus, to: AgentUpdateStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Constant-time CI token check; hashes first so differing lengths never leak via timingSafeEqual. */
export function verifyCiToken(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string" || !provided || !expected) return false;
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Exactly the files updater.py accepts (ALLOWED_FILES); any extra entry makes the agent reject the ZIP.
export const AGENT_BUNDLE_FILES = ["agent.py", "requirements.txt", "updater.py", "VERSION"] as const;

// ponytail: STORE-only ZIP (no compression) via stdlib zlib.crc32; agent bundle is a few KB. Switch to deflateRawSync if bundles grow large.
export function buildZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const crc = zlib.crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(file.data.length, 18); local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(file.data.length, 20); central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, file.data);
    centrals.push(central, name);
    offset += local.length + name.length + file.data.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

export function githubVersion(tag: unknown): string {
  return requireSemver(typeof tag === "string" ? tag.trim().replace(/^v/i, "") : tag, "Versi GitHub");
}

function githubRepo(): string {
  const repo = process.env.AGENT_GITHUB_REPO || "junaaxya/labkom-agents";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("AGENT_GITHUB_REPO harus berformat owner/repo");
  return repo;
}

async function githubFetch(url: string, accept: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: accept, "User-Agent": "labkom-agent-updater", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(30_000) });
}

async function githubBuffer(url: string, accept: string): Promise<Buffer> {
  const res = await githubFetch(url, accept);
  if (!res.ok) throw new Error(`GitHub ${res.status} saat mengambil ${new URL(url).pathname}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > AGENT_RELEASE_MAX_BYTES) throw new Error("Artifact GitHub melebihi 50 MB");
  return buffer;
}

function safeMessage(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("message harus string");
  return value.trim().slice(0, 1000);
}

export class AgentUpdaterService {
  static async createRelease(input: {
    version: string; platform: string; architecture: string; minimumUpdaterVersion: string;
    mandatory: boolean; file: Pick<Express.Multer.File, "buffer" | "size">; createdById: string;
  }) {
    const version = requireSemver(input.version, "version");
    const minimumUpdaterVersion = requireSemver(input.minimumUpdaterVersion, "minimumUpdaterVersion");
    if (!/^[a-z0-9_-]{2,30}$/i.test(input.platform) || !/^[a-z0-9_-]{2,30}$/i.test(input.architecture)) throw new Error("Platform/architecture tidak valid");
    if (!input.file || input.file.size < 4 || input.file.size > AGENT_RELEASE_MAX_BYTES) throw new Error("Artifact ZIP wajib dan maksimal 50 MB");
    if (input.file.buffer[0] !== 0x50 || input.file.buffer[1] !== 0x4b) throw new Error("Artifact harus ZIP valid");
    const sha256 = crypto.createHash("sha256").update(input.file.buffer).digest("hex");
    const artifactFilename = safeArtifactFilename(version);
    const base = ownHttpsBase();
    const artifactUrl = new URL(`/api/v1/pcs/agent/releases/${version}/download`, base).toString();
    const metadata = { version, platform: input.platform, architecture: input.architecture, sha256, sizeBytes: input.file.size, minimumUpdaterVersion, mandatory: input.mandatory };
    const signature = signManifest(metadata);
    await fs.mkdir(AGENT_RELEASE_DIR, { recursive: true });
    const finalPath = path.join(AGENT_RELEASE_DIR, artifactFilename);
    await fs.writeFile(finalPath, input.file.buffer, { flag: "wx", mode: 0o640 });
    try {
      return await prisma.agentRelease.create({ data: { ...metadata, artifactFilename, artifactUrl, signature, createdById: input.createdById } });
    } catch (error) {
      await fs.unlink(finalPath).catch(() => undefined);
      throw error;
    }
  }

  /** Idempotent: published version is returned as-is; otherwise create (if new) and publish when autoPublish (default true). */
  static async importRelease(input: {
    version: string; buffer: Buffer; createdById?: string; minimumUpdaterVersion?: string; mandatory?: boolean;
    platform?: string; architecture?: string; autoPublish?: boolean;
  }) {
    const version = requireSemver(input.version, "version");
    const autoPublish = input.autoPublish ?? true;
    const existing = await prisma.agentRelease.findUnique({ where: { version } });
    if (existing?.isPublished || (existing && !autoPublish)) return { release: existing, created: false };
    if (existing) return { release: await AgentUpdaterService.publishRelease(existing.id), created: false };
    const createdById = input.createdById ?? (await prisma.user.findFirst({ where: { role: "KOORDINATOR_LAB", isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id;
    if (!createdById) throw new Error("Tidak ada koordinator aktif untuk pemilik release CI");
    const draft = await AgentUpdaterService.createRelease({
      version, platform: input.platform || "windows", architecture: input.architecture || "x86_64",
      minimumUpdaterVersion: input.minimumUpdaterVersion || "1.0.0", mandatory: input.mandatory ?? false,
      file: { buffer: input.buffer, size: input.buffer.length }, createdById,
    });
    return { release: autoPublish ? await AgentUpdaterService.publishRelease(draft.id) : draft, created: true };
  }

  /** Latest GitHub Release ZIP asset, else bundle AGENT_BUNDLE_FILES from the branch. Works tokenless for public repos. */
  static async syncFromGithub(createdById: string) {
    const repo = githubRepo();
    const api = `https://api.github.com/repos/${repo}`;
    const latest = await githubFetch(`${api}/releases/latest`, "application/vnd.github+json");
    if (latest.ok) {
      const body = await latest.json() as { tag_name?: string; assets?: Array<{ name: string; url: string }> };
      const asset = body.assets?.find((item) => item.name.toLowerCase().endsWith(".zip"));
      if (asset) {
        const buffer = await githubBuffer(asset.url, "application/octet-stream");
        return { ...await AgentUpdaterService.importRelease({ version: githubVersion(body.tag_name), buffer, createdById }), source: "release" as const, repo };
      }
    } else if (latest.status !== 404) {
      throw new Error(`GitHub ${latest.status} saat membaca release terbaru ${repo}`);
    }
    const ref = encodeURIComponent(process.env.AGENT_GITHUB_REF || "main");
    const files = await Promise.all(AGENT_BUNDLE_FILES.map(async (name) => ({ name, data: await githubBuffer(`${api}/contents/${name}?ref=${ref}`, "application/vnd.github.raw") })));
    const version = githubVersion(files.find((file) => file.name === "VERSION")!.data.toString("ascii"));
    return { ...await AgentUpdaterService.importRelease({ version, buffer: buildZip(files), createdById }), source: "branch" as const, repo };
  }

  static listReleases() { return prisma.agentRelease.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { rollouts: true } } } }); }

  static async publishRelease(id: string) {
    const release = await prisma.agentRelease.findFirst({ where: { id, isPublished: false } });
    if (!release) throw new Error("Release draft tidak ditemukan");
    const artifactPath = path.join(AGENT_RELEASE_DIR, release.artifactFilename);
    const file = await fs.readFile(artifactPath);
    if (file.length !== release.sizeBytes || crypto.createHash("sha256").update(file).digest("hex") !== release.sha256) throw new Error("Artifact release berubah atau rusak");
    return prisma.agentRelease.update({ where: { id }, data: { isPublished: true, publishedAt: new Date() } });
  }

  static async artifact(version: string) {
    requireSemver(version, "version");
    const release = await prisma.agentRelease.findFirst({ where: { version, isPublished: true } });
    if (!release) throw new Error("Release tidak ditemukan");
    return { release, path: path.join(AGENT_RELEASE_DIR, release.artifactFilename) };
  }

  static async createRollout(input: {
    releaseId: string; scope: "PCS" | "LAB" | "ALL"; pcIds?: string[]; labId?: string;
    rolloutPercent?: number; checkAfterSeconds?: number; createdById: string;
  }) {
    const release = await prisma.agentRelease.findFirst({ where: { id: input.releaseId, isPublished: true } });
    if (!release) throw new Error("Release published tidak ditemukan");
    const rolloutPercent = input.rolloutPercent ?? 100;
    const checkAfterSeconds = input.checkAfterSeconds ?? 600;
    if (!Number.isInteger(rolloutPercent) || rolloutPercent < 1 || rolloutPercent > 100) throw new Error("rolloutPercent harus 1-100");
    if (!Number.isInteger(checkAfterSeconds) || checkAfterSeconds < 60 || checkAfterSeconds > 3600) throw new Error("checkAfterSeconds harus 60-3600");
    if (!["PCS", "LAB", "ALL"].includes(input.scope)) throw new Error("Scope rollout tidak valid");
    if (input.scope === "PCS" && (!input.pcIds?.length || input.pcIds.length > 500)) throw new Error("Target PC wajib 1-500 item");
    if (input.scope === "LAB" && !input.labId) throw new Error("labId wajib untuk scope LAB");
    const where = input.scope === "PCS" ? { id: { in: [...new Set(input.pcIds)] } } : input.scope === "LAB" ? { labId: input.labId } : {};
    const pcs = await prisma.pC.findMany({ where, orderBy: { id: "asc" }, select: { id: true, agentVersion: true } });
    if (!pcs.length) throw new Error("Target PC kosong");
    const busy = await prisma.agentUpdateAssignment.findFirst({ where: { pcId: { in: pcs.map((pc) => pc.id) }, status: { notIn: ["SUCCEEDED", "FAILED", "ROLLED_BACK", "CANCELLED"] } } });
    if (busy) throw new Error("Salah satu PC target masih memiliki update aktif");
    const eligible = pcs.filter((pc) => pc.agentVersion !== release.version);
    if (!eligible.length) throw new Error("Semua PC target sudah memakai release ini");
    const count = Math.max(1, Math.ceil(eligible.length * rolloutPercent / 100));
    const selected = eligible.slice(0, count);
    return prisma.$transaction(async (tx) => {
      const rollout = await tx.agentRollout.create({ data: {
        releaseId: release.id, status: "ACTIVE", scope: input.scope, labId: input.labId,
        pilotPcIds: input.scope === "PCS" ? (input.pcIds || []) : undefined,
        rolloutPercent, checkAfterSeconds, createdById: input.createdById, activatedAt: new Date(),
      } });
      await tx.agentUpdateAssignment.createMany({ data: selected.map((pc) => ({
        rolloutId: rollout.id, pcId: pc.id, targetVersion: release.version,
        currentVersion: pc.agentVersion, rollbackVersion: pc.agentVersion,
      })) });
      return tx.agentRollout.findUniqueOrThrow({ where: { id: rollout.id }, include: { assignments: true, release: true } });
    });
  }

  static listRollouts() {
    return prisma.agentRollout.findMany({ orderBy: { createdAt: "desc" }, include: { release: true, assignments: { include: { pc: { select: { id: true, pcCode: true, name: true, labId: true, agentVersion: true } }, attempts: { orderBy: { updatedAt: "desc" } } } } } });
  }

  static async setRolloutStatus(id: string, action: "pause" | "resume" | "cancel") {
    return prisma.$transaction(async (tx) => {
      const rollout = await tx.agentRollout.findUnique({ where: { id } });
      if (!rollout) throw new Error("Rollout tidak ditemukan");
      const allowed = action === "pause" ? rollout.status === "ACTIVE" : action === "resume" ? rollout.status === "PAUSED" : ["ACTIVE", "PAUSED"].includes(rollout.status);
      if (!allowed) throw new Error(`Rollout ${rollout.status} tidak dapat ${action}`);
      const status = action === "pause" ? "PAUSED" : action === "resume" ? "ACTIVE" : "CANCELLED";
      const updated = await tx.agentRollout.update({ where: { id }, data: { status, completedAt: action === "cancel" ? new Date() : null } });
      if (action === "cancel") await tx.agentUpdateAssignment.updateMany({ where: { rolloutId: id, status: { notIn: ["SUCCEEDED", "FAILED", "ROLLED_BACK", "CANCELLED"] } }, data: { status: "CANCELLED" } });
      return updated;
    });
  }

  static async requestRollback(id: string) {
    return prisma.$transaction(async (tx) => {
      const rollout = await tx.agentRollout.findUnique({ where: { id }, include: { assignments: true } });
      if (!rollout) throw new Error("Rollout tidak ditemukan");
      await tx.agentRollout.update({ where: { id }, data: { status: "ACTIVE", completedAt: null } });
      for (const item of rollout.assignments) {
        if (!item.rollbackVersion) continue;
        const rollbackRelease = await tx.agentRelease.findFirst({ where: { version: item.rollbackVersion, isPublished: true } });
        if (!rollbackRelease) throw new Error(`Release rollback ${item.rollbackVersion} tidak tersedia`);
        await tx.agentUpdateAssignment.update({ where: { id: item.id }, data: { status: "ROLLING_BACK", targetVersion: item.rollbackVersion } });
        await tx.agentUpdateAttempt.upsert({
          where: { assignmentId_targetVersion: { assignmentId: item.id, targetVersion: item.rollbackVersion } },
          create: { assignmentId: item.id, pcId: item.pcId, releaseId: rollbackRelease.id, status: "ROLLING_BACK", currentVersion: item.currentVersion, targetVersion: item.rollbackVersion, rollbackVersion: item.currentVersion },
          update: { status: "ROLLING_BACK", message: null, completedAt: null },
        });
      }
      return { rollbackRequested: rollout.assignments.filter((a) => a.rollbackVersion).length };
    });
  }

  static async checkUpdate(pcId: string, pcCode: string, agentVersion: string, updaterVersion: string) {
    requireSemver(agentVersion, "X-Agent-Version");
    requireSemver(updaterVersion, "X-Updater-Version");
    const assignment = await prisma.agentUpdateAssignment.findFirst({
      where: { pcId, rollout: { status: "ACTIVE", release: { isPublished: true } } },
      orderBy: { assignedAt: "desc" }, include: { rollout: { include: { release: true } }, attempts: true },
    });
    if (!assignment) return { updateAvailable: false, currentVersion: agentVersion, checkAfterSeconds: 600 };
    const release = assignment.targetVersion === assignment.rollout.release.version
      ? assignment.rollout.release
      : await prisma.agentRelease.findFirst({ where: { version: assignment.targetVersion, isPublished: true } });
    if (!release) throw new Error(`Release target ${assignment.targetVersion} tidak tersedia`);
    const attempt = await prisma.agentUpdateAttempt.upsert({
      where: { assignmentId_targetVersion: { assignmentId: assignment.id, targetVersion: assignment.targetVersion } },
      create: { assignmentId: assignment.id, pcId, releaseId: release.id, currentVersion: agentVersion, targetVersion: assignment.targetVersion, rollbackVersion: assignment.rollbackVersion },
      update: {},
    });
    const downloadUrl = `${release.artifactUrl}?pcCode=${encodeURIComponent(pcCode)}`;
    const updateAvailable = !TERMINAL.has(attempt.status) && compareSemver(agentVersion, assignment.targetVersion) !== 0;
    return {
      updateAvailable, currentVersion: agentVersion, attemptId: attempt.id, attemptStatus: attempt.status,
      release: updateAvailable ? { id: release.id, version: assignment.targetVersion, downloadUrl, sha256: release.sha256, sizeBytes: release.sizeBytes, signature: release.signature, signatureAlgorithm: "Ed25519", signingPublicKey: signingPublicKey(), minimumUpdaterVersion: release.minimumUpdaterVersion, mandatory: release.mandatory } : null,
      checkAfterSeconds: assignment.rollout.checkAfterSeconds,
    };
  }

  static async reportStatus(pcId: string, attemptId: string, nextStatus: AgentUpdateStatus, message?: unknown) {
    return prisma.$transaction(async (tx) => {
      const attempt = await tx.agentUpdateAttempt.findFirst({ where: { id: attemptId, pcId }, include: { assignment: true } });
      if (!attempt) throw new Error("Attempt updater tidak ditemukan untuk PC ini");
      if (attempt.status === nextStatus) return attempt;
      if (nextStatus === "SUCCEEDED") throw new Error("SUCCEEDED hanya dapat disahkan oleh heartbeat target");
      if (!canTransitionUpdate(attempt.status, nextStatus)) throw new Error(`Transisi ${attempt.status} ke ${nextStatus} tidak diizinkan`);
      const terminal = TERMINAL.has(nextStatus);
      const cleanMessage = safeMessage(message);
      const updated = await tx.agentUpdateAttempt.update({ where: { id: attempt.id }, data: { status: nextStatus, message: cleanMessage, completedAt: terminal ? new Date() : null } });
      await tx.agentUpdateAssignment.update({ where: { id: attempt.assignmentId }, data: { status: nextStatus, lastError: nextStatus === "FAILED" ? cleanMessage : null } });
      return updated;
    });
  }

  static async recordHeartbeat(pcId: string, agentVersion: string | undefined, pcData: Prisma.PCUpdateInput) {
    return prisma.$transaction(async (tx) => {
      const pc = await tx.pC.update({ where: { id: pcId }, data: pcData });
      if (!agentVersion || !SEMVER.test(agentVersion)) return pc;
      const attempts = await tx.agentUpdateAttempt.findMany({ where: { pcId, status: { in: ["AWAITING_HEARTBEAT", "ROLLING_BACK"] }, targetVersion: agentVersion } });
      for (const attempt of attempts) {
        const status: AgentUpdateStatus = attempt.status === "ROLLING_BACK" ? "ROLLED_BACK" : "SUCCEEDED";
        await tx.agentUpdateAttempt.update({ where: { id: attempt.id }, data: { status, completedAt: new Date(), message: null } });
        await tx.agentUpdateAssignment.update({ where: { id: attempt.assignmentId }, data: { status, currentVersion: agentVersion, lastError: null } });
      }
      return pc;
    });
  }
}
