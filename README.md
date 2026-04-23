# 📸 PhotoShare

A full-stack photo & video sharing platform with separate **Creator** and **Consumer** experiences, built with Node.js, Express, SQLite, and vanilla HTML/CSS/JS — containerised with Docker.

---

## Features

- **Role-based accounts** — register as a User (consumer) or Creator
- **Creator Studio** — upload photos & videos, manage posts, view stats
- **Consumer Feed** — Instagram-style feed with stories, search, reels, and notifications
- **AI Image Analysis** — get AI-generated descriptions for uploaded media
- **Ratings & Comments** — consumers can rate and comment on posts
- **Dark / Light Mode** — persistent theme toggle on every page
- **JWT Authentication** — secure login with token-based sessions
- **Dockerised** — one command to run everything

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | HTML, CSS, Vanilla JS, Nginx      |
| Backend   | Node.js, Express.js               |
| Database  | SQLite (via better-sqlite3)       |
| Auth      | JWT (jsonwebtoken) + bcryptjs     |
| Storage   | Local filesystem (Docker volume)  |
| Container | Docker & Docker Compose           |

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) & Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/MOEEZ-PY/photoshare.git
cd photoshare
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set a strong `JWT_SECRET`:

```env
JWT_SECRET=your_strong_random_secret_here
```

### 3. Run

```bash
docker-compose up --build -d
```

The app will be available at **http://localhost**

---

## Project Structure

```
photoshare/
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── auth.js          # Register, login, profile
│       │   ├── media.js         # Upload, list, delete posts
│       │   ├── interactions.js  # Ratings & comments
│       │   ├── notifications.js # Notification feed
│       │   └── analyze.js       # AI image analysis
│       ├── middleware/
│       │   └── auth.js          # JWT middleware
│       ├── db/
│       │   └── database.js      # SQLite setup
│       └── server.js
├── frontend/
│   └── public/
│       ├── index.html           # Login page
│       ├── register.html        # Registration (User / Creator)
│       ├── creator.html         # Creator studio
│       ├── consumer.html        # Consumer feed
│       ├── media.html           # Post detail view
│       ├── css/styles.css
│       └── js/
│           ├── api.js           # Fetch wrapper
│           ├── auth.js          # Auth helpers & page guards
│           ├── theme.js         # Dark / Light mode toggle
│           ├── creator.js
│           ├── consumer.js
│           └── media.js
├── docker-compose.yml
└── .env.example
```

---

## Environment Variables

| Variable           | Default                  | Description                        |
|--------------------|--------------------------|------------------------------------|
| `JWT_SECRET`       | *(required)*             | Secret key for signing JWT tokens  |
| `NODE_ENV`         | `production`             | Node environment                   |
| `PORT`             | `3000`                   | Backend port (internal)            |
| `JWT_EXPIRES_IN`   | `24h`                    | Token expiry duration              |
| `DB_PATH`          | `./data/photoshare.db`   | SQLite database file path          |
| `UPLOAD_DIR`       | `./uploads`              | Media upload directory             |
| `MAX_PHOTO_SIZE_MB`| `10`                     | Max photo upload size              |
| `MAX_VIDEO_SIZE_MB`| `100`                    | Max video upload size              |

---

## API Endpoints

| Method | Endpoint                  | Auth     | Description              |
|--------|---------------------------|----------|--------------------------|
| POST   | `/api/auth/register`      | No       | Create account           |
| POST   | `/api/auth/login`         | No       | Sign in                  |
| GET    | `/api/auth/me`            | Yes      | Get current user         |
| PUT    | `/api/auth/me`            | Yes      | Update profile           |
| GET    | `/api/users/:id`          | No       | Get public profile       |
| GET    | `/api/media`              | Yes      | List / search media      |
| POST   | `/api/media`              | Creator  | Upload new post          |
| DELETE | `/api/media/:id`          | Creator  | Delete own post          |
| POST   | `/api/interactions/rate`  | Yes      | Rate a post              |
| POST   | `/api/interactions/comment`| Yes     | Comment on a post        |
| GET    | `/api/notifications`      | Yes      | Get notifications        |
| POST   | `/api/analyze/:id`        | Yes      | AI analysis of a post    |

---

## Screenshots

| Login | Register | Creator Studio |
|-------|----------|----------------|
| Sign in with username & password | Choose User or Creator account | Upload & manage posts |

| Consumer Feed | Post Detail | Dark / Light Mode |
|---------------|-------------|-------------------|
| Instagram-style feed | Ratings, comments, AI analysis | Toggle on every page |

---

## License

MIT
