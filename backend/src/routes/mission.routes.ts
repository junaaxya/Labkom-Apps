import { Router } from "express";
import { MissionController } from "../controllers/mission.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, MissionController.getAllMissions);
router.get("/stats", authenticate, MissionController.getMissionStats);
router.get("/my", authenticate, authorize("ASISTEN_LAB"), MissionController.getMyMissions);
router.get("/leaderboard", authenticate, MissionController.getLeaderboard);
router.get("/:id", authenticate, MissionController.getMissionById);
router.post("/", authenticate, authorize("KOORDINATOR_LAB"), MissionController.createMission);
router.patch("/:id", authenticate, authorize("KOORDINATOR_LAB"), MissionController.updateMission);
router.delete("/:id", authenticate, authorize("KOORDINATOR_LAB"), MissionController.deleteMission);
router.patch("/:id/claim", authenticate, authorize("ASISTEN_LAB"), MissionController.claimMission);
router.patch("/claims/:claimId/submit", authenticate, authorize("ASISTEN_LAB"), MissionController.submitMission);
router.patch("/claims/:claimId/verify", authenticate, authorize("KOORDINATOR_LAB"), MissionController.verifyMission);

export default router;
