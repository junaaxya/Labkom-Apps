cat << 'INNER_EOF' >> frontend/src/app/\(dashboard\)/logbook/draft.tsx

              {/* Detail Footer Actions */}
              <div className="p-6 border-t-2 border-[#1a1a1a] bg-white mt-auto sticky bottom-0 z-10">
                {showVerifyConfirm ? (
                  <div className="bg-orange-50 border-2 border-orange-500 rounded-xl p-4 shadow-[4px_4px_0px_rgba(249,115,22,0.2)]">
                    <h4 className="font-bold text-[#1a1a1a] mb-3">Konfirmasi Verifikasi</h4>
                    <p className="text-sm font-medium mb-3">Apakah kondisi lab sudah sesuai?</p>
                    
                    <textarea
                      placeholder="Catatan verifikasi (opsional)..."
                      value={verifyForm.notes}
                      onChange={e => setVerifyForm(p => ({...p, notes: e.target.value}))}
                      className="w-full p-3 neo-input text-sm mb-3"
                      rows={2}
                    />
                    
                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={verifyForm.hasProblem}
                        onChange={e => setVerifyForm(p => ({...p, hasProblem: e.target.checked}))}
                        className="w-5 h-5 accent-red-500 rounded border-2 border-[#1a1a1a]"
                      />
                      <span className="text-sm font-bold text-red-600">Ada Masalah pada Kondisi Lab</span>
                    </label>

                    <div className="flex gap-2">
                      <button 
                        onClick={handleVerify}
                        disabled={actionLoadingId === selectedEntry.id}
                        className="flex-1 py-2 bg-orange-500 text-white font-bold neo-btn border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]"
                      >
                        {actionLoadingId === selectedEntry.id ? "Memproses..." : "Ya, Verifikasi"}
                      </button>
                      <button 
                        onClick={() => setShowVerifyConfirm(false)}
                        className="flex-1 py-2 bg-white text-[#1a1a1a] font-bold neo-btn border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {selectedEntry.status === "CHECKED_IN" && (
                      <button
                        className="flex-1 min-w-[120px] py-3 bg-[#4b607f] text-white font-bold neo-btn border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] flex items-center justify-center gap-2"
                        disabled={actionLoadingId === selectedEntry.id}
                        onClick={() => runAction(selectedEntry.id, "take-key")}
                      >
                        <TbKey size={20} />
                        {actionLoadingId === selectedEntry.id ? "Memproses..." : "Ambil Kunci"}
                      </button>
                    )}
                    
                    {selectedEntry.status === "IN_USE" && (
                      <button
                        className="flex-1 min-w-[120px] py-3 bg-yellow-500 text-white font-bold neo-btn border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] flex items-center justify-center gap-2"
                        disabled={actionLoadingId === selectedEntry.id}
                        onClick={() => runAction(selectedEntry.id, "condition")}
                      >
                        <TbCamera size={20} />
                        {actionLoadingId === selectedEntry.id ? "Memproses..." : "Submit Kondisi (Dummy)"}
                      </button>
                    )}
                    
                    {selectedEntry.status === "CONDITION_SUBMITTED" && (
                      <button
                        className="flex-1 min-w-[120px] py-3 bg-indigo-600 text-white font-bold neo-btn border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] flex items-center justify-center gap-2"
                        disabled={actionLoadingId === selectedEntry.id}
                        onClick={() => runAction(selectedEntry.id, "return-key")}
                      >
                        <TbKey size={20} />
                        {actionLoadingId === selectedEntry.id ? "Memproses..." : "Kembalikan Kunci"}
                      </button>
                    )}
                    
                    {selectedEntry.status === "WAITING_VERIFICATION" && canVerifyCheckout && (
                      <button
                        className={`flex-1 min-w-[120px] py-3 font-bold neo-btn border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] flex items-center justify-center gap-2 ${
                          !photosVisible 
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                            : "bg-orange-500 text-white hover:bg-orange-600"
                        }`}
                        disabled={!photosVisible || actionLoadingId === selectedEntry.id}
                        onClick={() => setShowVerifyConfirm(true)}
                        title={!photosVisible ? "Scroll ke bawah untuk melihat foto kondisi terlebih dahulu" : "Mulai Verifikasi"}
                      >
                        <TbShieldCheck size={20} />
                        {!photosVisible ? "Lihat Foto Dulu" : "Verifikasi Kondisi"}
                      </button>
                    )}
                    
                    {(selectedEntry.status === "WAITING_VERIFICATION" || selectedEntry.status === "CONDITION_SUBMITTED") && canVerifyCheckout && (
                      <button
                        className="flex-1 min-w-[120px] py-3 bg-green-600 text-white font-bold neo-btn border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] flex items-center justify-center gap-2"
                        disabled={actionLoadingId === selectedEntry.id}
                        onClick={() => runAction(selectedEntry.id, "checkout")}
                      >
                        <TbLogout size={20} />
                        {actionLoadingId === selectedEntry.id ? "Memproses..." : "Checkout Akhir"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
INNER_EOF
