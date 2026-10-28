// Validación real en una sede temporal. No modifica los catálogos del bufete.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
async function main() {
  const environmentPath = process.argv[3];
  if (!environmentPath) throw new Error('Indique environment.json de una base QA aislada.');
  const environment = JSON.parse(fs.readFileSync(environmentPath, 'utf8'));
  assert.match(environment.databaseName, /^bufete_changes_qa_[a-f0-9]{12}$/);
  assert.equal(environment.port, 5103);
  const config = {};
  for (const file of ['.env', '.env.platform.local']) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const i = line.indexOf('='); config[line.slice(0, i)] = line.slice(i + 1);
  }
  const api = `http://127.0.0.1:${environment.port}/api/v1`, web = process.env.BUFETE_QA_WEB || 'http://127.0.0.1:5191';
  const code = `qa-catalog-${Date.now()}`, password = require('node:crypto').randomBytes(12).toString('hex');
  const central = environment.databaseName;
  const sql = query => execFileSync('docker', ['exec', 'bufete-juridico-umg-postgres-1', 'psql', '-U', config.POSTGRES_USER, '-d', central, '-At', '-c', query], {encoding:'utf8'}).trim();
  const out = path.resolve('.artifacts/catalogs', code); fs.mkdirSync(out, {recursive:true});
  async function req(route, body, token, tenant = 'peten', method = 'POST') {
    const r = await fetch(api + route, {method, headers:{'Content-Type':'application/json','X-Sede-Code':tenant,...(token?{Authorization:`Bearer ${token}`}:{})}, ...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,data:await r.json()};
  }
  let created = false, browser;
  try {
    const root = await req('/auth/login',{email:config.PlatformAdmin__Email,password:config.PlatformAdmin__Password}); assert.equal(root.status,200);
    const email = `${code}@example.test`;
    assert.equal((await req('/platform/tenants',{code,name:'Catálogos QA',administratorName:'Administrador QA',administratorEmail:email,administratorPassword:password},root.data.accessToken)).status,200); created=true;
    const login = await req('/auth/login',{email,password},null,code); assert.equal(login.status,200); const token=login.data.accessToken;
    const processes=await req('/catalogs/process-types',null,token,code,'GET'); const processType=processes.data[0]; assert.ok(processType);
    const payload={scope:'LegalProcess',processTypeId:processType.id,code:'QA_DOCUMENTO',label:'Documento QA',kind:'Document',isRequired:true,isConditional:false,conditionDescription:null,documentNature:'Original',maximumAgeDays:null,subject:null,instructions:null,sortOrder:1,isActive:true};
    const before=await req('/catalogs/requirements',payload,token,code); assert.equal(before.status,400); assert.ok(before.data.errors['$.scope']);
    fs.writeFileSync(path.join(out,'causa-raiz.json'),JSON.stringify({status:before.status,title:before.data.title,fields:Object.keys(before.data.errors)},null,2));
    if (process.argv.includes('--probe')) { console.log(JSON.stringify({reproduced:true,cause:'LegalProcess no pertenece al enum del contrato nativo',artifacts:out})); return; }
    const {chromium}=require(path.join(process.argv[2],'playwright')); browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(30000);
    const errors=[],badResponses=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/v1/')&&r.status()>=500)badResponses.push(r.status());});
    await page.goto(web+'/acceso');await page.getByLabel('Código de sede').fill(code);await page.getByLabel('Correo electrónico').fill(email);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:/Ingresar al sistema/}).click();await page.waitForURL(url=>url.pathname==='/');
    await page.goto(web+'/catalogos');await page.getByRole('button',{name:'Requisito',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Guardar requisito',exact:true}).isDisabled(),true);
    await page.getByLabel('Código',{exact:true}).fill('QA_DOCUMENTO');await page.getByLabel('Etiqueta',{exact:true}).fill('Documento QA');
    assert.equal(await page.getByLabel('Condicional',{exact:true}).count(),0);
    assert.equal(await page.getByLabel('Vigencia máxima (días)',{exact:true}).count(),0);
    assert.equal(await page.getByLabel('Instrucciones',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Guardar requisito',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('Documento QA',{exact:true}).waitFor();await page.reload();await page.getByText('Documento QA',{exact:true}).waitFor();
    const stored=await req('/catalogs/process-types/'+processType.id,null,token,code,'GET');const saved=stored.data.requirements.find(x=>x.code==='QA_DOCUMENTO');assert.equal(saved.scope,'Process');assert.equal(saved.maximumAgeDays,null);assert.equal(saved.isConditional,false);
    await page.getByRole('button',{name:'Editar requisito Documento QA',exact:true}).click();await page.getByLabel('Etiqueta',{exact:true}).fill('Documento QA editado');await page.getByRole('button',{name:'Guardar requisito',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.reload();await page.getByText('Documento QA editado',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Quitar requisito Documento QA editado',exact:true}).click();await page.getByRole('button',{name:'Quitar requisito',exact:true}).last().click();await page.getByText('Inactivo',{exact:true}).last().waitFor();
    const removed=await req('/catalogs/process-types/'+processType.id,null,token,code,'GET');assert.equal(removed.data.requirements.find(x=>x.id===saved.id).isActive,false);
    await page.getByRole('button',{name:'Requisito',exact:true}).click();await page.getByLabel('Código',{exact:true}).fill('QA_DOCUMENTO');await page.getByLabel('Etiqueta',{exact:true}).fill('Duplicado QA');await page.getByRole('button',{name:'Guardar requisito',exact:true}).click();
    await page.getByRole('dialog').getByRole('alert').filter({hasText:/Ya existe/}).waitFor();assert.equal(await page.getByLabel('Etiqueta',{exact:true}).inputValue(),'Duplicado QA');assert.equal(await page.getByText(/One or more validation/).count(),0);
    await page.screenshot({path:path.join(out,'mensaje-claro.png')});assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,errors,badResponses,steps:['Reproducción de contrato inválido','Creación y edición persistentes tras refresh','Campos retirados ausentes','Baja lógica de requisito persistida','Duplicado con mensaje claro y formulario conservado']},null,2));console.log(JSON.stringify({passed:true,artifacts:out}));
  } finally {
    if(browser)await browser.close();
    if(created){assert.match(code,/^qa-catalog-\d+$/);const database=sql(`SELECT "DatabaseName" FROM bufete.tenants WHERE "Code"='${code}'`);assert.match(database,/^bufete_t_[a-f0-9]{32}$/);execFileSync('docker',['exec','bufete-juridico-umg-postgres-1','dropdb','-U',config.POSTGRES_USER,'--force',database]);sql(`DELETE FROM bufete.tenants WHERE "Code"='${code}' AND "DatabaseName"='${database}'`);}
  }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
