cat << 'INNER_EOF' >> frontend/src/app/\(dashboard\)/logbook/draft.tsx

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="neo-card p-6 bg-[#e8d8c9]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#1a1a1a]">Digital Logbook</h1>
            <p className="text-[#5a5a5a] mt-1 font-medium">Pencatatan penggunaan lab secara digital</p>
          </div>
          {canCheckin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCheckinModal(true)}
              className="px-5 py-2.5 bg-[#f3701e] text-white font-bold neo-btn flex items-center gap-2"
            >
              <TbDoorEnter size={20} />
              Check-in Lab
            </motion.button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 neo-card flex items-start gap-3">
          <TbAlertTriangle size={20} className="mt-0.5" />
          <p className="font-bold text-sm">{error}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="neo-border-sm bg-white rounded-xl p-2 flex flex-wrap gap-2 shadow-[4px_4px_0px_#1a1a1a]">
        <button
          onClick={() => setSelectedStatus("ALL")}
          className={"px-4 py-2 rounded-lg text-sm font-bold transition-all " + (
            selectedStatus === "ALL" 
              ? "bg-[#4b607f] text-white shadow-[2px_2px_0px_#1a1a1a]" 
              : "bg-transparent text-[#5a5a5a] hover:bg-[#f5ede6]"
          )}
        >
          Semua
        </button>
        {(Object.keys(statusConfig) as LogbookStatus[]).map((s) => {
          const config = statusConfig[s];
          const Icon = config.icon;
          return (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              className={"px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 " + (
                selectedStatus === s 
                  ? config.color.split(' ')[0] + " text-white shadow-[2px_2px_0px_#1a1a1a]" 
                  : "bg-transparent text-[#5a5a5a] hover:bg-[#f5ede6]"
              )}
            >
              <Icon size={16} />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Logbook List */}
      <div className="space-y-4">
        {isLoading && (
          <div className="neo-card p-12 flex flex-col items-center justify-center text-[#5a5a5a]">
            <TbLoader2 className="animate-spin mb-4" size={32} />
            <p className="font-bold">Memuat logbook...</p>
          </div>
        )}

        {!isLoading && logbooks.length === 0 && (
          <div className="neo-card p-12 text-center flex flex-col items-center justify-center bg-white">
            <div className="w-16 h-16 rounded-xl bg-[#e8d8c9] neo-border flex items-center justify-center text-3xl mb-4 shadow-[4px_4px_0px_#1a1a1a]">
              <TbClipboardCheck />
            </div>
            <h3 className="font-heading text-xl font-bold text-[#1a1a1a] mb-2">Logbook Kosong</h3>
            <p className="text-[#5a5a5a] font-medium">Belum ada catatan logbook untuk filter ini.</p>
          </div>
        )}

        {!isLoading && logbooks.map((entry, i) => {
          const config = statusConfig[entry.status];
          const StatusIcon = config.icon;
          const statusColor = config.color.split(' ')[0];
          
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedEntry(entry)}
              className="neo-card p-0 bg-white cursor-pointer overflow-hidden hover:translate-y-[-2px] transition-transform"
            >
              <div className="p-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  
                  {/* Left & Center: Info */}
                  <div className="flex gap-4 items-start">
                    <div className={"w-12 h-12 rounded-xl border-2 border-[#1a1a1a] flex items-center justify-center text-white text-xl shadow-[2px_2px_0px_#1a1a1a] flex-shrink-0 " + statusColor}>
                      <StatusIcon />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={"px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border-2 border-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a] text-white " + statusColor}>
                          {entry.sessionType}
                        </span>
                        <h3 className="font-bold text-lg text-[#1a1a1a] leading-tight">{entry.scheduleTitle}</h3>
                      </div>
                      
                      <div className="text-sm font-medium text-[#5a5a5a] flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1"><TbDoorEnter size={14}/> {entry.labName}</span>
                        <span className="flex items-center gap-1"><TbUser size={14}/> {entry.checkinBy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status & Quick Actions */}
                  <div className="flex flex-col items-end gap-3 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t-2 border-dashed border-gray-200 md:border-t-0">
                    <div className={"px-3 py-1 font-bold text-xs rounded-lg border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex items-center gap-1.5 " + config.color}>
                      <StatusIcon size={14} />
                      {config.label}
                    </div>
                    
                    {/* Progress dots at bottom right */}
                    <div className="w-full md:w-32 mt-1">
                      {renderTimelineDots(entry.status)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
INNER_EOF
