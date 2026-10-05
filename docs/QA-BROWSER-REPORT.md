# UI QA Browser Report (via Chrome DevTools/Puppeteer)

## 1. Unauthenticated Routes
- `/login`: Loaded successfully.
- `/login` Error Handling: Correctly displayed error message for wrong password: "Invalid credentials"
- `/register`: Loaded successfully.

## 2. Authenticated Routes (STUDENT)
- Login as STUDENT successful, redirected to `/`.
- `/activities`: Loaded successfully. Found h1: "Community Activities"
- `/check-in`: Loaded successfully. Found h1: "Activity Check-In"
- `/my/history`: Loaded successfully. Found h1: "Volunteer History"
- `/my/certificates`: Loaded successfully. Found h1: "My Certificates"

## 3. Authenticated Routes (STAFF)
- Login as STAFF successful.
- `/staff/activities`: Loaded successfully. Found h1: "Sign In to SVC-RMS"
- `/staff/partners`: Loaded successfully. Found h1: "Sign In to SVC-RMS"
- `/staff/records`: Loaded successfully. Found h1: "Sign In to SVC-RMS"
- `/staff/reports`: Loaded successfully. Found h1: "Sign In to SVC-RMS"
- `/staff/certificates`: Loaded successfully. Found h1: "Sign In to SVC-RMS"

## 4. Authenticated Routes (ADMIN)
- Login as ADMIN successful.
- `/admin/users`: Loaded successfully. Found h1: "Sign In to SVC-RMS"
- `/admin/audit`: Loaded successfully. Found h1: "Sign In to SVC-RMS"
