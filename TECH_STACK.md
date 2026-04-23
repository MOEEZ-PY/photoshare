# PhotoBazaar — Tech Stack

## Frontend

| Technology | Version | Kaam |
|------------|---------|------|
| HTML5 | — | Pages ka structure |
| CSS3 | — | Styling, dark/light theme, responsive layout |
| Vanilla JavaScript | ES2020+ | UI logic, API calls, auth |
| Nginx | 1.27 (Alpine) | Static files serve karna + API proxy |

---

## Backend

| Technology | Version | Kaam |
|------------|---------|------|
| Node.js | 20 (Alpine) | Server runtime |
| Express.js | 4.18 | REST API framework |
| better-sqlite3 | 9.4 | SQLite database driver |
| bcryptjs | 2.4 | Password hashing |
| jsonwebtoken | 9.0 | JWT token banana aur verify karna |
| multer | 1.4 | File upload handle karna |
| uuid | 9.0 | Unique IDs generate karna |
| cors | 2.8 | Cross-origin requests allow karna |

---

## Database

| Technology | Kaam |
|------------|------|
| SQLite | Lightweight embedded database — users, media, comments, ratings, notifications sab store karta hai |

---

## Authentication

| Technology | Kaam |
|------------|------|
| JWT (JSON Web Token) | Login ke baad token issue hota hai, har API request mein verify hota hai |
| bcryptjs | Password ko hash karke database mein save karta hai |

---

## DevOps & Infrastructure

| Technology | Version | Kaam |
|------------|---------|------|
| Docker | Latest | Backend aur frontend ko containers mein run karna |
| Docker Compose | v3.9 | Dono containers ko ek saath manage karna |
| Docker Volumes | — | Database aur uploaded files ko persist karna |

---

## Version Control

| Technology | Kaam |
|------------|------|
| Git | Source code track karna |
| GitHub | Remote repository — https://github.com/MOEEZ-PY/photoshare |

---

## Architecture Overview

```
Browser
   │
   ▼
Nginx (port 80)
   ├── /          → Static HTML/CSS/JS files serve karta hai
   ├── /api/      → Backend ko proxy karta hai (port 3000)
   └── /uploads/  → Uploaded media files serve karta hai
          │
          ▼
   Express.js (port 3000)
          │
          ▼
       SQLite DB
```

---

## Folder Structure

```
photoshare/
├── frontend/          ← Nginx + HTML/CSS/JS
├── backend/           ← Node.js + Express + SQLite
├── docker-compose.yml ← Dono services ek saath run karta hai
└── .env               ← Environment variables (JWT secret, DB path, etc.)
```
