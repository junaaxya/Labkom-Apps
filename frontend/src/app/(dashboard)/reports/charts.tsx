"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from "recharts";

interface ReportData {
  logbooks: { total: number; completed: number };
  tickets: { total: number; resolved: number };
  attendance: { total: number; late: number };
  missions: { total: number; approved: number };
  labUsage: { labName: string; count: number }[];
  ticketsByCategory: { category: string; count: number }[];
  topAssistants: { name: string; points: number }[];
}

const COLORS = ["#4b607f", "#f3701e", "#22c55e", "#eab308", "#8b5cf6", "#ef4444"];

export default function RechartsCharts({ report }: { report: ReportData }) {
  const summaryData = [
    { name: "Logbook", total: report.logbooks.total, completed: report.logbooks.completed },
    { name: "Ticket", total: report.tickets.total, completed: report.tickets.resolved },
    { name: "Absensi", total: report.attendance.total, completed: report.attendance.total - report.attendance.late },
    { name: "Misi", total: report.missions.total, completed: report.missions.approved },
  ];

  const radarData = report.topAssistants.slice(0, 5).map((a) => ({
    name: a.name.split(" ")[0],
    points: a.points,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="neo-card p-5">
        <h3 className="font-heading font-bold text-sm text-[#1a1a1a] mb-4">Ringkasan Performa</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={summaryData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8d8c9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#5a5a5a" }} />
            <YAxis tick={{ fontSize: 12, fill: "#5a5a5a" }} />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "2px solid #1a1a1a",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="total" fill="#e8d8c9" name="Total" radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" fill="#4b607f" name="Selesai" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="neo-card p-5">
        <h3 className="font-heading font-bold text-sm text-[#1a1a1a] mb-4">Ticket per Kategori</h3>
        {report.ticketsByCategory.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={report.ticketsByCategory}
                dataKey="count"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {report.ticketsByCategory.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "2px solid #1a1a1a",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-[#5a5a5a] py-12">Belum ada data ticket</p>
        )}
      </div>

      <div className="neo-card p-5">
        <h3 className="font-heading font-bold text-sm text-[#1a1a1a] mb-4">Penggunaan Lab</h3>
        {report.labUsage.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={report.labUsage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e8d8c9" />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#5a5a5a" }} />
              <YAxis dataKey="labName" type="category" tick={{ fontSize: 11, fill: "#5a5a5a" }} width={100} />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "2px solid #1a1a1a",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" fill="#f3701e" name="Sesi" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-[#5a5a5a] py-12">Belum ada data penggunaan lab</p>
        )}
      </div>

      <div className="neo-card p-5">
        <h3 className="font-heading font-bold text-sm text-[#1a1a1a] mb-4">Top Asisten (Radar)</h3>
        {radarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e8d8c9" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: "#5a5a5a" }} />
              <PolarRadiusAxis tick={{ fontSize: 10, fill: "#5a5a5a" }} />
              <Radar
                name="Points"
                dataKey="points"
                stroke="#4b607f"
                fill="#4b607f"
                fillOpacity={0.3}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "2px solid #1a1a1a",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-[#5a5a5a] py-12">Belum ada data asisten</p>
        )}
      </div>
    </div>
  );
}
