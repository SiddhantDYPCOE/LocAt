# 🌍 LocAt – Real-Time Location-Based Social Connectivity Platform

\<p align="center">   \<strong>Stay Connected. Stay Close. Travel Together.\</strong> \</p>

\<p align="center">   A full-stack social connectivity platform that brings together real-time messaging, user connections, live location sharing, and collaborative journey tracking. \</p>

\<p align="center">
&#x20; \<a href="[https://atposition.vercel.app/](https://atposition.vercel.app/)">Live Demo\</a> •
&#x20; \<a href="[https://github.com/SiddhantDYPCOE/LocAt](https://github.com/SiddhantDYPCOE/LocAt)">GitHub Repository\</a>
\</p>

---

## 📖 About the Project

**LocAt** is a location-aware social platform designed to make communication and staying connected more meaningful.

Users can discover other people, build connections, communicate through real-time messaging, share their live location, and coordinate journeys with friends.

Unlike traditional messaging applications, LocAt combines social networking with location intelligence, allowing users to see shared locations on an interactive map and track participants during a common journey.

## ✨ Key Features

### 👥 User Authentication & Connections

- Secure user registration and login using JWT authentication.
- HTTP-only cookie-based session management.
- Search and discover registered users.
- Send, accept, reject, and manage connection requests.
- Access messaging and location-sharing features through accepted connections.

### 💬 Real-Time Messaging

- Instant message delivery using Socket.IO.
- Direct conversations between connected users.
- Online socket connections and personal user rooms.
- Real-time text and location messages.
- Conversation history and read-status management.

### 📍 Live Location Sharing

- Track your current location using the browser Geolocation API.
- Share your live location with selected connections.
- Display shared locations through interactive map markers.
- Receive location updates in real time using Socket.IO.
- Configure sharing durations or manually stop sharing.
- Restrict location visibility to authorized connections.

### 🗺️ Interactive Maps

- Interactive maps powered by Leaflet and OpenStreetMap.
- Display your current position and shared locations.
- Visualize multiple users on a common map.
- View location information through map markers and popups.

### 🚗 Collaborative Journey Tracking

- Create journeys with a common destination.
- Invite accepted connections to participate.
- Allow participants to specify their individual starting locations.
- Accept or decline journey invitations.
- Start, complete, or cancel journeys.
- Track participants' live locations during active journeys.
- Synchronize participant statuses, including arrival and departure.

---

## 🛠️ Tech Stack

| Layer                   | Technologies                          |
| ----------------------- | ------------------------------------- |
| Frontend                | React 19, Vite                        |
| Styling                 | Tailwind CSS                          |
| Routing                 | React Router DOM                      |
| Backend                 | Node.js, Express 5                    |
| Database                | PostgreSQL (Neon)                     |
| ORM                     | Prisma 7                              |
| Real-Time Communication | Socket.IO                             |
| Authentication          | JWT, bcryptjs, HTTP-only Cookies      |
| Maps                    | Leaflet, React Leaflet, OpenStreetMap |
| HTTP Client             | Axios                                 |
| Validation              | Zod                                   |
| Icons                   | Lucide React                          |

---

## 🏗️ Application Architecture

LocAt follows a modular full-stack architecture.

```text
                 ┌──────────────────────┐
                 │     React Frontend   │
                 │   React + Tailwind   │
                 └──────────┬───────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
          REST API Requests       Socket.IO Events
                │                       │
                ▼                       ▼
       ┌────────────────────────────────────┐
       │          Express Backend           │
       │                                    │
       │  Authentication & Authorization   │
       │  Connections Module               │
       │  Chat Module                      │
       │  Location Module                  │
       │  Journey Module                   │
       └──────────────────┬─────────────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │ PostgreSQL     │
                 │ Neon + Prisma  │
                 └────────────────┘
```

### Real-Time Communication

Socket.IO is used for bidirectional communication between clients and the server.

- **Chat:** Conversation rooms and personal user rooms handle message delivery.
- **Location:** Authorized users join location-sharing rooms and receive live coordinate updates.
- **Journeys:** Journey participants join dedicated rooms to synchronize location and member-status updates.
- **Authentication:** Socket connections are authenticated using JWT before event handling.

---

## 📂 Project Structure

```text
LocAt/
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── middlewares/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── connections/
│   │   │   ├── chat/
│   │   │   ├── location/
│   │   │   └── journey/
│   │   │
│   │   ├── socket/
│   │   ├── utils/
│   │   └── db.js
│   │
│   ├── app.js
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── socket/
│   │   └── App.jsx
│   │
│   └── package.json
│
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js (18 or higher)
- npm
- PostgreSQL database (Neon recommended)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/SiddhantDYPCOE/LocAt.git

cd LocAt
```

### 2. Backend Setup

```bash
cd backend

npm install
```

Create a `.env` file inside the backend directory:

```env
PORT=5000
NODE_ENV=development

DATABASE_URL=your_neon_database_url

JWT_SECRET=your_jwt_secret

CLIENT_URL=http://localhost:5173
```

Generate the Prisma client and apply your database migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Start the backend:

```bash
npm run dev
```

The backend will run at:

```text
http://localhost:5000
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend

npm install
```

Create a `.env` file inside the frontend directory:

```env
VITE_API_URL=http://localhost:5000/api

VITE_SOCKET_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

The frontend will run at:

```text
http://localhost:5173
```

---

## 🔐 Security & Authorization

LocAt implements several security measures:

- Password hashing using bcryptjs.
- JWT-based authentication.
- HTTP-only cookies for web authentication.
- Protected API routes using authentication middleware.
- Socket.IO authentication during connection handshakes.
- Zod schema validation for incoming requests.
- Authorization checks for private conversations and location-sharing sessions.
- Connection-based restrictions on messaging, location sharing, and journey invitations.

---

## 🌐 Deployment

| Component | Platform        |
| --------- | --------------- |
| Frontend  | Vercel          |
| Backend   | Render          |
| Database  | Neon PostgreSQL |

**Live Application:** [https://atposition.vercel.app/](https://atposition.vercel.app/)

---

## 🎯 Learning Outcomes

Building LocAt helped explore and implement:

- Full-stack application architecture.
- REST API development and modular backend design.
- JWT authentication and HTTP-only cookie management.
- Real-time bidirectional communication using Socket.IO.
- Socket rooms, event emission, event listeners, and acknowledgements.
- Relational database modeling using Prisma and PostgreSQL.
- Browser Geolocation API integration.
- Real-time map synchronization using Leaflet.
- Multi-user location sharing and collaborative journey workflows.
- Frontend state management using React Context API.

---

## 👨‍💻 Author

**Siddhant Pitlawar**

- GitHub: [@SiddhantDYPCOE](https://github.com/SiddhantDYPCOE)
- Project: [LocAt](https://github.com/SiddhantDYPCOE/LocAt)
- Live Demo: [atposition.vercel.app](https://atposition.vercel.app/)

---

\<p align="center">
&#x20; \<strong>LocAt – Stay Connected. Stay Close. Travel Together. 🌍\</strong>
\</p>
