import fs from "fs";
import type { NextFunction, Request, Response } from "express";
import type { AgentUpdateStatus } from "@prisma/client";
import { AgentUpdaterService } from "../services/agent-updater.service";

function param(req: Request, key: string): string { const value = req.params[key]; return Array.isArray(value) ? value[0] : value; }
function header(req: Request, name: string): string { const value = req.headers[name]; return Array.isArray(value) ? value[0] : value || ""; }
function fail(res: Response, error: unknown, status = 400): void { res.status(status).json({ success: false, message: error instanceof Error ? error.message : "Request gagal" }); }

export class AgentUpdaterController {
  static async check(req: Request, res: Response) {
    try {
      const pc = req.pc!;
      const data = await AgentUpdaterService.checkUpdate(pc.id, pc.pcCode, header(req, "x-agent-version"), header(req, "x-updater-version"));
      res.setHeader("Cache-Control", "no-store");
      res.json({ success: true, data });
    } catch (error) { fail(res, error); }
  }

  static async status(req: Request, res: Response) {
    try {
      const { attemptId, status, message } = req.body;
      if (typeof attemptId !== "string" || typeof status !== "string") throw new Error("attemptId dan status wajib");
      const data = await AgentUpdaterService.reportStatus(req.pc!.id, attemptId, status as AgentUpdateStatus, message);
      res.json({ success: true, data });
    } catch (error) { fail(res, error); }
  }

  static async download(req: Request, res: Response, next: NextFunction) {
    try {
      const { release, path: artifactPath } = await AgentUpdaterService.artifact(param(req, "version"));
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Length", String(release.sizeBytes));
      res.setHeader("Content-Disposition", `attachment; filename="${release.artifactFilename}"`);
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      fs.createReadStream(artifactPath).on("error", next).pipe(res);
    } catch (error) { fail(res, error, 404); }
  }

  static async releases(_req: Request, res: Response) {
    try { res.json({ success: true, data: await AgentUpdaterService.listReleases() }); }
    catch (error) { fail(res, error, 500); }
  }

  static async upload(req: Request, res: Response) {
    try {
      if (!req.file) throw new Error("Artifact ZIP wajib");
      const data = await AgentUpdaterService.createRelease({
        version: req.body.version, platform: req.body.platform || "windows", architecture: req.body.architecture || "x86_64",
        minimumUpdaterVersion: req.body.minimumUpdaterVersion || "1.0.0", mandatory: req.body.mandatory === "true",
        file: req.file, createdById: req.user!.userId,
      });
      res.status(201).json({ success: true, data });
    } catch (error) { fail(res, error); }
  }

  static async publish(req: Request, res: Response) {
    try { res.json({ success: true, data: await AgentUpdaterService.publishRelease(param(req, "id")) }); }
    catch (error) { fail(res, error); }
  }

  static async rollouts(_req: Request, res: Response) {
    try { res.json({ success: true, data: await AgentUpdaterService.listRollouts() }); }
    catch (error) { fail(res, error, 500); }
  }

  static async createRollout(req: Request, res: Response) {
    try { res.status(201).json({ success: true, data: await AgentUpdaterService.createRollout({ ...req.body, createdById: req.user!.userId }) }); }
    catch (error) { fail(res, error); }
  }

  static async action(req: Request, res: Response) {
    try {
      const action = param(req, "action");
      if (!(["pause", "resume", "cancel"] as string[]).includes(action)) throw new Error("Action rollout tidak valid");
      res.json({ success: true, data: await AgentUpdaterService.setRolloutStatus(param(req, "id"), action as "pause" | "resume" | "cancel") });
    } catch (error) { fail(res, error); }
  }

  static async rollback(req: Request, res: Response) {
    try { res.json({ success: true, data: await AgentUpdaterService.requestRollback(param(req, "id")) }); }
    catch (error) { fail(res, error); }
  }
}
