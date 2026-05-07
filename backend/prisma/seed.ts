import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@labkom.ac.id" },
    update: {},
    create: {
      email: "admin@labkom.ac.id",
      name: "Koordinator Lab",
      password: hashedPassword,
      role: Role.KOORDINATOR_LAB,
      nip: "198501012010011001",
      isActive: true,
    },
  });

  const asleb = await prisma.user.upsert({
    where: { email: "asleb@labkom.ac.id" },
    update: {},
    create: {
      email: "asleb@labkom.ac.id",
      name: "Asisten Lab 1",
      password: hashedPassword,
      role: Role.ASISTEN_LAB,
      nim: "2210001",
      semester: "6",
      className: "TI-3A",
      isActive: true,
    },
  });

  const mahasiswa = await prisma.user.upsert({
    where: { email: "mahasiswa@labkom.ac.id" },
    update: {},
    create: {
      email: "mahasiswa@labkom.ac.id",
      name: "Andi Pratama",
      password: hashedPassword,
      role: Role.MAHASISWA,
      nim: "2210050",
      semester: "4",
      className: "TI-2B",
      isKetuaKelas: true,
      isActive: true,
    },
  });

  const labDasar = await prisma.lab.upsert({
    where: { id: "lab-dasar-001" },
    update: {},
    create: {
      id: "lab-dasar-001",
      name: "Lab Dasar",
      location: "Gedung F, Lantai 2",
      description: "Laboratorium komputer dasar dengan 20 PC",
      status: "ACTIVE",
      capacity: 20,
    },
  });

  const labMultimedia = await prisma.lab.upsert({
    where: { id: "lab-multimedia-001" },
    update: {},
    create: {
      id: "lab-multimedia-001",
      name: "Lab Multimedia",
      location: "Gedung F, Lantai 3",
      description: "Laboratorium multimedia dengan 12 PC spesifikasi tinggi",
      status: "ACTIVE",
      capacity: 12,
    },
  });

  const keyDasar = await prisma.key.upsert({
    where: { keyCode: "KEY-LABD-001" },
    update: {},
    create: {
      labId: "lab-dasar-001",
      keyCode: "KEY-LABD-001",
      qrCode: "http://localhost:3000/scan/key/KEY-LABD-001",
      status: "AVAILABLE",
    },
  });

  const keyMultimedia = await prisma.key.upsert({
    where: { keyCode: "KEY-LABM-001" },
    update: {},
    create: {
      labId: "lab-multimedia-001",
      keyCode: "KEY-LABM-001",
      qrCode: "http://localhost:3000/scan/key/KEY-LABM-001",
      status: "AVAILABLE",
    },
  });

  console.log("✅ Seed berhasil!");
  console.log("");
  console.log("📋 Akun yang dibuat:");
  console.log("─────────────────────────────────────────────");
  console.log(`👑 KOORDINATOR LAB (Admin)`);
  console.log(`   Email    : admin@labkom.ac.id`);
  console.log(`   Password : admin123`);
  console.log("");
  console.log(`🔧 ASISTEN LAB`);
  console.log(`   Email    : asleb@labkom.ac.id`);
  console.log(`   Password : admin123`);
  console.log("");
  console.log(`🎓 MAHASISWA (Ketua Kelas)`);
  console.log(`   Email    : mahasiswa@labkom.ac.id`);
  console.log(`   Password : admin123`);
  console.log("─────────────────────────────────────────────");
  console.log("");
  console.log("🏢 Lab yang dibuat:");
  console.log(`   - ${labDasar.name} (${labDasar.location})`);
  console.log(`   - ${labMultimedia.name} (${labMultimedia.location})`);
  console.log("");
  console.log("🔑 Kunci yang dibuat:");
  console.log(`   - ${keyDasar.keyCode} (${labDasar.name})`);
  console.log(`   - ${keyMultimedia.keyCode} (${labMultimedia.name})`);
}

main()
  .catch((e) => {
    console.error("❌ Seed gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
