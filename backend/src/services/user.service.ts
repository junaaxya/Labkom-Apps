import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import prisma from "../config/database";
import type { CreateUserInput, UpdateUserInput } from "../validators/user.validator";

const userSelect = {
  id: true,
  email: true,
  name: true,
  nim: true,
  nip: true,
  role: true,
  semester: true,
  className: true,
  isKetuaKelas: true,
  avatar: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
};

type ImportFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type ParsedImportRow = {
  rowNumber: number;
  nim: string;
  name: string;
  role: Role;
  email: string;
  className?: string;
  semester?: string;
  phone?: string;
  isKetuaKelas: boolean;
};

type ImportFailure = {
  rowNumber: number;
  nim?: string;
  name?: string;
  message: string;
};

const IMPORT_ROLE_VALUES = new Set<Role>([Role.MAHASISWA, Role.ASISTEN_LAB]);
const REQUIRED_HEADERS = ["nim", "nama/name", "role"];

function normalizeKetuaKelasCapability<T extends { role?: string; isKetuaKelas?: boolean }>(data: T): T {
  if (data.role === "KOORDINATOR_LAB") {
    return { ...data, isKetuaKelas: false };
  }

  return data;
}

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalizeHeader(value: unknown): string {
  return cleanCell(value).toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

function parseBoolean(value: string): boolean {
  return ["true", "1", "ya", "yes", "y", "iya"].includes(value.toLowerCase());
}

function getRowValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value) return value;
  }
  return "";
}

function generatedEmail(nim: string): string {
  return `${nim.toLowerCase()}@labkom.local`;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

async function parseSpreadsheet(file: ImportFile): Promise<Array<{ rowNumber: number; values: Record<string, string> }>> {
  const isExcel = file.originalname.toLowerCase().endsWith(".xlsx") || file.mimetype.includes("spreadsheet");

  if (isExcel) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("File Excel tidak memiliki sheet");

    const headerRow = sheet.getRow(1);
    const headers = headerRow.values as unknown[];
    const normalizedHeaders = headers.map(normalizeHeader);

    return sheet.getRows(2, sheet.rowCount - 1)?.map((row) => {
      const values: Record<string, string> = {};
      normalizedHeaders.forEach((header, index) => {
        if (!header) return;
        values[header] = cleanCell(row.getCell(index).value);
      });
      return { rowNumber: row.number, values };
    }).filter((row) => Object.values(row.values).some(Boolean)) ?? [];
  }

  const [headerLine, ...lines] = file.buffer.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  if (!headerLine) throw new Error("File CSV kosong");

  const headers = parseCsvLine(headerLine).map(normalizeHeader);
  return lines
    .map((line, index) => ({ line, rowNumber: index + 2 }))
    .filter(({ line }) => line.trim())
    .map(({ line, rowNumber }) => {
      const cells = parseCsvLine(line);
      const values: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (!header) return;
        values[header] = cleanCell(cells[index]);
      });
      return { rowNumber, values };
    });
}

function normalizeImportRows(rows: Array<{ rowNumber: number; values: Record<string, string> }>) {
  const validRows: ParsedImportRow[] = [];
  const failures: ImportFailure[] = [];
  const seenNims = new Set<string>();
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const nim = getRowValue(row.values, ["nim", "nomorindukmahasiswa"]);
    const name = getRowValue(row.values, ["nama", "name", "namalengkap"]);
    const rawRole = getRowValue(row.values, ["role", "peran"]).toUpperCase();
    const role = rawRole as Role;
    const email = getRowValue(row.values, ["email", "surel"]) || generatedEmail(nim);
    const className = getRowValue(row.values, ["kelas", "classname", "class"]);
    const semester = getRowValue(row.values, ["semester", "smt"]);
    const phone = getRowValue(row.values, ["phone", "telepon", "whatsapp", "wa"]);
    const isKetuaKelas = parseBoolean(getRowValue(row.values, ["isketuakelas", "ketuakelas", "kk"]));

    if (!nim || !name || !rawRole) {
      failures.push({ rowNumber: row.rowNumber, nim, name, message: `Kolom wajib: ${REQUIRED_HEADERS.join(", ")}` });
      continue;
    }

    if (!IMPORT_ROLE_VALUES.has(role)) {
      failures.push({ rowNumber: row.rowNumber, nim, name, message: "Role import hanya MAHASISWA atau ASISTEN_LAB" });
      continue;
    }

    if (seenNims.has(nim)) {
      failures.push({ rowNumber: row.rowNumber, nim, name, message: "NIM duplikat di file" });
      continue;
    }

    if (seenEmails.has(email.toLowerCase())) {
      failures.push({ rowNumber: row.rowNumber, nim, name, message: "Email duplikat di file" });
      continue;
    }

    seenNims.add(nim);
    seenEmails.add(email.toLowerCase());
    validRows.push({ rowNumber: row.rowNumber, nim, name, role, email, className, semester, phone, isKetuaKelas });
  }

  return { validRows, failures };
}

export class UserService {
  static async getAllUsers(params: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
    isActive?: boolean;
  }) {
    const { page = 1, limit = 20, role, search, isActive } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { nim: { contains: search, mode: "insensitive" } },
        { nip: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        schedulesAsAssistant: { select: { id: true, title: true } },
      },
    });

    if (!user) throw new Error("User tidak ditemukan");
    return user;
  }

  static async createUser(data: CreateUserInput) {
    const normalizedData = normalizeKetuaKelasCapability(data);

    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedData.email },
    });
    if (existingEmail) throw new Error("Email sudah terdaftar");

    if (normalizedData.nim) {
      const existingNim = await prisma.user.findUnique({
        where: { nim: normalizedData.nim },
      });
      if (existingNim) throw new Error("NIM sudah terdaftar");
    }

    if (normalizedData.nip) {
      const existingNip = await prisma.user.findUnique({
        where: { nip: normalizedData.nip },
      });
      if (existingNip) throw new Error("NIP sudah terdaftar");
    }

    const hashedPassword = await bcrypt.hash(normalizedData.password, 12);

    const user = await prisma.user.create({
      data: {
        ...normalizedData,
        password: hashedPassword,
      },
      select: userSelect,
    });

    return user;
  }

  static async updateUser(id: string, data: UpdateUserInput) {
    const normalizedData = normalizeKetuaKelasCapability(data);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User tidak ditemukan");

    if (normalizedData.email && normalizedData.email !== existing.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: normalizedData.email },
      });
      if (existingEmail) throw new Error("Email sudah digunakan user lain");
    }

    if (normalizedData.nim && normalizedData.nim !== existing.nim) {
      const existingNim = await prisma.user.findUnique({
        where: { nim: normalizedData.nim },
      });
      if (existingNim) throw new Error("NIM sudah digunakan user lain");
    }

    if (normalizedData.nip && normalizedData.nip !== existing.nip) {
      const existingNip = await prisma.user.findUnique({
        where: { nip: normalizedData.nip },
      });
      if (existingNip) throw new Error("NIP sudah digunakan user lain");
    }

    const user = await prisma.user.update({
      where: { id },
      data: normalizedData,
      select: userSelect,
    });

    return user;
  }

  static async resetPassword(id: string, newPassword: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User tidak ditemukan");

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword, mustChangePassword: true },
    });

    return { message: "Password berhasil direset" };
  }

  static async importUsers(file: ImportFile) {
    const rows = await parseSpreadsheet(file);
    if (rows.length === 0) throw new Error("File import tidak memiliki data user");

    const { validRows, failures } = normalizeImportRows(rows);
    const nims = validRows.map((row) => row.nim);
    const emails = validRows.map((row) => row.email.toLowerCase());

    const existingUsers = await prisma.user.findMany({
      where: { OR: [{ nim: { in: nims } }, { email: { in: emails } }] },
      select: { nim: true, email: true },
    });

    const existingNims = new Set(existingUsers.map((user) => user.nim).filter(Boolean));
    const existingEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()));
    const rowsToCreate = validRows.filter((row) => {
      if (existingNims.has(row.nim)) {
        failures.push({ rowNumber: row.rowNumber, nim: row.nim, name: row.name, message: "NIM sudah terdaftar" });
        return false;
      }

      if (existingEmails.has(row.email.toLowerCase())) {
        failures.push({ rowNumber: row.rowNumber, nim: row.nim, name: row.name, message: "Email sudah terdaftar" });
        return false;
      }

      return true;
    });

    const rowsWithPassword = await Promise.all(
      rowsToCreate.map(async (row) => ({ ...row, password: await bcrypt.hash(row.nim, 12) }))
    );

    const created = await prisma.$transaction(
      rowsWithPassword.map((row) =>
        prisma.user.create({
          data: {
            email: row.email.toLowerCase(),
            password: row.password,
            name: row.name,
            nim: row.nim,
            phone: row.phone || undefined,
            role: row.role,
            semester: row.semester || undefined,
            className: row.className || undefined,
            isKetuaKelas: row.role === Role.MAHASISWA ? row.isKetuaKelas : false,
            mustChangePassword: true,
          },
          select: userSelect,
        })
      )
    );

    return {
      totalRows: rows.length,
      createdCount: created.length,
      failedCount: failures.length,
      defaultPassword: "NIM",
      emailFallbackDomain: "@labkom.local",
      created,
      failures: failures.sort((a, b) => a.rowNumber - b.rowNumber),
    };
  }

  static async toggleActive(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User tidak ditemukan");

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: userSelect,
    });

    return user;
  }

  static async getUserStats() {
    const [total, byRole, active, inactive] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ["role"],
        _count: { id: true },
      }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
    ]);

    return {
      total,
      active,
      inactive,
      byRole: byRole.map((r) => ({ role: r.role, count: r._count.id })),
    };
  }
}
