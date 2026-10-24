import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AcademicAuthorizationError, AcademicConflictError, AcademicService } from "../services/academic.service";
import { AcademicBindingService } from "../services/academic-binding.service";
import { AcademicOccurrenceService } from "../services/academic-occurrence.service";
import {
  academicLeaderQuerySchema,
  academicMembershipQuerySchema,
  academicOfferingQuerySchema,
  academicPjQuerySchema,
  academicReportQuerySchema,
  assignAcademicLeaderSchema,
  assignAcademicPjSchema,
  bindAcademicScheduleSchema,
  createAcademicOccurrenceReleaseSchema,
  createAcademicSlotRequestSchema,
  createAcademicClassSchema,
  createAcademicCourseSchema,
  createAcademicDosenSchema,
  createAcademicMembershipSchema,
  createAcademicOfferingSchema,
  createAcademicReportSchema,
  createAcademicTermSchema,
  updateAcademicClassSchema,
  updateAcademicCourseSchema,
  updateAcademicDosenSchema,
  updateAcademicLeaderSchema,
  updateAcademicMembershipSchema,
  updateAcademicOfferingSchema,
  updateAcademicPjSchema,
  updateAcademicReportSchema,
  updateAcademicTermSchema,
  reviewAcademicSlotRequestSchema,
} from "../validators/academic.validator";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function getActor(req: Request) {
  return { userId: req.user!.userId, role: req.user!.role, ipAddress: req.ip };
}

function sendError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof ZodError) {
    res.status(400).json({ success: false, message: "Validasi gagal", errors: error.issues });
    return;
  }
  if (error instanceof AcademicConflictError) {
    res.status(409).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof AcademicAuthorizationError) {
    res.status(403).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ success: false, message: "Data akademik sudah terdaftar" });
      return;
    }
    if (error.code === "P2025") {
      res.status(404).json({ success: false, message: "Data akademik tidak ditemukan" });
      return;
    }
  }
  res.status(400).json({ success: false, message: error instanceof Error ? error.message : fallback });
}

export class AcademicController {
  static async listDosen(_req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await AcademicService.listDosen() });
    } catch (error) {
      sendError(res, error, "Gagal mengambil data dosen");
    }
  }

  static async createDosen(req: Request, res: Response): Promise<void> {
    try {
      const data = createAcademicDosenSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicService.createDosen(data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal membuat dosen");
    }
  }

  static async updateDosen(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAcademicDosenSchema.parse(req.body);
      res.json({ success: true, data: await AcademicService.updateDosen(getParam(req, "id"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengubah dosen");
    }
  }

  static async listTerms(_req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await AcademicService.listTerms() });
    } catch (error) {
      sendError(res, error, "Gagal mengambil term akademik");
    }
  }

  static async createTerm(req: Request, res: Response): Promise<void> {
    try {
      const data = createAcademicTermSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicService.createTerm(data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal membuat term akademik");
    }
  }

  static async updateTerm(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAcademicTermSchema.parse(req.body);
      res.json({ success: true, data: await AcademicService.updateTerm(getParam(req, "id"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengubah term akademik");
    }
  }

  static async listCourses(_req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await AcademicService.listCourses() });
    } catch (error) {
      sendError(res, error, "Gagal mengambil mata kuliah");
    }
  }

  static async createCourse(req: Request, res: Response): Promise<void> {
    try {
      const data = createAcademicCourseSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicService.createCourse(data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal membuat mata kuliah");
    }
  }

  static async updateCourse(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAcademicCourseSchema.parse(req.body);
      res.json({ success: true, data: await AcademicService.updateCourse(getParam(req, "id"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengubah mata kuliah");
    }
  }

  static async listClasses(_req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await AcademicService.listClasses() });
    } catch (error) {
      sendError(res, error, "Gagal mengambil kelas akademik");
    }
  }

  static async createClass(req: Request, res: Response): Promise<void> {
    try {
      const data = createAcademicClassSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicService.createClass(data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal membuat kelas akademik");
    }
  }

  static async updateClass(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAcademicClassSchema.parse(req.body);
      res.json({ success: true, data: await AcademicService.updateClass(getParam(req, "id"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengubah kelas akademik");
    }
  }

  static async listMemberships(req: Request, res: Response): Promise<void> {
    try {
      const query = academicMembershipQuerySchema.parse(req.query);
      res.json({ success: true, data: await AcademicService.listMemberships(query) });
    } catch (error) {
      sendError(res, error, "Gagal mengambil keanggotaan kelas");
    }
  }

  static async createMembership(req: Request, res: Response): Promise<void> {
    try {
      const data = createAcademicMembershipSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicService.createMembership(data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal membuat keanggotaan kelas");
    }
  }

  static async updateMembership(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAcademicMembershipSchema.parse(req.body);
      res.json({ success: true, data: await AcademicService.updateMembership(getParam(req, "id"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengubah keanggotaan kelas");
    }
  }

  static async listLeaders(req: Request, res: Response): Promise<void> {
    try {
      const query = academicLeaderQuerySchema.parse(req.query);
      res.json({ success: true, data: await AcademicService.listLeaders(query) });
    } catch (error) {
      sendError(res, error, "Gagal mengambil ketua kelas");
    }
  }

  static async assignLeader(req: Request, res: Response): Promise<void> {
    try {
      const data = assignAcademicLeaderSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicService.assignLeader(data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal menetapkan ketua kelas");
    }
  }

  static async updateLeader(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAcademicLeaderSchema.parse(req.body);
      res.json({ success: true, data: await AcademicService.updateLeader(getParam(req, "id"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengubah ketua kelas");
    }
  }

  static async listOfferings(req: Request, res: Response): Promise<void> {
    try {
      const query = academicOfferingQuerySchema.parse(req.query);
      res.json({ success: true, data: await AcademicService.listOfferings(query, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengambil penawaran akademik");
    }
  }

  static async createOffering(req: Request, res: Response): Promise<void> {
    try {
      const data = createAcademicOfferingSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicService.createOffering(data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal membuat penawaran akademik");
    }
  }

  static async updateOffering(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAcademicOfferingSchema.parse(req.body);
      res.json({ success: true, data: await AcademicService.updateOffering(getParam(req, "id"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengubah penawaran akademik");
    }
  }

  static async bindSchedule(req: Request, res: Response): Promise<void> {
    try {
      const input = bindAcademicScheduleSchema.parse(req.body);
      const data = await AcademicBindingService.bindSchedule(getParam(req, "id"), input.scheduleId, getActor(req));
      res.json({ success: true, data });
    } catch (error) {
      sendError(res, error, "Gagal menghubungkan jadwal");
    }
  }

  static async listPjs(req: Request, res: Response): Promise<void> {
    try {
      const query = academicPjQuerySchema.parse(req.query);
      res.json({ success: true, data: await AcademicService.listPjs(query) });
    } catch (error) {
      sendError(res, error, "Gagal mengambil PJ penawaran");
    }
  }

  static async assignPj(req: Request, res: Response): Promise<void> {
    try {
      const data = assignAcademicPjSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicService.assignPj(getParam(req, "offeringId"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal menetapkan PJ penawaran");
    }
  }

  static async updatePj(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAcademicPjSchema.parse(req.body);
      res.json({ success: true, data: await AcademicService.updatePj(getParam(req, "id"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengubah PJ penawaran");
    }
  }

  static async listReports(req: Request, res: Response): Promise<void> {
    try {
      const query = academicReportQuerySchema.parse(req.query);
      res.json({ success: true, data: await AcademicService.listReports(query, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengambil laporan akademik");
    }
  }

  static async getReport(req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await AcademicService.getReport(getParam(req, "id"), getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengambil laporan akademik");
    }
  }

  static async createReport(req: Request, res: Response): Promise<void> {
    try {
      const data = createAcademicReportSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicService.createReport(data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal membuat laporan akademik");
    }
  }

  static async updateReport(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAcademicReportSchema.parse(req.body);
      res.json({ success: true, data: await AcademicService.updateReport(getParam(req, "id"), data, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengubah laporan akademik");
    }
  }

  static async releaseOccurrence(req: Request, res: Response): Promise<void> {
    try {
      const input = createAcademicOccurrenceReleaseSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicOccurrenceService.release(input.reportId, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal melepas slot pertemuan");
    }
  }

  static async listOccurrenceReleases(req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await AcademicOccurrenceService.listReleases(getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengambil slot rilis");
    }
  }

  static async createSlotRequest(req: Request, res: Response): Promise<void> {
    try {
      const input = createAcademicSlotRequestSchema.parse(req.body);
      res.status(201).json({ success: true, data: await AcademicOccurrenceService.requestSlot(input, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal membuat pengajuan slot");
    }
  }

  static async listSlotRequests(req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await AcademicOccurrenceService.listRequests(getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal mengambil pengajuan slot");
    }
  }

  static async reviewSlotRequest(req: Request, res: Response): Promise<void> {
    try {
      const input = reviewAcademicSlotRequestSchema.parse(req.body);
      res.json({ success: true, data: await AcademicOccurrenceService.reviewRequest(getParam(req, "id"), input, getActor(req)) });
    } catch (error) {
      sendError(res, error, "Gagal meninjau pengajuan slot");
    }
  }
}
