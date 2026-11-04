import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AcademicAuthorizationError, AcademicConflictError, AcademicValidationError } from "../services/academic.service";
import { SmartAcademicService } from "../services/smart-academic.service";
import { assignSmartAcademicPjSchema, reportSmartAcademicOccurrenceSchema, requestSmartAcademicMoveSchema, reviewSmartAcademicMoveSchema } from "../validators/smart-academic.validator";

function actor(req: Request) { return { userId: req.user!.userId, role: req.user!.role, ipAddress: req.ip }; }
function param(req: Request, name: string) { const value = req.params[name]; return Array.isArray(value) ? value[0] : value; }
function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof ZodError) return res.status(400).json({ success: false, message: "Validasi gagal", errors: error.issues });
  if (error instanceof AcademicValidationError) return res.status(400).json({ success: false, message: error.message });
  if (error instanceof AcademicAuthorizationError) return res.status(403).json({ success: false, message: error.message });
  if (error instanceof AcademicConflictError) return res.status(409).json({ success: false, message: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ success: false, message: "Data sudah terdaftar" });
  return res.status(400).json({ success: false, message: error instanceof Error ? error.message : fallback });
}

export class SmartAcademicController {
  static async schedules(req: Request, res: Response) { try { res.json({ success: true, data: await SmartAcademicService.listSchedules(actor(req)) }); } catch (error) { fail(res, error, "Gagal memuat jadwal akademik"); } }
  static async classmates(req: Request, res: Response) { try { res.json({ success: true, data: await SmartAcademicService.listClassmates(param(req, "scheduleId"), actor(req)) }); } catch (error) { fail(res, error, "Gagal memuat anggota kelas"); } }
  static async assignPj(req: Request, res: Response) { try { const body = assignSmartAcademicPjSchema.parse(req.body); res.status(201).json({ success: true, data: await SmartAcademicService.assignPj(param(req, "scheduleId"), body.studentId, actor(req)) }); } catch (error) { fail(res, error, "Gagal menetapkan PJ"); } }
  static async removePj(req: Request, res: Response) { try { res.json({ success: true, data: await SmartAcademicService.removePj(param(req, "scheduleId"), param(req, "studentId"), actor(req)) }); } catch (error) { fail(res, error, "Gagal menghapus PJ"); } }
  static async report(req: Request, res: Response) { try { const body = reportSmartAcademicOccurrenceSchema.parse(req.body); res.status(201).json({ success: true, data: await SmartAcademicService.report(body, actor(req)) }); } catch (error) { fail(res, error, "Gagal melaporkan pertemuan"); } }
  static async reports(req: Request, res: Response) { try { res.json({ success: true, data: await SmartAcademicService.listReports(actor(req)) }); } catch (error) { fail(res, error, "Gagal memuat laporan pertemuan"); } }
  static async requestMove(req: Request, res: Response) { try { const body = requestSmartAcademicMoveSchema.parse(req.body); res.status(201).json({ success: true, data: await SmartAcademicService.requestMove(body, actor(req)) }); } catch (error) { fail(res, error, "Gagal mengajukan pemajuan jadwal"); } }
  static async moves(req: Request, res: Response) { try { res.json({ success: true, data: await SmartAcademicService.listMoves(actor(req)) }); } catch (error) { fail(res, error, "Gagal memuat pengajuan"); } }
  static async review(req: Request, res: Response) { try { const body = reviewSmartAcademicMoveSchema.parse(req.body); res.json({ success: true, data: await SmartAcademicService.reviewMove(param(req, "id"), body, actor(req)) }); } catch (error) { fail(res, error, "Gagal meninjau pengajuan"); } }
}
