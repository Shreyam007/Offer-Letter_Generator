# 🚀 OfferFlow HR — Short & Easy Interview Prep Guide

This guide is made for you to quickly read, understand, and explain the project in an interview. Everything is written in simple, easy-to-understand language.

---

## 💡 1. What is this project? (Simple Overview)
**OfferFlow HR** is a bulk offer letter generator tool. It helps HR teams send hundreds of personalized offer letters to candidates in one go.
1. **Upload**: HR uploads a CSV list of candidates.
2. **Review**: HR reviews, edits, and selects candidates in a spreadsheet grid.
3. **Template**: HR writes a letter template using drag-and-drop variables (like `{{Name}}`, `{{Role}}`).
4. **Send & Track**: The app sends emails to all candidates and tracks in real-time when each candidate opens their mail.

---

## 📂 2. Project Sections — Where is the code?

### 📁 Backend (Node.js & Express API)
- **[server.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/server.js)**: Starts the API, connects to MongoDB, and registers routes.
- **[db.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/config/db.js)**: Connects to MongoDB database.
- **[seed.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/config/seed.js)**: Seeds initial demo companies and templates if database is empty on start.
- **`/backend/models`**: Defines database structures:
  - [Company.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/models/Company.js): Organization data & SMTP settings.
  - [Template.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/models/Template.js): Letter subject & body text templates.
  - [Campaign.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/models/Campaign.js): Statistics (Total, Sent, Failed).
  - [Candidate.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/models/Candidate.js): Recipient details & tracking state.
- **`/backend/routes`**: API endpoints:
  - [campaigns.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/campaigns.js): CSV ingestion, candidate CRUD, and inline editing.
  - [email.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/email.js): Sending email loop, tracking pixel requests, and SSE push notification events.

### 📁 Frontend (React SPA & CSS)
- **[App.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/App.jsx)**: Main dashboard page router.
- **[AppContext.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/context/AppContext.jsx)**: Global React state (loaded campaigns, selected candidate IDs, theme status, API endpoints).
- **[index.css](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/index.css)**: Vanilla CSS style rules & Dark Mode color variables.
- **`/frontend/src/components`**:
  - [CsvUpload.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/CsvUpload.jsx): **Step 1 (Upload)**. Parses candidate CSVs client-side using `PapaParse`.
  - [DataReview.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/DataReview.jsx): **Step 2 (Review)**. Spreadsheet-like grid to edit details and select candidates.
  - [TemplateEditor.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/TemplateEditor.jsx): **Step 3 (Edit)**. Write templates and preview them scaled to A4 dimensions.
  - [PreviewSend.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/PreviewSend.jsx): **Step 4 (Send)**. Generates PDF downloads and triggers async email sending.
  - [HistoryTab.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/HistoryTab.jsx): Shows dispatched campaigns list, stats, and real-time open status drawer.
  - [SettingsTab.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/SettingsTab.jsx): Configure company branding and SMTP email servers.

---

## 🎨 3. Dark Mode (How it works & code locations)
- **Concept**: Swaps theme variables dynamically without page re-renders.
- **How it works**:
  1. We store a `theme` state ('light' or 'dark') in React Context. When toggled, we add/remove the `.dark-mode` class from the `<body>` element and save the preference in `localStorage`.
  2. In CSS, we define color tokens (e.g. `--bg-app`, `--bg-card`, `--text-main`) under `body` and override them under `body.dark-mode`. The browser swaps colors instantly.
- **Where to find in code**:
  - State & toggle logic: [AppContext.jsx:L412-L413](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/context/AppContext.jsx#L412-L413)
  - Toggle button: [Header.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/Header.jsx)
  - Theme variables & CSS overrides: [index.css](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/index.css)

---

## ⚡ 4. New Added Features (How they work & code locations)

### A. Real-Time Email Open Tracking (Server-Sent Events)
- **What it does**: When a candidate opens the email in Gmail, their status updates to "Opened" with a timestamp in your History drawer **instantly** (without refreshing the page).
- **How it works**:
  1. When Nodemailer sends the email, we inject a tiny, invisible 1x1 transparent tracking pixel image at the top of the email.
  2. When the candidate opens the email, their mail app requests this image from the backend.
  3. The backend logs the request, updates the database candidate status to "Opened", and serves the 1x1 GIF.
  4. At the same time, the backend broadcasts this open event to the frontend via a persistent **Server-Sent Events (SSE)** connection.
  5. The frontend's `EventSource` receives the broadcast and updates the candidate's status badge in the UI instantly.
  6. **Fallback**: If the SSE stream fails, fallback polling fetches candidates database every 3 seconds with a cache-busting parameter (`?t=Date.now()`) to bypass network caches.
- **Where to find in code**:
  - Backend SSE endpoint (`/track/events`) & tracking pixel router: [email.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/email.js)
  - Frontend client stream connection: [HistoryTab.jsx:L44-L62](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/HistoryTab.jsx#L44-L62)

### B. Gmail-Safe Pixel Injection (Anti-Clipping)
- **What it does**: Fixes the issue where Gmail blocked tracking pixels.
- **How it works**: Gmail clips emails over 102KB (which happens when company logos are embedded as large SVG/base64 strings). If the tracking pixel is at the bottom of the email, Gmail will clip it, and the pixel won't load. We fix this by injecting the pixel immediately after the opening `<body>` tag at the very top of the email body.
- **Where to find in code**:
  - Injection logic: [email.js:L476-L485](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/email.js#L476-L485)

### C. Live Selected Candidate Template Preview
- **What it does**: In Step 3 (Template Editor), the live preview panel on the right displays the exact details (Name, Salary, Role, Date) of the candidate you checked/selected in Step 2.
- **Where to find in code**:
  - Selected candidate lookup: [TemplateEditor.jsx:L236-L248](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/TemplateEditor.jsx#L236-L248)

---

## 💬 5. Quick Interview Answers

**Q: Why use Server-Sent Events (SSE) instead of standard WebSockets?**
- *Answer*: SSE is much simpler and runs over standard HTTP/2, requiring no extra libraries (like Socket.io). It is extremely lightweight for unidirectional real-time updates (server pushing open status updates to client).

**Q: Why do you parse CSV on the client side?**
- *Answer*: Using PapaParse on the frontend offloads computing work from the backend server and allows the browser to validate columns instantly before saving data to MongoDB.

**Q: Why use a 1x1 transparent GIF instead of other formats like PNG?**
- *Answer*: GIFs are the smallest image files possible (only 43 bytes). They are supported by 100% of email clients and don't cause any visual alignment issues.
