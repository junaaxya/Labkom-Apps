import { inferProvider, quickActionsForRole } from "../src/services/ai-runtime.service";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const student = quickActionsForRole("MAHASISWA");
assert(student.some((item) => item.id === "schedule.today"), "Student should see schedule action");
assert(student.some((item) => item.id === "ticket.mine"), "Student should see own ticket action");
assert(!student.some((item) => item.id === "operations.attendance"), "Student must not see operational attendance action");
assert(!student.some((item) => item.id === "operations.keys"), "Student must not see internal key action");

const assistant = quickActionsForRole("ASISTEN_LAB");
assert(assistant.some((item) => item.id === "operations.attendance"), "Assistant should see attendance action");
assert(inferProvider(["AI Lokal (qwen2.5:7b)"]) === "local", "Local provider attribution failed");
assert(inferProvider(["Database LabKom"]) === "rule", "Rule provider attribution failed");

console.log("AI runtime policy tests passed");
