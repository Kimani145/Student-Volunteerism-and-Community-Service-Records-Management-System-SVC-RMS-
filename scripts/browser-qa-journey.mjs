/**
 * End-to-End User Journey and Screen QA Validation Script
 * Verifies all UI-01 screens, SRS §10 user journeys, authentication, and API integration.
 */
import { strict as assert } from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function testScreens() {
  console.log('--- Step 1: Validating All Next.js App Router Screens ---');
  const routes = [
    '/',
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/activities',
    '/check-in',
    '/my/history',
    '/my/certificates',
    '/notifications',
    '/staff/activities',
    '/staff/certificates',
    '/staff/records',
    '/staff/reports',
    '/staff/partners',
    '/management',
    '/admin/users',
    '/admin/audit',
  ];

  for (const route of routes) {
    const res = await fetch(`${BASE_URL}${route}`);
    assert.equal(res.status, 200, `Route ${route} should return HTTP 200 (got ${res.status})`);
    const html = await res.text();
    assert.ok(html.includes('<!DOCTYPE html>') || html.includes('<html'), `Route ${route} should return HTML document`);
    console.log(`  ✓ Route ${route} returns 200 OK (${html.length} bytes)`);
  }

  // Non-existent certificate verification page should return 404
  const notFoundRes = await fetch(`${BASE_URL}/verify/NONEXISTENT123`);
  assert.equal(notFoundRes.status, 404, 'Non-existent certificate verification should return 404');
  console.log('  ✓ Route /verify/NONEXISTENT123 returns 404 Not Found as expected');
}

const tokenCache = new Map();

async function loginUser(email, password) {
  if (tokenCache.has(email)) {
    return tokenCache.get(email);
  }
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `Login for ${email} should succeed`);
  const data = await res.json();
  assert.ok(data.accessToken, 'Login should return accessToken');
  tokenCache.set(email, data.accessToken);
  return data.accessToken;
}

async function testCompleteLifecycle() {
  console.log('\n--- Step 2: Testing Complete Activity & Student Lifecycle (SRS §10) ---');

  // 1. Staff Organizer Login (staff.member@example.test)
  console.log('  1. Login as Staff Organizer...');
  const organizerToken = await loginUser('staff.member@example.test', 'Password123!');
  console.log('  ✓ Staff Organizer logged in');

  // 2. Staff Approver Login (staff.approver@example.test)
  console.log('  2. Login as Staff Approver...');
  const approverToken = await loginUser('staff.approver@example.test', 'Password123!');
  console.log('  ✓ Staff Approver logged in');

  // 3. Student Login (student1@example.test)
  console.log('  3. Login as Student...');
  const studentToken = await loginUser('student1@example.test', 'Password123!');
  const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const meData = await meRes.json();
  const studentId = meData.studentId;
  console.log(`  ✓ Student logged in (studentId: ${studentId})`);

  // 4. Staff Organizer Creates Activity
  console.log('  4. Creating new community service activity...');
  const uniqueOffsetDays = 100 + Math.floor(Math.random() * 5000);
  const startAt = new Date(Date.now() + uniqueOffsetDays * 86400 * 1000);
  const endAt = new Date(startAt.getTime() + 4 * 3600 * 1000);
  const registrationClosesAt = new Date(startAt.getTime() - 3600 * 1000);
  const title = `Campus Green Initiative ${Date.now()}`;
  
  const createRes = await fetch(`${BASE_URL}/api/v1/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${organizerToken}`,
    },
    body: JSON.stringify({
      title,
      typeId: 1, // TREE_PLANTING
      description: 'Campus tree planting and green space conservation initiative',
      venue: 'University Botanical Gardens',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      registrationClosesAt: registrationClosesAt.toISOString(),
      capacity: 30,
      serviceHours: 4.0,
      eligibleYears: [1, 2, 3, 4],
    }),
  });
  assert.equal(createRes.status, 201, 'Activity creation should return 201');
  const activity = await createRes.json();
  const activityId = activity.id;
  console.log(`  ✓ Created draft activity "${title}" (ID: ${activityId})`);

  // 5. Staff Approver Publishes Activity (ACT-03: approver != organizer)
  console.log('  5. Publishing activity via authorized approver...');
  const pubRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${approverToken}` },
  });
  assert.equal(pubRes.status, 201, 'Publishing activity should return 201');
  console.log('  ✓ Activity published successfully');

  // 6. Student Discovers Activity in Published List
  console.log('  6. Student browsing activities...');
  const actRes = await fetch(`${BASE_URL}/api/v1/activities`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(actRes.status, 200);
  const actData = await actRes.json();
  const found = actData.items.find((a) => a.id === activityId);
  assert.ok(found, 'Student should see newly published activity');
  console.log(`  ✓ Found activity in student listing (Capacity: ${found.capacity}, Hours: ${found.service_hours})`);

  // 7. Student Registers for Activity
  console.log('  7. Student registering for activity...');
  const regRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/registrations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(regRes.status, 201, 'Registration should return 201 Created');
  const regData = await regRes.json();
  const participationId = regData.id;
  console.log(`  ✓ Student registered successfully (Participation ID: ${participationId})`);

  // 8. Student Verifies Registration in History
  console.log('  8. Checking /my/history for registration...');
  const histRes = await fetch(`${BASE_URL}/api/v1/students/me/history`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(histRes.status, 200);
  const histData = await histRes.json();
  const histItem = histData.find((h) => h.activity_id === activityId);
  assert.ok(histItem && histItem.status === 'REGISTERED', 'Activity should show REGISTERED in history');
  console.log('  ✓ Activity confirmed in student history');

  // 9. Staff Views Roster
  console.log('  9. Staff viewing attendance roster...');
  const rosterRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/roster`, {
    headers: { Authorization: `Bearer ${approverToken}` },
  });
  assert.equal(rosterRes.status, 200);
  const roster = await rosterRes.json();
  assert.ok(roster.some((p) => p.id === participationId), 'Student must appear on staff roster');
  console.log(`  ✓ Staff roster loaded (${roster.length} attendee(s))`);

  // 10. Staff Updates Attendance (Mark ATTENDED)
  console.log('  10. Staff marking attendance as ATTENDED...');
  const attRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/attendance`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${approverToken}`,
    },
    body: JSON.stringify({
      participations: [
        {
          id: participationId,
          status: 'ATTENDED',
          hours_awarded: 4.0,
        },
      ],
    }),
  });
  assert.equal(attRes.status, 200, 'Attendance update should return 200');
  console.log('  ✓ Attendance recorded (ATTENDED, 4.0 hours awarded)');

  // 11. Staff Transitions Activity to IN_PROGRESS then COMPLETED
  console.log('  11. Transitioning activity status to COMPLETED...');
  const startRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${approverToken}` },
  });
  assert.equal(startRes.status, 201, 'Activity start should return 201');

  const compRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${approverToken}` },
  });
  assert.equal(compRes.status, 201, 'Activity complete should return 201');
  console.log('  ✓ Activity status transitioned to COMPLETED');

  // 12. Staff Issues Certificate
  console.log('  12. Issuing signed Ed25519 Certificate...');
  const certRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/certificates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${approverToken}`,
    },
    body: JSON.stringify({
      participationIds: [participationId],
    }),
  });
  assert.equal(certRes.status, 201, 'Certificate issuance should return 201');
  const certData = await certRes.json();
  const certsList = certData.certificates || certData;
  assert.ok(certsList.length > 0, 'Must return at least 1 issued certificate');
  const cert = certsList[0];
  const cvid = cert.cvid;
  const certId = cert.id;
  console.log(`  ✓ Certificate issued with CVID: ${cvid} (ID: ${certId})`);

  // 13. Public Certificate Verification (Web Screen: /verify/[cvid])
  console.log(`  13. Testing Public Verification Screen /verify/${cvid}...`);
  const verifyRes = await fetch(`${BASE_URL}/verify/${cvid}`);
  assert.equal(verifyRes.status, 200, 'Public verification page should return 200 OK');
  const verifyHtml = await verifyRes.text();
  assert.ok(verifyHtml.includes('Certificate Verification'), 'Must contain Certificate Verification title');
  assert.ok(verifyHtml.includes('VALID'), 'Must show VALID status badge');
  assert.ok(verifyHtml.includes(cvid), 'Must display CVID');
  console.log(`  ✓ Public verification screen verified: status VALID, CVID displayed (${verifyHtml.length} bytes)`);

  // 14. Vector PDF Generation and Download (CRT-05)
  console.log(`  14. Downloading Vector Certificate PDF...`);
  const pdfRes = await fetch(`${BASE_URL}/api/v1/certificates/${certId}/pdf`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(pdfRes.status, 200, 'PDF download should return 200 OK');
  const pdfBuffer = await pdfRes.arrayBuffer();
  const pdfHeader = Buffer.from(pdfBuffer.slice(0, 4)).toString();
  assert.equal(pdfHeader, '%PDF', 'PDF must start with %PDF magic bytes');
  console.log(`  ✓ PDF generated and downloaded (${pdfBuffer.byteLength} bytes, header: %PDF)`);

  // 15. Student Certificate History (/my/certificates)
  console.log('  15. Testing Student Certificates (/my/certificates)...');
  const myCertsRes = await fetch(`${BASE_URL}/api/v1/certificates/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(myCertsRes.status, 200);
  const myCerts = await myCertsRes.json();
  assert.ok(myCerts.some((c) => c.cvid === cvid), 'Issued certificate must appear in student certificate list');
  console.log(`  ✓ Certificate confirmed in student portfolio`);
}

async function testAdminAndManagement() {
  console.log('\n--- Step 3: Testing Admin and Management Journeys ---');

  // 1. Admin Login
  const adminToken = await loginUser('admin@example.test', 'Password123!');
  console.log('  ✓ Admin login succeeded');

  // 2. Admin Users List
  const usersRes = await fetch(`${BASE_URL}/api/v1/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(usersRes.status, 200);
  const usersData = await usersRes.json();
  console.log(`  ✓ Admin user management: total users=${usersData.total}`);

  // 3. Admin Audit Log
  const auditRes = await fetch(`${BASE_URL}/api/v1/audit`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(auditRes.status, 200);
  const auditData = await auditRes.json();
  console.log(`  ✓ Admin audit trail: total log entries=${auditData.total}`);

  // 4. Management Dashboard Metrics
  const mgmtToken = await loginUser('management@example.test', 'Password123!');
  console.log('  ✓ Management login succeeded');

  const dashRes = await fetch(`${BASE_URL}/api/v1/reports/dashboard`, {
    headers: { Authorization: `Bearer ${mgmtToken}` },
  });
  assert.equal(dashRes.status, 200);
  const dashData = await dashRes.json();
  console.log(`  ✓ Management dashboard aggregate metrics:`, dashData.slice(0, 2));
}

async function testSelfCheckInFlow() {
  console.log('\n--- Step 4: Testing Self Check-In via 10-Character Rotating Code (ATT-01, ATT-06, UI-02) ---');

  const organizerToken = await loginUser('staff.member@example.test', 'Password123!');
  const approverToken = await loginUser('staff.approver@example.test', 'Password123!');
  const studentEmail = `student${(Date.now() % 40) + 5}@example.test`;
  const studentToken = await loginUser(studentEmail, 'Password123!');

  // Set a 10-second window: student registers immediately, then we wait for start_at to arrive
  const now = Date.now();
  const registrationClosesAt = new Date(now + 8000); // closes in 8 seconds
  const startAt = new Date(now + 10000);              // starts in 10 seconds
  const endAt = new Date(now + 2 * 3600 * 1000);      // ends in 2 hours
  const title = `Campus Cleanup Live ${now}`;

  // 1. Organizer creates activity
  const createRes = await fetch(`${BASE_URL}/api/v1/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${organizerToken}`,
    },
    body: JSON.stringify({
      title,
      typeId: 3, // CLEANUP
      description: 'Campus grounds cleanup with live check-in validation',
      venue: 'North Quad',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      registrationClosesAt: registrationClosesAt.toISOString(),
      capacity: 25,
      serviceHours: 2.5,
      eligibleYears: [1, 2, 3, 4],
    }),
  });
  assert.equal(createRes.status, 201);
  const activity = await createRes.json();
  const activityId = activity.id;
  console.log(`  ✓ Created live check-in activity: ${title} (${activityId})`);

  // 2. Approver publishes activity
  const pubRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${approverToken}` },
  });
  assert.equal(pubRes.status, 201);

  // 3. Student registers immediately before registration closes
  const regRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/registrations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(regRes.status, 201);
  const reg = await regRes.json();
  const participationId = reg.id;
  console.log(`  ✓ Student registered (Participation ID: ${participationId})`);

  // 4. Wait for activity start time to arrive (10.5 seconds)
  console.log('  Waiting 10.5 seconds for activity start window to arrive...');
  await new Promise((resolve) => setTimeout(resolve, 10500));

  // 5. Staff starts activity (moves to IN_PROGRESS)
  const startRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${organizerToken}` },
  });
  assert.equal(startRes.status, 201);
  console.log('  ✓ Activity started (status: IN_PROGRESS)');

  // 6. Staff organizer fetches 10-character rotating token
  const tokenRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/check-in-token`, {
    headers: { Authorization: `Bearer ${organizerToken}` },
  });
  assert.equal(tokenRes.status, 200);
  const tokenData = await tokenRes.json();
  assert.ok(tokenData.token && tokenData.token.length === 10, 'Token must be exactly 10 characters');
  console.log(`  ✓ Staff organizer retrieved rotating code: ${tokenData.token}`);

  // 5. Negative test: wrong code returns 422 TOKEN_INVALID
  const invalidRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/check-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ token: 'BADCODE123' }),
  });
  assert.equal(invalidRes.status, 422, 'Invalid token should return 422');
  console.log('  ✓ Invalid check-in code rejected with 422 Unprocessable Entity');

  // 6. Positive test: valid 10-character code check-in succeeds
  const checkInRes = await fetch(`${BASE_URL}/api/v1/activities/${activityId}/check-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ token: tokenData.token }),
  });
  assert.ok(checkInRes.ok, `Valid check-in should succeed (status: ${checkInRes.status})`);
  const checkInData = await checkInRes.json();
  console.log(`  ✓ Check-in succeeded with message: "${checkInData.message}"`);

  // 7. Verify participation is now ATTENDED with service hours credited in student history
  const histRes = await fetch(`${BASE_URL}/api/v1/students/me/history`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(histRes.status, 200);
  const history = await histRes.json();
  const record = history.find((h) => h.activity_id === activityId);
  assert.ok(record, 'Activity must appear in student history');
  assert.equal(record.status, 'ATTENDED', 'Participation status must be ATTENDED');
  assert.equal(Number(record.hours_awarded), 2.5, 'Service hours awarded must match activity hours');
  console.log(`  ✓ Verified student history: status is ATTENDED with ${record.hours_awarded} hours awarded`);
}

async function run() {
  console.log('====================================================');
  console.log('  SVC-RMS Complete End-to-End QA Journey Suite');
  console.log('====================================================\n');
  try {
    await testScreens();
    await testCompleteLifecycle();
    await testAdminAndManagement();
    await testSelfCheckInFlow();
    console.log('\n====================================================');
    console.log('  ✓ ALL QA USER JOURNEYS & SCREENS PASSED CLEANLY');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ QA Journey Failure:', error);
    process.exit(1);
  }
}

run();
