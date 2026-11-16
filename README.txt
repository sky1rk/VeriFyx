VERIFYX FRONTEND PROTOTYPE
==========================

Open index.html in a modern browser to explore the application.

Pages:
- index.html: public landing page
- signin.html: USER / ADMIN sign-in switcher
- signup.html: user registration
- user-dashboard.html: user workspace
- admin-dashboard.html: admin workspace
- face-enrollment.html: camera enrollment interface
- attendance.html: camera attendance interface
- examination-verification.html: examination identity verification interface
- attendance-history.html: searchable, filterable attendance records with CSV export (sample data)
- my-profile.html: editable profile, photo upload, auto-generated initials avatar
- settings.html: password form, notification toggles, privacy information, appearance

Camera:
- Camera access requires HTTPS or localhost in most browsers, plus user permission.
- Face detection uses the @vladmandic/face-api browser library and its hosted tiny face detector model.
- An internet connection is required to load the face detection library/model.
- Browser webcam preview is real. Face detection is attempted when the model loads.
- Face detection is NOT identity recognition. No biometric identity matching, template creation, or official attendance recording is implemented.
- Demo sign-in accepts any non-empty ID and password. This is not secure authentication.
- All dashboard statistics and records are illustrative sample data.

Production requirements:
A secure backend, university-approved identity enrollment, validated biometric matching, role-based authorization, database, audit logging, privacy impact assessment, and institutional privacy/legal review are required before deployment.


HOW TO RUN
----------
1. Unzip the project and open index.html in a modern browser (Chrome, Edge, Firefox, Safari).
   For camera pages, serve the folder from localhost, for example:  python3 -m http.server 8000
   then visit http://localhost:8000
2. Sign in with any non-empty ID and password (demo only), choose USER, and use the sidebar.

SHARED PROFILE AND PREFERENCES (js/profile.js)
----------------------------------------------
- Profile data is stored in localStorage under "verifyx_user" (names, email, IDs, account type,
  contact, college, program, year level, profile photo as a small data URL).
- Preferences are stored under "verifyx_preferences" (notification toggles, session notifications).
- js/profile.js exposes window.VX with loadUser, saveUser, getInitials, renderAvatar,
  updateTopNav, getPrefs, savePrefs and validateProfile. Every user page includes it, so the
  top-bar name, ID and avatar stay in sync across pages.
- Initials are generated from the first and last name. They are shown when no photo is set.
- The first sign-in with a given ID creates a demo profile. Signing in with a different ID starts a new one.
- To reset demo data, clear this site's localStorage in your browser developer tools.

NEW PAGE NOTES
--------------
- Attendance records are generated demonstration data, not real university attendance.
- Export CSV downloads all records that match the current search and filters.
- Password changes are validated in the browser only. No password is stored or sent.
- localStorage is for frontend demonstration only. It is not secure storage for credentials or biometric data.
- No biometric data is stored, processed or deleted by these pages.

CHANGES TO EXISTING FILES
-------------------------
- Sidebar links for Attendance History, My Profile and Settings now point to the new pages on
  user-dashboard, face-enrollment, attendance and examination-verification.
- Those pages also load js/profile.js. The dashboard greeting now uses a data attribute for the first name.
- css/style.css: new rules appended at the end. No existing rules were changed.
- js/dashboard.js: fixed the admin demo CSV export, which joined rows with a literal "\n" instead of a line break.
