# PhotoBazaar

A full-stack photo & video sharing platform with separate **Creator** and **Consumer** experiences, built with Node.js, Express, SQLite, and vanilla HTML/CSS/JS — containerised with Docker and deployed on Azure Container Apps.

**Live Demo:** https://photoshare-frontend.whitebeach-ccac8511.francecentral.azurecontainerapps.io

---

## Features

- **Role-based accounts** — register as a User (consumer) or Creator
- **Creator Studio** — upload photos & videos, manage posts, view stats
- **Consumer Feed** — Instagram-style feed with stories, search, reels, and notifications
- **AI Image Analysis** — get AI-generated descriptions for uploaded media
- **Ratings & Comments** — consumers can rate and comment on posts
- **Dark / Light Mode** — persistent theme toggle on every page
- **JWT Authentication** — secure login with token-based sessions
- **Dockerised** — one command to run everything locally

---

## Tech Stack

| Layer     | Technology                                         |
|-----------|----------------------------------------------------|
| Frontend  | HTML, CSS, Vanilla JS, Nginx                       |
| Backend   | Node.js, Express.js                               |
| Database  | SQLite (via better-sqlite3)                        |
| Auth      | JWT (jsonwebtoken) + bcryptjs                     |
| Storage   | Docker volume (shared between containers)         |
| Container | Docker & Docker Compose                           |
| Registry  | Azure Container Registry (ACR)                    |
| Hosting   | Azure Container Apps (francecentral)              |
| CI/CD     | GitHub Actions                                    |

---

## Getting Started (Local)

### Prerequisites

- [Docker](https://www.docker.com/get-started) & Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/MOEEZ-PY/photobazaar.git
cd photobazaar
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

## Azure Deployment

The app runs as two Azure Container Apps in the `PhotoBazaar_group` resource group (`francecentral`):

| Container App         | Ingress   | Description                          |
|-----------------------|-----------|--------------------------------------|
| `photoshare-backend`  | Internal  | Node.js/Express API on port 3000     |
| `photoshare-frontend` | External  | Nginx serving static files + API proxy |

### CI/CD Pipeline

Every push to `main` triggers the GitHub Actions workflow (`.github/workflows/main.yml`):

1. Builds the backend Docker image and pushes to ACR
2. Builds the frontend Docker image and pushes to ACR
3. ACR webhook automatically restarts the Container Apps with the new `:latest` images

### Required GitHub Secrets

| Secret          | Description                              |
|-----------------|------------------------------------------|
| `ACR_NAME`      | ACR registry name (without `.azurecr.io`) |
| `ACR_PASSWORD`  | ACR admin password                       |

### Environment Variables (Azure)

Set these on the `photoshare-backend` Container App:

| Variable     | Description                    |
|--------------|--------------------------------|
| `JWT_SECRET` | Secret key for JWT signing     |
| `NODE_ENV`   | Set to `production`            |
| `PORT`       | `3000`                         |

Set this on the `photoshare-frontend` Container App:

| Variable       | Description                                    |
|----------------|------------------------------------------------|
| `BACKEND_HOST` | Internal hostname of backend Container App     |

---

## Project Structure

```
photobazaar/
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
│   ├── nginx.conf               # Nginx config with envsubst template
│   ├── Dockerfile
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
├── .github/workflows/
│   └── main.yml                 # GitHub Actions CI/CD
├── docker-compose.yml
└── .env.example
```

---

## Environment Variables

| Variable           | Default                   | Description                        |
|--------------------|---------------------------|------------------------------------|
| `JWT_SECRET`       | *(required)*              | Secret key for signing JWT tokens  |
| `NODE_ENV`         | `production`              | Node environment                   |
| `PORT`             | `3000`                    | Backend port (internal)            |
| `JWT_EXPIRES_IN`   | `24h`                     | Token expiry duration              |
| `DB_PATH`          | `./data/photobazaar.db`   | SQLite database file path          |
| `UPLOAD_DIR`       | `./uploads`               | Media upload directory             |
| `MAX_PHOTO_SIZE_MB`| `10`                      | Max photo upload size              |
| `MAX_VIDEO_SIZE_MB`| `100`                     | Max video upload size              |

---

## API Endpoints

| Method | Endpoint                   | Auth     | Description              |
|--------|----------------------------|----------|--------------------------|
| GET    | `/api/health`              | No       | Health check             |
| POST   | `/api/auth/register`       | No       | Create account           |
| POST   | `/api/auth/login`          | No       | Sign in                  |
| GET    | `/api/auth/me`             | Yes      | Get current user         |
| PUT    | `/api/auth/me`             | Yes      | Update profile           |
| GET    | `/api/users/:id`           | No       | Get public profile       |
| GET    | `/api/media`               | Yes      | List / search media      |
| POST   | `/api/media`               | Creator  | Upload new post          |
| DELETE | `/api/media/:id`           | Creator  | Delete own post          |
| POST   | `/api/interactions/rate`   | Yes      | Rate a post              |
| POST   | `/api/interactions/comment`| Yes      | Comment on a post        |
| GET    | `/api/notifications`       | Yes      | Get notifications        |
| POST   | `/api/analyze/:id`         | Yes      | AI analysis of a post    |

---

## License

MIT
