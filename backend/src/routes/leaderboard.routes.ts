import { Router } from "express";
import { LeaderboardController } from "../controllers/leaderboard.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, LeaderboardController.getLeaderboard);
router.get("/stats", authenticate, authorize("KOORDINATOR_LAB"), LeaderboardController.getOverallStats);
router.get("/user/:userId", authenticate, LeaderboardController.getUserStats);

export default router;
