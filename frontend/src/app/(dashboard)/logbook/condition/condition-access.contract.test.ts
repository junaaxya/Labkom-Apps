import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Logbook condition Ketua Kelas & ToastProvider loop regression contract", () => {
  test("1. Sidebar: MAHASISWA with isKetuaKelas=true does not get /logbook/condition while ASISTEN_LAB retains logbook menu", () => {
    const sidebar = source("../../../../components/layout/neo-sidebar.tsx");
    const extraStart = sidebar.indexOf("const ketuaKelasExtraMenu");
    const extraEnd = sidebar.indexOf("];", extraStart);
    assert.ok(extraStart >= 0 && extraEnd > extraStart, "ketuaKelasExtraMenu must exist");
    const extraBlock = sidebar.slice(extraStart, extraEnd);

    assert.doesNotMatch(extraBlock, /\/logbook\/condition/);
    assert.doesNotMatch(extraBlock, /Validasi Kondisi/);
    assert.match(extraBlock, /label: "Scan QR Kunci", href: "\/scan"/);
    assert.match(extraBlock, /label: "Request Jadwal", href: "\/schedules"/);

    const mahasiswaStart = sidebar.indexOf("MAHASISWA: [");
    const magangStart = sidebar.indexOf("MAGANG: [");
    const mahasiswaBlock = sidebar.slice(mahasiswaStart, magangStart);
    assert.doesNotMatch(mahasiswaBlock, /\/logbook\/condition/);
    assert.match(mahasiswaBlock, /label: "Akademik", href: "\/academic"/);

    const asistenStart = sidebar.indexOf("ASISTEN_LAB: [");
    const asistenBlock = sidebar.slice(asistenStart, mahasiswaStart);
    assert.match(asistenBlock, /label: "Logbook Lab", href: "\/logbook"/);
  });

  test("2. Condition page: only ASISTEN_LAB calls /logbooks/today; MAHASISWA gets dedicated notice and /scan + /dashboard CTAs without redirect loop", () => {
    const page = source("./page.tsx");

    assert.match(page, /if \(resolvedRole === "ASISTEN_LAB"\) \{\s*void fetchData\(\);\s*\} else \{\s*setLoading\(false\);\s*\}/);
    assert.match(page, /if \(role !== "ASISTEN_LAB"\)/);
    assert.match(
      page,
      /Halaman validasi ini khusus untuk Asisten Lab\. Jika Anda meminjam kunci lab, kirim foto kondisi melalui Scan QR Kunci saat mengembalikan kunci\./
    );
    assert.match(page, /href="\/scan"/);
    assert.match(page, /href="\/dashboard"/);
    assert.match(page, /api\.get<\{ data: DailyLogbook \| null \}>\("\/logbooks\/today"\)/);
    assert.doesNotMatch(page, /router\.push|router\.replace/);
  });

  test("3. ToastProvider & loop guard: toast object and provider value are memoized so toast.error does not re-trigger fetchData", () => {
    const provider = source("../../../../providers/toast-provider.tsx");
    const page = source("./page.tsx");

    assert.match(
      provider,
      /const toast = useMemo\(\s*\(\) => \(\{[\s\S]*addToast\("success"[\s\S]*addToast\("error"[\s\S]*addToast\("warning"[\s\S]*addToast\("info"[\s\S]*\}\),\s*\[addToast\]\s*\);/
    );
    assert.match(provider, /const value = useMemo\(\(\) => \(\{ toast \}\), \[toast\]\);/);
    assert.match(provider, /<ToastContext\.Provider value=\{value\}>/);

    const SimulatedToastProvider = () => {
      let toastsState: string[] = [];
      const addToastRef = (type: string, message: string) => {
        toastsState = [...toastsState, `${type}:${message}`];
      };
      let memoizedToast: Record<string, (msg: string) => void> | null = null;
      let lastDep: unknown = null;
      const getToast = (dep: unknown) => {
        if (!memoizedToast || lastDep !== dep) {
          memoizedToast = {
            error: (msg: string) => addToastRef("error", msg),
          };
          lastDep = dep;
        }
        return memoizedToast;
      };

      const toastRender1 = getToast(addToastRef);
      let fetchCalls = 0;
      let lastFetchToastDep: unknown = null;
      const runEffectIfChanged = (toastDep: unknown) => {
        if (lastFetchToastDep !== toastDep) {
          lastFetchToastDep = toastDep;
          fetchCalls += 1;
          toastRender1.error("Gagal memuat data");
        }
      };

      runEffectIfChanged(toastRender1);
      const toastRender2 = getToast(addToastRef);
      runEffectIfChanged(toastRender2);

      assert.equal(toastRender1, toastRender2);
      assert.equal(fetchCalls, 1);
      assert.equal(toastsState.length, 1);
    };

    SimulatedToastProvider();
    assert.match(page, /toast\.error\("Gagal memuat data"\)/);
  });
});
