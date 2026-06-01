# 🚀 OfferFlow HR — Project Documentation & System Manual

This file provides comprehensive technical documentation for the **OfferFlow HR** project. It details the system architecture, folder breakdown, database schemas, and implementation design for features like Dark Mode, Real-Time Email Tracking (SSE), and Gmail Anti-Clipping.

---

## 1. Abstract
**OfferFlow HR** is a MERN-stack bulk offer letter generator dashboard. It automates the HR onboarding workflow by allowing coordinators to upload candidate data spreadsheets (CSV), clean and validate candidate records in a spreadsheet grid, customize document templates (Modern, Classic, Minimal) using dynamic placeholder variables, and dispatch offer letters via SMTP. 

The application incorporates a **real-time email open tracking engine** that registers open events and timestamps using a transparent tracking pixel. It updates candidate status logs in the History drawer immediately without page reloads using **Server-Sent Events (SSE)**.

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
* `status`: Tracking status (String: Pending, Validated, Invalid Email, Sending, Sent, Failed, Opened)
* `openedAt`: Email open timestamp (Date)
* `error`: Transmission error logs (String)
* `customFields`: Extended CSV properties mapping (Map of Strings)

---

## 6. Key Features Implementation Details

### A. Interactive Data Grid (Data Review)
In Step 2 of the wizard, candidate records are shown in a spreadsheet-style grid ([DataReview.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/DataReview.jsx)). HR coordinators can search, filter by role, or edit values. On blur, the page calls `PUT /api/campaigns/candidates/:id` to save edits and automatically runs email validation.

### B. Dynamic PDF Layout Scaling (Template Editor)
To display a pixel-perfect A4 sheet in the browser ([TemplateEditor.jsx](file:///c:/Users/Shreyam/OneDrive/Desktop/OfferLetter%20Generator/frontend/src/components/TemplateEditor.jsx)), we use a `ResizeObserver` that watches the preview panel size and applies `transform: scale(...)` to scale the A4 preview box dynamically without breaking text wraps, margins, or header spacing.

### C. Real-time Open Tracking (Server-Sent Events)
During dispatch, our mailing engine appends an image tag to the email template:
`https://offer-letter-generator-whu4.onrender.com/api/email/track/:candidateId.gif`
When the email is opened, the client requests this GIF. The backend route:
1. Updates candidate status to `'Opened'` and logs the `openedAt` timestamp.
2. Serves a 43-byte transparent GIF with cache-disabling HTTP headers.
3. Broadcasts this status change to all open frontend client streams via **Server-Sent Events (SSE)**.
4. **Fallback**: If the live stream is blocked, the frontend polls the database every 3 seconds with a cache-busting timestamp (`?t=Date.now()`).

### D. Gmail-Safe Pixel Injection (Anti-Clipping)
Gmail clips emails over 102KB (commonly caused by large base64/SVG logo structures). If the tracking pixel sits at the bottom of the email, Gmail will clip it, preventing it from loading. We resolved this by injecting the pixel immediately after the opening `<body>` tag at the very top of the email body.

### E. Persistent Dark Mode
Managed globally via React Context, toggling a `.dark-mode` class on the `<body>` element and caching it in `localStorage`. Styling swaps are handled instantly via CSS variables.

---

## 7. Troubleshooting & Layout Refactorings
* **Scrollable Editor Canvas**: Removed fixed heights and `overflow: hidden` from the editor container to allow natural page scrolling. Set `min-height: 650px` and a dynamic `height: calc(100vh - 280px)` on `.template-grid` to ensure a spacious editing textarea.
* **Branding Logo Constraint**: Added `.logo-svg-wrapper` and `.logo-img-wrapper` to keep vector company logos locked at a maximum of 32x32px, preventing logo bleeds from breaking the navigation toolbars.

---

## 8. Conclusion
OfferFlow HR successfully automates document merging and email tracking, providing an easy-to-use platform for HR teams. Future scope includes adding support for SMS/WhatsApp offer alerts, integration with applicant tracking systems (like Greenhouse or Workday), and multi-stage signature signing (DocuSign integrations).
