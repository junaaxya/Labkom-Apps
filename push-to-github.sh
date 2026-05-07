#!/bin/bash

# LabKom Management - GitHub Push Script
# Pastikan semua perubahan sudah di-commit sebelum push

echo "🚀 Preparing LabKom Management for GitHub push..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git branch -M main
fi

# Add all files
echo "📁 Adding files to Git..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "✅ No changes to commit"
else
    echo "💾 Committing changes..."
    git commit -m "feat: Complete LabKom Management System

- Multi-role dashboard (Koordinator, Asisten, Mahasiswa, Dosen)
- Digital logbook with QR key management
- PC Agent monitoring with remote commands
- Attendance system with GPS geofencing
- Ticketing system for equipment issues
- Mission & gamification system
- AI assistant with context awareness
- WhatsApp & Google Calendar integration
- Production-ready with Docker support
- Comprehensive CI/CD pipeline

Ready for production deployment 🚀"
fi

# Check if remote exists
if git remote get-url origin >/dev/null 2>&1; then
    echo "🔗 Remote origin already exists"
    git remote -v
else
    echo "❌ No remote origin found!"
    echo "Please add your GitHub repository:"
    echo "git remote add origin https://github.com/yourusername/labkom-management.git"
    echo ""
    echo "Then run this script again or push manually:"
    echo "git push -u origin main"
    exit 1
fi

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🎉 Next steps:"
    echo "1. Set up GitHub Secrets for CI/CD:"
    echo "   - DATABASE_URL"
    echo "   - JWT_SECRET" 
    echo "   - OPENAI_API_KEY (optional)"
    echo ""
    echo "2. Configure deployment environment variables"
    echo "3. Set up production server with Docker"
    echo ""
    echo "📚 Documentation: Check README.md for full setup guide"
else
    echo "❌ Push failed! Please check your credentials and try again."
    exit 1
fi