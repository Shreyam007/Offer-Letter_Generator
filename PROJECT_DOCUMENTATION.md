# 🚀 TalentDraft — Project Documentation & System Manual

This file provides comprehensive technical documentation for the **TalentDraft** project. It details the system architecture, folder breakdown, database schemas, and implementation design for features like Dark Mode, Real-Time Email Tracking (SSE), and Gmail Anti-Clipping.

---

## 1. Abstract
**TalentDraft** is a MERN-stack bulk offer letter generator dashboard. It automates the HR onboarding workflow by allowing coordinators to upload candidate data spreadsheets (CSV), clean and validate candidate records in a spreadsheet grid, customize document templates (Modern, Classic, Minimal) using dynamic placeholder variables, and dispatch offer letters via SMTP. 

The application incorporates a **real-time status tracking engine** that registers open events and timestamps using both a transparent tracking pixel in sent emails and a dedicated Candidate Interactive Portal. It updates candidate status logs in the History drawer immediately without page reloads using **Server-Sent Events (SSE)**.

---

## 2. Introduction & Objectives
Traditional candidate onboarding relies on manual template construction, individual mailing, and lack of status transparency. The objectives of this project are:
* **Automation**: Map candidate spreadsheet details directly into custom letter templates using placeholder variables (e.g. `{{Name}}`, `{{Role}}`).
* **Validation**: Enforce email pattern matching and details validation inside the browser prior to database writes.
* **Tracking**: Provide live visibility on email dispatch and open rates.
* **Security**: Support custom, encrypted SMTP variables for multiple company branches.

---

## 3. System Architecture & Workflow
The application follows a decoupled client-server architecture:
1. **Frontend Client**: React SPA compiled using Vite. Uses PapaParse for browser CSV extraction, custom CSS tokens for Light/Dark variables, and EventSource for real-time SSE stream connections.
2. **Backend API Server**: Node.js/Express.js REST API handling templates CRUD, candidate records upserts, Nodemailer delivery loops, and tracking pixel routes.
3. **Cloud Database**: MongoDB Atlas managed via Mongoose schemas. Stores company profiles, templates, campaigns, candidates, and delivery audit logs.

```
[Candidate CSV] 
       │ (PapaParse client-side)
       ▼
[React Frontend Client] ◄───(SSE EventSource Link)───┐
       │ (REST APIs)                                │
       ▼                                            │
[Express Backend API] ◄───(Pixel HTTP GET)──┐       │ (Status Broadcast)
       │                                     │       │
       ├─(Mongoose)──► [MongoDB Atlas DB]    │       │
       │                                     │       │
       └─(Nodemailer)─► [SMTP Server]        │       │
                              │              │       │
                       (Deliver Mail)        │       │
                              ▼              │       │
                     [Candidate Inbox] ──────┴───────┘
                     (Opens Mail -> Loads Pixel)
```

---

## 4. Technology Stack
* **Frontend SPA**: React.js (v18+)
* **Build Tool**: Vite
* **Design & Styling**: Vanilla CSS Custom Properties (Variables)
* **CSV Parsing**: PapaParse (runs entirely on the client)
* **Backend Server**: Node.js & Express.js
* **Mailing Engine**: Nodemailer
* **Database**: MongoDB Atlas & Mongoose
* **PDF Compilation Engine**: PDFKit (pure JS in-memory buffer generation)

---

## 5. Database Schema & Models

### A. Company Profile Model (`Company.js`)
Stores company branding info and SMTP configurations.
* `name`: Company Name (String, Required)
* `tagline`: Tagline (String)
* `logo`: Branding asset code (String - SVG or Base64 Image)
* `address`: Mailing Address (String)
* `email`: Careers Email (String)
* `phone`: Phone Number (String)
* `website`: Domain (String)
* `smtp`: Nested object:
  * `host`: Mail server (String)
  * `port`: Connection port (Number)
  * `secure`: SSL flag (Boolean)
  * `user`: Login username (String)
  * `pass`: Password key (String)

### B. Template Model (`Template.js`)
* `name`: Style Name (String, Required)
* `subject`: Subject Line (String, Required)
* `body`: Letter body with placeholder brackets (String, Required)
* `style`: Layout style (String: Modern, Classic, Minimal)
* `companyId`: Reference to parent company ID (Mongoose ObjectId)

### C. Candidate Model (`Candidate.js`)
* `campaignId`: Reference to active campaign (Mongoose ObjectId)
* `name`: Candidate Name (String, Required)
* `email`: Recipient Email (String, Required)
* `role`: Job Title (String)
* `department`: Team Name (String)
* `salary`: Compensation (String)
* `joiningDate`: Start Date (String)
* `status`: Tracking status (String: Pending, Validated, Invalid Email, Sending, Sent, Failed, Opened, Accepted)
* `openedAt`: Email open timestamp (Date)
* `acceptedAt`: Candidate acceptance timestamp (Date)
* `error`: Transmission error logs (String)
* `customFields`: Extended CSV properties mapping (Map of Strings)

---

## 6. Key Features Implementation Details

### A. Interactive Data Grid (Data Review)
In Step 2 of the wizard, candidate records are shown in a spreadsheet-style grid ([DataReview.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/DataReview.jsx)). HR coordinators can search, filter by role, or edit values. On blur, the page calls `PUT /api/campaigns/candidates/:id` to save edits and automatically runs email validation.

### B. Dynamic Preview Data Binding & Scaling (Template Editor)
- **Scaling**: To display a pixel-perfect A4 sheet in the browser ([TemplateEditor.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/TemplateEditor.jsx)), we use a `ResizeObserver` that watches the preview panel size and applies `transform: scale(...)` to scale the A4 preview box dynamically without breaking text wraps, margins, or header spacing.
- **Dynamic Bindings**: The editor binds the selected candidate's real credentials (name, email, role, department, salary, start date) dynamically in the preview sheet across all three styles (**Modern**, **Classic**, **Minimal**). The date and reference codes are computed dynamically to match the backend PDF generator.

### C. Real-time Status Tracking & Interactive Candidate Portal (Server-Sent Events)
To ensure tracking is 100% reliable and immune to aggressive caching or blocking by mail proxy servers (e.g., Gmail's proxy, Outlook's proxy), the system employs a hybrid tracking mechanism:
1. **Candidate Interactive Portal**: A secure public-facing portal ([PublicOfferPortal.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/PublicOfferPortal.jsx)) is deployed. When candidates click their unique view link, the portal triggers an API call `/api/email/track/:candidateId` on mount. This ensures the offer status changes to `'Opened'` even if pixel-tracking is blocked.
2. **Tracking Pixel**: An invisible pixel `<img src="[Host_Domain]/api/email/track/:candidateId.gif" />` is injected near the top of the HTML email template (Gmail-safe position).
3. **Dynamic Domain Resolution**: Automatically resolves the tracking URL host using the request's origin (`req.protocol` and `req.get('host')`), removing the need for hardcoded environment variables.
4. **Robust Route Matching**: Backend route matches `/api/email/track/:candidateId` and automatically strips `.gif` extensions programmatically to avoid dot-separator routing issues.
5. **CORS Headers**: Serves with `Access-Control-Allow-Origin: *` headers, allowing cross-origin requests from mail proxies and remote portal contexts.
6. **SSE Status Broadcast**: Once an open/access event is recorded, the backend updates MongoDB with the `Opened` status and `openedAt` timestamp, and immediately broadcasts the update to all active admin dashboards over **Server-Sent Events (SSE)** for zero-refresh UI sync.
7. **Digital Offer Acceptance**: The interactive candidate portal features a one-click digital acceptance button. Clicking this triggers `POST /api/email/public/candidate-offer/:candidateId/accept`, which transitions the candidate's status to `Accepted`, stamps the exact date, updates campaign metrics, and triggers a real-time SSE broadcast back to the admin dashboard.

### D. Gmail-Safe Pixel Injection (Anti-Clipping)
Gmail clips emails over 102KB (commonly caused by large base64/SVG logo structures). If the tracking pixel sits at the bottom of the email, Gmail will clip it, preventing it from loading. We resolved this by injecting the pixel immediately after the opening `<body>` tag at the very top of the email body.

### E. Persistent Dark Mode
Managed globally via React Context, toggling a `.dark-mode` class on the `<body>` element and caching it in `localStorage`. Styling swaps are handled instantly via CSS variables.

### F. Automated PDF Offer Letter Attachments
To align with professional company workflows, the email dispatch loop automatically generates a matching PDF copy of the candidate's custom offer letter. 
- **Pure-JS Buffer Generation**: Uses `pdfkit` to compile the layout coordinates on the server-side, avoiding chromium-based headless browser packages that cause memory-limit crashes on Render's free tier.
- **Style Inheritance**: Inherits the selected template theme (`Modern`, `Classic`, or `Minimal`), generating a PDF with branding headers, custom double-border dividing rules, styled tables for compensation and start dates, and confidentiality notices.
- **Attachment Injection**: Compiles the PDF binary buffer in-memory and appends it to the Nodemailer/Resend attachments array under the candidate's specific name.

### G. Database Fetching Speedups (Indexes & Lean Queries)
- **Indexes**: Added MongoDB indexes on all foreign key fields (`campaignId` in Candidates and History, `companyId` and `templateId` in Campaigns and Templates) to optimize query scanning.
- **Mongoose Lean**: Utilized `.lean()` on all read-only Mongoose queries to return plain JavaScript objects, reducing Node.js memory usage and boosting data retrieval speeds.

### H. SEO & Core Web Vitals Optimization
- **SEO Elements**: Added metadata descriptions, keyword tags, and OpenGraph social integration to `index.html`.
- **Render blocking removal**: Shifted Google Fonts loading from CSS `@import` rules to HTML preconnect and `<link>` headers, reducing page paint latencies (FOUT/CLS) and improving page speed.

### I. Dynamic Tab Favicon & Branding Renaming
- **Dynamic Favicons**: Implemented dynamic browser favicon rendering in the React frontend. Both the admin dashboard (via a `useEffect` inside `AppContext.jsx` watching `selectedCompany`) and the public candidate portal (via `PublicOfferPortal.jsx` watching `offerData`) dynamically swap the browser tab's favicon link to match the SVG or raster base64 logo of the active company context.
- **Branding Architecture**: Renamed all brand assets from "OfferFlow HR" to "TalentDraft", aligning titles, meta descriptions, search tags, headers, and footers across the MERN repository.

---

## 7. Troubleshooting & Layout Refactorings
* **Scrollable Editor Canvas**: Removed fixed heights and `overflow: hidden` from the editor container to allow natural page scrolling. Set `min-height: 650px` and a dynamic `height: calc(100vh - 280px)` on `.template-grid` to ensure a spacious editing textarea.
* **Branding Logo Constraint**: Added `.logo-svg-wrapper` and `.logo-img-wrapper` to keep vector company logos locked at a maximum of 32x32px, preventing logo bleeds from breaking the navigation toolbars.

---

## 8. Conclusion
TalentDraft successfully automates document merging and email tracking, providing an easy-to-use platform for HR teams. Future scope includes adding support for SMS/WhatsApp offer alerts, integration with applicant tracking systems (like Greenhouse or Workday), and multi-stage signature signing (DocuSign integrations).
