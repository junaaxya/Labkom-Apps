import prisma from "../config/database";

function nextSemester(current?: string | null): string {
  const parsed = Number(current);
  return Number.isInteger(parsed) && parsed >= 1 && parsed < 14 ? String(parsed + 1) : current || "1";
}

export class AcademicProfileService {
  static async status(userId: string) {
    const [user, activeTerm, classes] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { role: true, registrationSource: true, semester: true, studyProgram: true, className: true, academicProfileCompletedAt: true, academicProfileTermId: true } }),
      prisma.academicTerm.findFirst({ where: { isActive: true }, orderBy: [{ startDate: "desc" }, { createdAt: "desc" }], select: { id: true, code: true, name: true, startDate: true, endDate: true } }),
      prisma.academicClass.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    ]);
    if (!user || user.role !== "MAHASISWA" || user.registrationSource !== "EXTERNAL_SELF_REGISTRATION") return { required: false };
    const required = !user.academicProfileCompletedAt || !user.semester || !user.studyProgram || !user.className || (activeTerm && user.academicProfileTermId !== activeTerm.id);
    return {
      required,
      activeTerm,
      classes,
      current: { semester: user.semester, studyProgram: user.studyProgram, className: user.className },
      suggestedSemester: user.academicProfileCompletedAt && activeTerm && user.academicProfileTermId !== activeTerm.id ? nextSemester(user.semester) : user.semester || "1",
      calendarUrl: "https://akademik.unmuhbabel.ac.id/kalender-akademik/",
    };
  }

  static async complete(userId: string, input: { semester: string; studyProgram: string; className: string }) {
    const status = await this.status(userId);
    if (!("required" in status) || !status.required) throw new Error("Profil akademik tidak perlu diperbarui");
    const selectedClass = "classes" in status ? status.classes?.find((item) => item.code === input.className || item.name === input.className) : null;
    const className = selectedClass?.code || input.className.trim();
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { semester: input.semester, studyProgram: input.studyProgram.trim(), className, academicProfileCompletedAt: new Date(), academicProfileTermId: "activeTerm" in status ? status.activeTerm?.id ?? null : null },
    });
    return updated;
  }
}
