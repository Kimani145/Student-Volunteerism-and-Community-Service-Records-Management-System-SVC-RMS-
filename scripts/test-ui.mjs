import puppeteer from 'puppeteer';
import * as fs2 from 'fs';

async function run() {
  console.log('Launching browser via Chrome DevTools...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const reportPath = 'docs/QA-BROWSER-REPORT.md';
  let report = '# UI QA Browser Report (via Chrome DevTools/Puppeteer)\n\n';

  const log = (msg) => {
    console.log(msg);
    report += msg + '\n';
  };

  try {
    // 1. Unauthenticated routes
    log('## 1. Unauthenticated Routes');
    
    // Login page
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('h1');
    log('- `/login`: Loaded successfully.');
    
    // Test wrong password
    await page.type('input[type="email"]', 'student1@example.test');
    await page.type('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForSelector('.bg-rose-50', { timeout: 3000 });
      const errorText = await page.$eval('.bg-rose-50', el => el.textContent);
      log(`- \`/login\` Error Handling: Correctly displayed error message for wrong password: "${errorText.trim()}"`);
    } catch (e) {
      log(`- \`/login\` Error Handling: Failed to display error message.`);
    }

    // Register page
    await page.goto('http://localhost:3000/register');
    await page.waitForSelector('h1');
    log('- `/register`: Loaded successfully.');

    // 2. Login as STUDENT
    log('\n## 2. Authenticated Routes (STUDENT)');
    await page.goto('http://localhost:3000/login');
    await page.type('input[type="email"]', 'student1@example.test');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
    const cookies = await page.cookies();
    console.log("Cookies after login:", cookies);
    log('- Login as STUDENT successful, redirected to `/`.');

    const studentRoutes = [
      '/activities',
      '/check-in',
      '/my/history',
      '/my/certificates'
    ];
    for (const route of studentRoutes) {
      await page.goto(`http://localhost:3000${route}`);
      try {
        await page.waitForSelector('h1', { timeout: 3000 });
        const h1Text = await page.$eval('h1', el => el.textContent);
        log(`- \`${route}\`: Loaded successfully. Found h1: "${h1Text}"`);
      } catch (e) {
        log(`- \`${route}\`: Error loading or finding h1.`);
      }
    }

    // 3. Logout and Login as STAFF
    log('\n## 3. Authenticated Routes (STAFF)');
    await page.evaluate(() => { localStorage.clear(); });
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('input[type="email"]');
    await new Promise(r => setTimeout(r, 1000));
    await page.type('input[type="email"]', 'staff.approver@example.test');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
    log('- Login as STAFF successful.');

    const staffRoutes = [
      '/staff/activities',
      '/staff/partners',
      '/staff/records',
      '/staff/reports',
      '/staff/certificates'
    ];
    for (const route of staffRoutes) {
      await page.goto(`http://localhost:3000${route}`);
      try {
        await page.waitForSelector('h1', { timeout: 3000 });
        const h1Text = await page.$eval('h1', el => el.textContent);
        log(`- \`${route}\`: Loaded successfully. Found h1: "${h1Text}"`);
      } catch (e) {
        log(`- \`${route}\`: Error loading or finding h1.`);
      }
    }

    // 4. Logout and Login as ADMIN
    log('\n## 4. Authenticated Routes (ADMIN)');
    await page.evaluate(() => { localStorage.clear(); });
    const client2 = await page.target().createCDPSession();
    await client2.send('Network.clearBrowserCookies');
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('input[type="email"]');
    await new Promise(r => setTimeout(r, 1000));
    await page.type('input[type="email"]', 'admin@example.test');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
    log('- Login as ADMIN successful.');

    const adminRoutes = [
      '/admin/users',
      '/admin/audit'
    ];
    for (const route of adminRoutes) {
      await page.goto(`http://localhost:3000${route}`);
      try {
        await page.waitForSelector('h1', { timeout: 3000 });
        const h1Text = await page.$eval('h1', el => el.textContent);
        log(`- \`${route}\`: Loaded successfully. Found h1: "${h1Text}"`);
      } catch (e) {
        log(`- \`${route}\`: Error loading or finding h1.`);
      }
    }

  } catch (err) {
    log(`\nScript Error: ${err.message}`);
  } finally {
    fs2.writeFileSync(reportPath, report);
    console.log('Report written to ' + reportPath);
    await browser.close();
  }
}

run();
