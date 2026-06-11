# 🚀 TalentDraft — Short & Easy Interview Prep Guide

This guide is made for you to quickly read, understand, and explain the project in an interview. Everything is written in simple, easy-to-understand language.

---

## 💡 1. What is this project? (Simple Overview)
**TalentDraft** is a bulk offer letter generator tool. It helps HR teams send hundreds of personalized offer letters to candidates in one go.
1. **Upload**: HR uploads a CSV list of candidates.
2. **Review**: HR reviews, edits, and selects candidates in a spreadsheet grid.
3. **Template**: HR writes a letter template using drag-and-drop variables (like `{{Name}}`, `{{Role}}`).
4. **Send & Track**: The app sends emails to all candidates containing official offer letter PDFs and secure, interactive view links. It tracks in real-time when each candidate opens their email/portal or digitally accepts their offer.

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
  - [campaigns.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/campaigns.js): CSV Ingestion, Candidate CRUD, and inline editing.
  - [email.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/email.js): Sending email loop, tracking pixel requests, and SSE push notification events.

### 📁 Frontend (React SPA & CSS)
- **[App.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/App.jsx)**: Main dashboard page router & dynamic URL public portal route loader.
- **[AppContext.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/context/AppContext.jsx)**: Global React state (loaded campaigns, selected candidate IDs, theme status, dynamic favicon updater, API endpoints).
- **[index.css](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/index.css)**: Vanilla CSS style rules & Dark Mode color variables.
- **`/frontend/src/components`**:
  - [CsvUpload.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/CsvUpload.jsx): **Step 1 (Upload)**. Parses candidate CSVs client-side using `PapaParse`.
  - [DataReview.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/DataReview.jsx): **Step 2 (Review)**. Spreadsheet-like grid to edit details and select candidates.
  - [TemplateEditor.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/TemplateEditor.jsx): **Step 3 (Edit)**. Write templates and preview them scaled to A4 dimensions.
  - [PreviewSend.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/PreviewSend.jsx): **Step 4 (Send)**. Generates PDF downloads and triggers async email sending.
  - [HistoryTab.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/HistoryTab.jsx): Shows dispatched campaigns list, stats, and real-time open status drawer.
  - [SettingsTab.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/SettingsTab.jsx): Configure company branding and SMTP email servers.
  - [PublicOfferPortal.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/PublicOfferPortal.jsx): Candidate interactive portal where candidates view, accept, or download their offer letter.

---

## 🎨 3. Dark Mode (How it works & code locations)
- **Concept**: Swaps theme variables dynamically without page re-renders.
- **How it works**:
  1. We store a `theme` state ('light' or 'dark') in React Context. When toggled, we add/remove the `.dark-mode` class from the `<body>` element and save the preference in `localStorage`.
  2. In CSS, we define color tokens (e.g. `--bg-app`, `--bg-card`, `--text-main`) under `body` and override them under `body.dark-mode`. The browser swaps colors instantly.
- **Where to find in code**:
  - State & toggle logic: [AppContext.jsx:L504-L505](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/context/AppContext.jsx#L504-L505)
  - Toggle button: [Header.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/Header.jsx)
  - Theme variables & CSS overrides: [index.css](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/index.css)

---

## ⚡ 4. New Added Features (How they work & code locations)

### A. Real-Time Status Tracking & Interactive Candidate Portal (Server-Sent Events)
- **What it does**: Tracks email opens and candidate portal access in real-time, working even if standard tracking pixels are blocked or cached by aggressive mail proxy servers (like Gmail's proxy).
- **How it works**:
  1. **Hybrid Open Tracking**: Employs both an invisible 1x1 GIF pixel inside the HTML email body and a secure candidate portal. Opening the email or loading the portal triggers a request to `/api/email/track/:candidateId`, which logs the `Opened` status and `openedAt` timestamp.
  2. **SSE Synchronization**: The backend broadcasts status updates via standard Server-Sent Events (SSE). The dashboard catches this over a persistent `EventSource` link and immediately updates the candidate list dynamically.
  3. **Digital Offer Acceptance**: Candidates can digitally sign and accept their offer on the portal with a one-click button. This saves their `Accepted` status and `acceptedAt` timestamp in Mongoose and broadcasts the acceptance update to the admin dashboard instantly.
- **Where to find in code**:
  - Backend tracking & SSE: [email.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/email.js)
  - Frontend SSE listener: [AppContext.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/context/AppContext.jsx)
  - Candidate Portal: [PublicOfferPortal.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/PublicOfferPortal.jsx)

### B. Gmail-Safe Pixel Injection (Anti-Clipping)
- **What it does**: Fixes the issue where Gmail blocked tracking pixels.
- **How it works**: Gmail clips emails over 102KB (which happens when company logos are embedded as large SVG/base64 strings). If the tracking pixel is at the bottom of the email, Gmail will clip it, and the pixel won't load. We fix this by injecting the pixel immediately after the opening `<body>` tag at the very top of the email body.
- **Where to find in code**:
  - Injection logic: [email.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/email.js)

### C. Live Selected Candidate Template Preview
- **What it does**: In Step 3 (Template Editor), the live preview panel on the right displays the exact details (Name, Salary, Role, Date) of the candidate you checked/selected in Step 2.
- **Where to find in code**:
  - Selected candidate lookup: [TemplateEditor.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/TemplateEditor.jsx)

### D. Wizard Progress Auto-Save (Draft Recovery)
- **What it does**: Saves configuration progress automatically to prevent data loss on browser refresh, tab closure, or app disconnects.
- **How it works**: Any transition of steps (1 to 4) or selection of an active campaign is saved to `localStorage` under `talentdraft_wizard_draft`. On page mount, the React context detects if a draft exists, checks if the campaign is still active in the database, and displays a recovery banner.
- **Where to find in code**:
  - React Context state and recovery hooks: [AppContext.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/context/AppContext.jsx)

### E. Dynamic Browser Tab Favicon Swapper
- **What it does**: Browser tab favicons are updated dynamically to display the selected company's logo branding, rather than a default logo, to customize the experience for both admins and candidates.
- **Where to find in code**:
  - Admin Dashboard swapper hook: [AppContext.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/context/AppContext.jsx)
  - Candidate Portal swapper hook: [PublicOfferPortal.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/PublicOfferPortal.jsx)

---

## 💬 5. Quick Interview Answers

**Q: Why use Server-Sent Events (SSE) instead of standard WebSockets?**
- *Answer*: SSE is much simpler and runs over standard HTTP/2, requiring no extra libraries (like Socket.io). It is extremely lightweight for unidirectional real-time updates (server pushing open status updates to client).

**Q: Why do you parse CSV on the client side?**
- *Answer*: Using PapaParse on the frontend offloads computing work from the backend server and allows the browser to validate columns instantly before saving data to MongoDB.

**Q: Why use a 1x1 transparent GIF instead of other formats like PNG?**
- *Answer*: GIFs are the smallest image files possible (only 43 bytes). They are supported by 100% of email clients and don't cause any visual alignment issues.

**Q: How do you bypass email client image proxies when tracking opens?**
- *Answer*: We deploy a hybrid tracking method. Instead of relying solely on tracking pixels (which are cached or blocked by Gmail and Outlook proxies), we send the candidate a secure, direct portal link. The moment they open their portal page, we trigger a direct REST tracking request to the API, immediately syncing their status as "Opened".
