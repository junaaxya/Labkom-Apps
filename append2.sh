cat << 'INNER_EOF' >> frontend/src/app/\(dashboard\)/logbook/draft.tsx

      {/* Check-in Modal */}
      <AnimatePresence>
        {showCheckinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCheckinModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-6 w-full max-w-md bg-white shadow-[8px_8px_0px_#1a1a1a]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-heading text-xl font-bold text-[#1a1a1a] flex items-center gap-2">
                  <TbDoorEnter size={24} className="text-[#f3701e]" />
                  Check-in Lab
                </h2>
                <button onClick={() => setShowCheckinModal(false)} className="text-[#5a5a5a] hover:text-[#1a1a1a]">
                  <TbX size={24} />
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleCheckin}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lab</label>
                  <select
                    required
                    value={checkinForm.labId}
                    onChange={(e) => setCheckinForm((prev) => ({ ...prev, labId: e.target.value }))}
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm font-medium"
                  >
                    <option value="">Pilih Lab...</option>
                    {labs.map((lab) => (
                      <option key={lab.id} value={lab.id}>{lab.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jadwal Hari Ini</label>
                  <select
                    value={checkinForm.scheduleId}
                    onChange={(e) => setCheckinForm((prev) => ({ ...prev, scheduleId: e.target.value }))}
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm font-medium"
                  >
                    <option value="">-- Pilih Jadwal (Opsional) --</option>
                    {schedules
                      .filter(s => !checkinForm.labId || s.labId === checkinForm.labId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.startTime.substring(0,5)} - {s.endTime.substring(0,5)} | {s.title}
                        </option>
                      ))
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Tipe Sesi</label>
                  <select
                    value={checkinForm.sessionType}
                    onChange={(e) => setCheckinForm((prev) => ({ ...prev, sessionType: e.target.value as LogbookSessionType }))}
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm font-medium"
                  >
                    <option value="PRAKTIKUM">Praktikum</option>
                    <option value="PEMINJAMAN">Peminjaman</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={isCheckingIn} className="flex-1 py-3 bg-[#4b607f] text-white font-bold neo-btn">
                    {isCheckingIn ? "Memproses..." : "Submit Check-in"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
INNER_EOF
