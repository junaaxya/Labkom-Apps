# LabKom - Sistem Manajemen Laboratorium

[![CI/CD Pipeline](https://github.com/yourusername/labkom-management/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/yourusername/labkom-management/actions/workflows/ci-cd.yml)

Sistem manajemen laboratorium komputer terpusat dengan QR tracking, digital logbook, ticketing kerusakan, dan PC agent monitoring.

## 🚀 Features

- **Multi-role Dashboard** (Koordinator, Asisten, Mahasiswa, Dosen)
- **Digital Logbook** dengan validasi kondisi lab
- **QR-based Key Management** untuk peminjaman kunci
- **Ticketing System** untuk laporan kerusakan
- **PC Agent Monitoring** real-time dengan remote commands
- **Attendance System** dengan GPS geofencing
- **Mission & Gamification** untuk asisten lab
- **AI Assistant** dengan context-aware responses
- **Predictive Maintenance** untuk PC monitoring
- **WhatsApp Integration** untuk notifikasi
- **Google Calendar Sync** untuk jadwal

## 🏗️ Architecture

```
├── frontend/          # Next.js 15 App Router (port 3000)
├── backend/           # Express + Prisma + TypeScript (port 5000)  
├── labkom-agent/      # Python PC Agent (per-PC installation)
└── .github/workflows/ # CI/CD pipeline
```

## 🛠️ Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS (Neo-brutalist design)
- Framer Motion
- React Icons

**Backend:**
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis (caching)
- JWT Authentication

**PC Agent:**
- Python 3.11
- psutil (system monitoring)
- requests (API communication)

## 📋 Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Redis (optional)

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/labkom-management.git
cd labkom-management
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npx prisma db push
npx prisma db seed
npm run build
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with API URL
npm run build
npm start
```

### 4. PC Agent Setup (per PC)
```bash
cd labkom-agent
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp config.example.json config.json
# Edit config.json with PC code and token
python agent.py
```

## 🐳 Docker Deployment

```bash
# Build images
docker build -t labkom-backend ./backend
docker build -t labkom-frontend ./frontend
docker build -t labkom-agent ./labkom-agent

# Run with docker-compose
docker-compose up -d
```

## 🔧 Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/lab_management
JWT_SECRET=your-super-secret-jwt-key
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your-openai-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=LabKom Management
```

## 👥 Default Users

| Role | Email | Password |
|------|-------|----------|
| Koordinator Lab | admin@labkom.ac.id | admin123 |

## 📚 API Documentation

API endpoints available at `/api/v1`:

- **Auth:** `/auth/login`, `/auth/register`
- **Labs:** `/labs` (CRUD)
- **Schedules:** `/schedules` (CRUD + conflict detection)
- **Tickets:** `/tickets` (CRUD + assignment)
- **PC Monitoring:** `/pcs` (monitoring + commands)
- **Attendance:** `/attendance` (check-in/out + GPS)
- **Missions:** `/missions` (gamification)

## 🔒 Security Features

- JWT authentication with rate limiting
- Role-based access control (RBAC)
- GPS geofencing for attendance
- QR code validation for key management
- Agent token authentication for PC monitoring
- Input validation and sanitization

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd frontend
npm test

# Agent tests
cd labkom-agent
python -m pytest
```

## 📈 Monitoring

- **PC Agent Status:** Real-time monitoring via heartbeat
- **System Health:** CPU, RAM, Storage usage tracking
- **Performance Metrics:** Database query optimization
- **Error Tracking:** Comprehensive logging system

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation:** [Wiki](https://github.com/yourusername/labkom-management/wiki)
- **Issues:** [GitHub Issues](https://github.com/yourusername/labkom-management/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/labkom-management/discussions)

## 🏆 Acknowledgments

- Built for university computer laboratory management
- Inspired by modern lab management best practices
- Community-driven development approach