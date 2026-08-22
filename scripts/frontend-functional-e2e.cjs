const path = require('node:path');
const fs = require('node:fs');

async function main() {
  const [modulesPath, baseUrl, screenshotPath] = process.argv.slice(2);
  const username = process.env.FRONTEND_E2E_USERNAME;
  const password = process.env.FRONTEND_E2E_PASSWORD;
  if (!modulesPath || !baseUrl || !screenshotPath || !username || !password) throw new Error('Faltan argumentos o credenciales.');
  const { chromium } = require(path.join(modulesPath, 'playwright'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(15000);
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  const run = Date.now().toString().slice(-8);
  const clientName = `Cliente Navegador ${run}`;
  const studentName = `Alumno Navegador ${run}`;
  const userName = `sec${run}`;
  const pdfPath = path.resolve('.artifacts/seed/demo-document.pdf');
  const photoPath = path.resolve('.data/files/Umg.png');
  const progressPath = `${screenshotPath}.steps`;
  const progress = (step) => fs.appendFileSync(progressPath, `${step}\n`);
  fs.writeFileSync(progressPath, 'start\n');

  await page.goto(new URL('/acceso', baseUrl).href);
  await page.getByLabel('Correo electrónico').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: /Ingresar al sistema/ }).click();
  await page.waitForURL((url) => url.pathname === '/');
  progress('login');

  await page.goto(new URL('/personas/clientes', baseUrl).href);
  await page.getByRole('button', { name: /Registrar cliente/ }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre completo').fill(clientName);
  await dialog.getByLabel('DPI').fill(`3000${run}0101`);
  await dialog.getByLabel('Dirección de residencia').fill('Ciudad de Guatemala, zona 2');
  await dialog.getByLabel('Asistencia solicitada').fill('Validación E2E de expediente civil');
  const clientResponse = page.waitForResponse((response) => response.url().endsWith('/api/v1/clients') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Registrar cliente' }).click();
  const clientJson = await (await clientResponse).json();
  await page.waitForURL((url) => url.pathname === `/personas/clientes/${clientJson.id}`);
  progress('client');

  await page.goto(new URL('/personas/alumnos', baseUrl).href);
  await page.getByRole('button', { name: /Inscribir alumno/ }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre completo').fill(studentName);
  await dialog.getByLabel('Carné universitario').fill(`0901-${run}`);
  await dialog.getByLabel('DPI').fill(`3100${run}0101`);
  await dialog.getByLabel('Correo').fill(`${userName}@miumg.edu.gt`);
  await dialog.getByLabel('Dirección de residencia').fill('Mixco, Guatemala');
  const studentResponse = page.waitForResponse((response) => response.url().endsWith('/api/v1/students') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: /Inscribir y crear expediente/ }).click();
  const studentJson = await (await studentResponse).json();
  await page.waitForURL((url) => url.pathname === `/personas/alumnos/${studentJson.id}`);
  progress('student');

  await page.goto(new URL('/expedientes', baseUrl).href);
  await page.getByRole('button', { name: /Abrir expediente/ }).click();
  dialog = page.getByRole('dialog');
  const clientOption = await dialog.getByLabel('Cliente').locator('option').filter({ hasText: clientName }).getAttribute('value');
  await dialog.getByLabel('Cliente').selectOption(clientOption);
  const caseResponse = page.waitForResponse((response) => response.url().endsWith('/api/v1/cases') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Crear expediente' }).click();
  const caseJson = await (await caseResponse).json();
  await page.waitForURL((url) => url.pathname === `/expedientes/${caseJson.summary.id}`);
  progress('case');

  await page.getByRole('button', { name: /Asignar alumno/ }).first().click();
  dialog = page.getByRole('dialog');
  const studentSelect = dialog.locator('select').first();
  await studentSelect.selectOption(studentJson.id);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/assignments') && response.request().method() === 'POST'),
    dialog.getByRole('button', { name: 'Confirmar asignación' }).click(),
  ]);
  progress('assignment');

  await page.getByRole('button', { name: /Registrar paso/ }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Título').fill('Actuación E2E desde navegador');
  await dialog.getByLabel('Descripción').fill('Movimiento persistido y atribuido al administrador.');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/timeline') && response.request().method() === 'POST'),
    dialog.getByRole('button', { name: 'Guardar paso' }).click(),
  ]);
  progress('timeline');

  await page.goto(new URL(`/documentos?contextType=Client&contextId=${clientJson.id}&mode=upload`, baseUrl).href);
  dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').setInputFiles(pdfPath);
  await dialog.getByLabel('Etiqueta').fill('DPI E2E navegador');
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/v1/documents') && response.request().method() === 'POST'),
    dialog.getByRole('button', { name: 'Guardar documento' }).click(),
  ]);
  await page.getByText('Documento almacenado y asociado correctamente.').waitFor();
  progress('document');

  await page.goto(new URL(`/documentos?contextType=Client&contextId=${clientJson.id}&mode=scan`, baseUrl).href);
  dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').setInputFiles(photoPath);
  await dialog.getByLabel('Etiqueta').fill('Captura E2E navegador');
  await dialog.getByRole('button', { name: 'Cargar y previsualizar' }).click();
  await dialog.getByText('Vista previa obligatoria').waitFor();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/complete') && response.request().method() === 'POST'),
    dialog.getByRole('button', { name: 'Confirmar y guardar' }).click(),
  ]);
  await dialog.getByText('Documento almacenado').waitFor();
  await dialog.getByRole('button', { name: 'Cerrar' }).last().click();
  progress('scan');

  await page.goto(new URL('/usuarios', baseUrl).href);
  await page.getByRole('button', { name: /Crear usuario/ }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre completo').fill(`Secretaria Navegador ${run}`);
  await dialog.getByLabel('Usuario').fill(userName);
  await dialog.getByLabel('Correo').fill(`${userName}@bufete.local`);
  await dialog.getByLabel('Contraseña temporal').fill('Temporal!2026Segura');
  await dialog.getByLabel('Roles').selectOption({ label: 'Secretaria' });
  await dialog.locator('input[type="file"]').setInputFiles(photoPath);
  await dialog.getByRole('button', { name: 'Crear usuario' }).click();
  await page.getByText('Usuario creado correctamente.').waitFor();
  progress('user');

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();
  const result = { clientId: clientJson.id, studentId: studentJson.id, caseId: caseJson.summary.id, userName, consoleErrors, screenshotPath };
  console.log(JSON.stringify(result, null, 2));
  if (consoleErrors.length) process.exitCode = 2;
}

main().catch((error) => { console.error(error); process.exit(1); });
