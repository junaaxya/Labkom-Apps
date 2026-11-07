import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { AgentUpdaterController } from "../controllers/agent-updater.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { AGENT_RELEASE_MAX_BYTES } from "../services/agent-updater.service";

const router = Router();
const ciLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const artifact = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: AGENT_RELEASE_MAX_BYTES },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype === "application/zip" || file.originalname.toLowerCase().endsWith(".zip")),
});
function uploadArtifact(req: Request, res: Response, next: NextFunction): void {
  artifact.single("artifact")(req, res, (error) => {
    if (!error) return next();
    const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? "Artifact maksimal 50 MB" : error.message;
    res.status(400).json({ success: false, message });
  });
}

// CI route sits before JWT middleware: it authenticates with X-Agent-CI-Token instead.
router.post("/releases/ci", ciLimiter, uploadArtifact, AgentUpdaterController.ciUpload);

router.use(authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"));
router.get("/releases", AgentUpdaterController.releases);
router.get("/rollouts", AgentUpdaterController.rollouts);
router.post("/releases", authorize("KOORDINATOR_LAB"), uploadArtifact, AgentUpdaterController.upload);
router.post("/releases/sync-github", authorize("KOORDINATOR_LAB"), AgentUpdaterController.syncGithub);
router.patch("/releases/:id/publish", authorize("KOORDINATOR_LAB"), AgentUpdaterController.publish);
router.post("/rollouts", authorize("KOORDINATOR_LAB"), AgentUpdaterController.createRollout);
router.patch("/rollouts/:id/:action", authorize("KOORDINATOR_LAB"), AgentUpdaterController.action);
router.post("/rollouts/:id/rollback", authorize("KOORDINATOR_LAB"), AgentUpdaterController.rollback);

export default router;
