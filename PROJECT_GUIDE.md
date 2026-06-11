# TalentDraft — Comprehensive File Directory

A concise, high-impact guide documenting every file in the codebase. It details what each file contains, what it means, and why it exists in the system architecture.

---

## 📂 Project Root Configurations

### 📄 [.gitignore](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/.gitignore)
- **What it is:** Global repository exclusion list.
- **What it contains:** Rules to ignore folders like `node_modules/`, frontend compilation builds, and local secret files like `.env`.
- **Why it exists:** Keeps credentials secure, avoids bloating git, and enforces environment independence.

### 📄 [PROJECT_GUIDE.md](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/PROJECT_GUIDE.md)
- **What it is:** Codebase architectural blueprint.
- **What it contains:** Comprehensive file map, data flow diagram summaries, and design specifications.
- **Why it exists:** Provides instant onboard familiarity and reference for development and reviews.

---

## 📂 Backend Codebase (`/backend`)

### 📁 Root Files & Configuration

#### 📄 [server.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/server.js)
- **What it is:** Express API server entry point.
- **What it contains:** Router middleware bindings, port initialization, CORS definitions, and database startup connections.
- **Why it exists:** Acts as the backend bootstrapper, listening for API requests from the frontend client.

#### 📄 [package.json](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/package.json)
- **What it is:** Node package manifest.
- **What it contains:** Dependencies (Mongoose, Express, Nodemailer, CORS), and script commands (`start`, `dev`).
- **Why it exists:** Standardizes package installation, dependencies, and execution scripts for Node.

#### 📄 [.env](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/.env)
- **What it is:** Backend environment file.
- **What it contains:** Config variables (`PORT`, `MONGO_URI`) for the local server environment.
- **Why it exists:** Declares secrets and connection endpoints dynamically, keeping sensitive information out of source control.

---

### 📁 Config Layer (`/backend/config`)

#### 📄 [db.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/config/db.js)
- **What it is:** MongoDB connector.
- **What it contains:** Connection script utilizing Mongoose with error logging and fail-safe fallbacks.
- **Why it exists:** Initializes a unified, persistent connection pool to MongoDB at application startup.

#### 📄 [seed.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/config/seed.js)
- **What it is:** Database pre-populator.
- **What it contains:** Fallback definitions and creation scripts for initial templates and default company profiles.
- **Why it exists:** Seeds clean demo layouts (Modern, Classic) if the database is detected empty, ensuring the app runs immediately.

#### 📄 [constants.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/config/constants.js)
- **What it is:** Static assets store.
- **What it contains:** Base64-encoded SVG branding vector data (like the orange AICTE gear logo).
- **Why it exists:** Embeds heavy graphic assets inline to secure offline availability and avoid slow external queries.

---

### 📁 Models Layer (`/backend/models`)

#### 📄 [Company.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/models/Company.js)
- **What it is:** Company Profile Schema.
- **What it contains:** Schema mapping name, address, email, custom SVG logos, and encrypted SMTP configuration structures.
- **Why it exists:** Models the database structure of sender profiles, storing required mailing configurations.

#### 📄 [Template.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/models/Template.js)
- **What it is:** Email Template Schema.
- **What it contains:** Fields for template name, subject line, body template text, HTML flags, and layouts (Modern, Classic, Minimal).
- **Why it exists:** Models the reusable visual structures and text files for generating dynamically merged offers.

#### 📄 [Campaign.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/models/Campaign.js)
- **What it is:** Batch Campaign Schema.
- **What it contains:** References to parent company and active template, tracking status (Draft, Sending, Completed) and batch tallies.
- **Why it exists:** Captures stats and state for entire CSV uploads, linking all candidate runs to a single audit source.

#### 📄 [Candidate.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/models/Candidate.js)
- **What it is:** Candidate Record Schema.
- **What it contains:** Candidate columns (Name, Email, Phone, Role, Duration) and nested key-value custom fields mapped from CSV uploads.
- **Why it exists:** Stores individual recipient information, tracking dispatch outcomes (Pending, Sending, Sent, Failed, Opened, Accepted).

#### 📄 [History.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/models/History.js)
- **What it is:** Delivery Audit Log Schema.
- **What it contains:** Delivery transaction logs linking to parent campaigns, tracking outcome timestamps, and tracking failure reasons.
- **Why it exists:** Provides a read-only historical ledger of emails sent, enabling audit lookups and PDF archiving.

---

### 📁 Routes Layer (`/backend/routes`)

#### 📄 [companies.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/companies.js)
- **What it is:** Company REST Controller.
- **What it contains:** GET, POST, PUT routes for seeding default accounts and editing active sender SMTP profiles.
- **Why it exists:** Exposes the API endpoint `/api/companies` to allow frontends to query and update sender information.

#### 📄 [templates.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/templates.js)
- **What it is:** Template REST Controller.
- **What it contains:** CRUD routes mapping templates to specific company IDs, and updating HTML editor bodies.
- **Why it exists:** Exposes `/api/templates` endpoint, driving template creation and modifications.

#### 📄 [campaigns.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/campaigns.js)
- **What it is:** Campaign & CSV REST Controller.
- **What it contains:** CSV ingestion parsers, batch candidate upserts, single-row editor controllers, and campaign deletion routes.
- **Why it exists:** Exposes `/api/campaigns` endpoint, driving the data load and grid modification workflow.

#### 📄 [email.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/email.js)
- **What it is:** Nodemailer REST Dispatcher.
- **What it contains:** SMTP connection diagnostics (`/test-smtp`), candidate portal acceptance endpoints, and asynchronous delivery loops (`/send-campaign`).
- **Why it exists:** Exposes `/api/email`, testing local SMTP endpoints and orchestrating mail merge loops.

#### 📄 [history.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/backend/routes/history.js)
- **What it is:** History Audit REST Controller.
- **What it contains:** Fetch APIs querying the historical delivery log collections.
- **Why it exists:** Exposes `/api/history` endpoint, populating audit views and archiving systems.

---

## 📂 Frontend Codebase (`/frontend`)

### 📁 Root Files & Configuration

#### 📄 [package.json](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/package.json)
- **What it is:** Node package manifest.
- **What it contains:** React dependencies (lucide-react, papaparse) and Vite scripts (`dev`, `build`, `preview`).
- **Why it exists:** Handles package declarations and compilation parameters for React.

#### 📄 [vite.config.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/vite.config.js)
- **What it is:** Vite assetbundler config.
- **What it contains:** React compiler plugins.
- **Why it exists:** Configures HMR (Hot Module Replacement) and optimized bundlings for production deployment.

#### 📄 [index.html](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/index.html)
- **What it is:** HTML entry document.
- **What it contains:** The viewport container `<div id="root"></div>` and scripts importing `/src/main.jsx`.
- **Why it exists:** Provides the standard window frame where React attaches the virtual DOM node.

#### 📄 [eslint.config.js](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/eslint.config.js)
- **What it is:** JavaScript and React code linter.
- **What it contains:** Project style rules, react-hooks validation patterns, and code safety standards.
- **Why it exists:** Standardizes formatting, rules, and flags errors during local development builds.

#### 📄 [.gitignore](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/.gitignore)
- **What it is:** Subfolder git exclusion list.
- **What it contains:** Local workspace specific rules (ignoring `/dist` compile build output folders).
- **Why it exists:** Avoids checking in local production build directories to code repositories.

---

### 📁 Core Source (`/frontend/src`)

#### 📄 [main.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/main.jsx)
- **What it is:** Client-side React bootstrapper.
- **What it contains:** Script mapping the root React element to the target DOM container.
- **Why it exists:** Boots the React execution engine and attaches the base `<App />` component.

#### 📄 [App.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/App.jsx)
- **What it is:** Core layout dashboard.
- **What it contains:** State controllers tracking top-level navigation tabs and rendering the sidebar frame structure.
- **Why it exists:** Controls screen switching (Workflow, Templates, History, Settings) and manages viewport structures.

#### 📄 [index.css](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/index.css)
- **What it is:** Global CSS stylesheet.
- **What it contains:** Color palettes, custom typography styles, scroll bars, glassmorphic grids, and letter layout stylesheets.
- **Why it exists:** Dictates the entire look, premium layout templates, animations, and typography styles.

---

### 📁 Context Layer (`/frontend/src/context`)

#### 📄 [AppContext.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/context/AppContext.jsx)
- **What it is:** Global React State Context Provider.
- **What it contains:** Multi-step wizard state variables, fetch wrapper scripts, dynamic browser tab favicon hooks, and the dynamic `API_BASE` environment resolver.
- **Why it exists:** Serves as the application's central data engine, providing component states and API endpoints to all UI views.

---

### 📁 Components Layer (`/frontend/src/components`)

#### 📄 [Sidebar.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/Sidebar.jsx)
- **What it is:** Left sidebar navigation.
- **What it contains:** Navigation buttons, active tab visual indicators, and brand representations.
- **Why it exists:** Serves as the primary navigator for shifting tabs across the dashboard context.

#### 📄 [Header.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/Header.jsx)
- **What it is:** Application top header.
- **What it contains:** Active contextual headers, navigation tabs, and system refresh actions.
- **Why it exists:** Displays system-wide status updates, steps indicators, and logo references.

#### 📄 [CsvUpload.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/CsvUpload.jsx)
- **What it is:** Wizard Step 1: Data Ingestion Panel.
- **What it contains:** Dropzones, CSV headers parsers (using Papaparse), and campaigns initialization endpoints.
- **Why it exists:** Lets users load CSV lists, validating schema formats, and bootstrapping campaigns.

#### 📄 [DataReview.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/DataReview.jsx)
- **What it is:** Wizard Step 2: Spreadsheet Data Grid.
- **What it contains:** Interactive search forms, filter toggles, inline row editors, and candidate delete triggers.
- **Why it exists:** Gives users control to review, edit, or reject candidate rows before generating templates.

#### 📄 [TemplateEditor.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/TemplateEditor.jsx)
- **What it is:** Wizard Step 3: Layout & WYSIWYG Editor.
- **What it contains:** Code editors, drag-and-drop syntax helpers, HTML switch toggles, and live letter preview templates.
- **Why it exists:** Drives the design phase, allowing live CSS layouts (Modern, Classic, Minimal) and editing text.

#### 📄 [PreviewSend.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/PreviewSend.jsx)
- **What it is:** Wizard Step 4: Dispatch Console.
- **What it contains:** Delay controllers, mail previewers, PDF generator controls (using off-screen print DOM), and launch controls.
- **Why it exists:** Drives campaign dispatch runs, tracks delivery status in real-time, and issues local candidate PDFs.

#### 📄 [SettingsTab.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/SettingsTab.jsx)
- **What it is:** Company & Mail configuration panel.
- **What it contains:** Input forms for company details (Address, Website), SMTP configuration profiles, and connection testing buttons.
- **Why it exists:** Drives organization personalization, configures sending SMTP servers, and troubleshoots server connections.

#### 📄 [HistoryTab.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/HistoryTab.jsx)
- **What it is:** Mail Delivery Archive.
- **What it contains:** Campaign lists, success indicators, logs tables, and backup PDF export controls.
- **Why it exists:** Provides complete insight into historical batch results, showing delivery statistics and error reasons.

#### 📄 [PublicOfferPortal.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/PublicOfferPortal.jsx)
- **What it is:** Candidate Interactive Portal.
- **What it contains:** Responsive layouts (Modern, Classic, Minimal) for candidate offer review, dynamic company logo favicons, server-side PDFKit high-fidelity download links, and a digital offer acceptance flow.
- **Why it exists:** Exposes secure candidate offer letters publicly, registers open analytics, and supports candidate job acceptance.
