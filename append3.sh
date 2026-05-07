cat << 'INNER_EOF' >> frontend/src/app/\(dashboard\)/logbook/draft.tsx

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1a1a1a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => {
              if (!showVerifyConfirm) setSelectedEntry(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-0 w-full max-w-2xl bg-[#e8d8c9] shadow-[8px_8px_0px_#1a1a1a] flex flex-col max-h-[90vh]"
            >
              {/* Detail Header */}
              <div className="p-6 border-b-2 border-[#1a1a1a] bg-white sticky top-0 z-10 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={"px-2 py-1 text-xs font-bold uppercase tracking-wider rounded border-2 border-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a] text-white " + statusConfig[selectedEntry.status].color.split(' ')[0]}>
                      {selectedEntry.sessionType}
                    </span>
                    <span className={"px-2 py-1 text-xs font-bold rounded flex items-center gap-1 border-2 border-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a] " + statusConfig[selectedEntry.status].color}>
                      {React.createElement(statusConfig[selectedEntry.status].icon, { size: 14 })}
                      {statusConfig[selectedEntry.status].label}
                    </span>
                  </div>
                  <h2 className="font-heading text-2xl font-bold text-[#1a1a1a]">{selectedEntry.scheduleTitle}</h2>
                  <p className="text-[#5a5a5a] font-medium flex items-center gap-1 mt-1">
                    <TbDoorEnter /> {selectedEntry.labName}
                  </p>
                </div>
                <button onClick={() => setSelectedEntry(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-[#1a1a1a] border-2 border-transparent hover:border-[#1a1a1a] transition-all">
                  <TbX size={24} />
                </button>
              </div>

              {/* Detail Content (Scrollable) */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* Timeline Section */}
                <div className="bg-white p-5 rounded-xl border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a]">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <TbClock className="text-[#f3701e]" /> Timeline Aktivitas
                  </h3>
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#1a1a1a] before:to-transparent">
                    
                    {/* Check-in */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-blue-500 text-white shadow-[2px_2px_0px_#1a1a1a] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <TbDoorEnter size={20} />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border-2 border-[#1a1a1a] bg-[#e8d8c9] shadow-[2px_2px_0px_#1a1a1a]">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-sm">Check-in</span>
                          <span className="text-xs font-bold text-[#5a5a5a]">{selectedEntry.checkinAt ? new Date(selectedEntry.checkinAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                        </div>
                        <p className="text-xs font-medium">Oleh: {selectedEntry.checkinBy}</p>
                      </div>
                    </div>

                    {/* Ambil Kunci */}
                    {(selectedEntry.keyTakenAt || selectedEntry.keyHolder) && (
                      <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-[#4b607f] text-white shadow-[2px_2px_0px_#1a1a1a] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <TbKey size={20} />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border-2 border-[#1a1a1a] bg-white shadow-[2px_2px_0px_#1a1a1a]">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm">Ambil Kunci</span>
                            <span className="text-xs font-bold text-[#5a5a5a]">{selectedEntry.keyTakenAt ? new Date(selectedEntry.keyTakenAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                          </div>
                          <p className="text-xs font-medium">Pemegang: {selectedEntry.keyHolder}</p>
                        </div>
                      </div>
                    )}

                    {/* Submit Kondisi */}
                    {selectedEntry.conditionSubmittedAt && (
                      <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-yellow-500 text-white shadow-[2px_2px_0px_#1a1a1a] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <TbCamera size={20} />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border-2 border-[#1a1a1a] bg-white shadow-[2px_2px_0px_#1a1a1a]">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm">Submit Kondisi</span>
                            <span className="text-xs font-bold text-[#5a5a5a]">{new Date(selectedEntry.conditionSubmittedAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="text-xs font-medium">Oleh: {selectedEntry.conditionSubmittedBy}</p>
                        </div>
                      </div>
                    )}

                    {/* Kembali Kunci */}
                    {selectedEntry.keyReturnedAt && (
                      <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-indigo-500 text-white shadow-[2px_2px_0px_#1a1a1a] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <TbKey size={20} />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border-2 border-[#1a1a1a] bg-white shadow-[2px_2px_0px_#1a1a1a]">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm">Kunci Kembali</span>
                            <span className="text-xs font-bold text-[#5a5a5a]">{new Date(selectedEntry.keyReturnedAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Checkout / Selesai */}
                    {selectedEntry.checkoutAt && (
                      <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-green-500 text-white shadow-[2px_2px_0px_#1a1a1a] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <TbCheck size={20} />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border-2 border-[#1a1a1a] bg-green-50 shadow-[2px_2px_0px_#1a1a1a]">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm">Selesai / Checkout</span>
                            <span className="text-xs font-bold text-[#5a5a5a]">{new Date(selectedEntry.checkoutAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="text-xs font-medium">Verifikator: {selectedEntry.verifiedBy || selectedEntry.checkoutBy}</p>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Condition Section (The most important part) */}
                {selectedEntry.condition && (
                  <div ref={photosRef} className="bg-white p-5 rounded-xl border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a]">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <TbPhoto className="text-[#f3701e]" /> Foto & Kondisi Lab
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {selectedEntry.condition.fotoBukti?.length > 0 ? (
                        selectedEntry.condition.fotoBukti.map((photo, idx) => (
                          <div key={idx} className="aspect-square rounded-lg border-2 border-[#1a1a1a] overflow-hidden shadow-[2px_2px_0px_#1a1a1a] group relative">
                            <img 
                              src={photo.startsWith('http') ? photo : API_BASE + photo} 
                              alt={"Bukti kondisi " + (idx+1)} 
                              className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                              <TbEye className="text-white" size={24} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center text-[#5a5a5a] font-medium">
                          Tidak ada foto bukti yang dilampirkan
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {selectedEntry.condition.kerusakanBaru && (
                        <div className="p-3 bg-red-50 border-2 border-red-500 rounded-lg">
                          <p className="text-xs font-bold text-red-600 mb-1 flex items-center gap-1">
                            <TbAlertTriangle /> LAPORAN KERUSAKAN:
                          </p>
                          <p className="text-sm font-medium text-red-800">{selectedEntry.condition.kerusakanBaru}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 border-2 border-[#1a1a1a] rounded-lg">
                          <p className="text-xs font-bold text-[#5a5a5a] mb-1">PC Menyala</p>
                          <p className="text-lg font-bold text-green-600">{selectedEntry.condition.jumlahPcMenyala || 0}</p>
                        </div>
                        <div className="p-3 bg-gray-50 border-2 border-[#1a1a1a] rounded-lg">
                          <p className="text-xs font-bold text-[#5a5a5a] mb-1">PC Mati</p>
                          <p className="text-lg font-bold text-red-600">{selectedEntry.condition.jumlahPcMati || 0}</p>
                        </div>
                      </div>

                      {selectedEntry.condition.catanKondisi && (
                        <div className="p-3 bg-[#e8d8c9]/50 border-2 border-[#1a1a1a] rounded-lg">
                          <p className="text-xs font-bold text-[#5a5a5a] mb-1">Catatan Tambahan:</p>
                          <p className="text-sm font-medium">{selectedEntry.condition.catanKondisi}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

INNER_EOF
