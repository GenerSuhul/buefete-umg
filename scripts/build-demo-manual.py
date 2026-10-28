"""Create the review-demo user guide. Run with the bundled ReportLab runtime."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/manual-bufete-umg.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
for name, filename in [('Segoe','segoeui.ttf'),('SegoeBold','segoeuib.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts')/filename)))
pdfmetrics.registerFontFamily('Segoe',normal='Segoe',bold='SegoeBold',italic='Segoe',boldItalic='SegoeBold')
NAVY=colors.HexColor('#103958'); BLUE=colors.HexColor('#28688e'); INK=colors.HexColor('#25394a'); MUTED=colors.HexColor('#526779'); LIGHT=colors.HexColor('#eff5f8'); LINE=colors.HexColor('#d5e3ec')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='GuideTitle',fontName='SegoeBold',fontSize=25,leading=32,textColor=NAVY,spaceAfter=15))
styles.add(ParagraphStyle(name='GuideSub',fontName='SegoeBold',fontSize=13,leading=19,textColor=NAVY,spaceBefore=14,spaceAfter=8))
styles.add(ParagraphStyle(name='GuideBody',fontName='Segoe',fontSize=10.2,leading=15,textColor=INK,spaceAfter=7))
styles.add(ParagraphStyle(name='GuideSmall',fontName='Segoe',fontSize=9,leading=13.5,textColor=MUTED,spaceAfter=7))
styles.add(ParagraphStyle(name='GuideKicker',fontName='SegoeBold',fontSize=9,leading=14,textColor=BLUE,spaceAfter=10))
styles.add(ParagraphStyle(name='GuideCell',fontName='Segoe',fontSize=9.5,leading=14,textColor=INK))
story=[]
def p(text,style='GuideBody'):return Paragraph(text,styles[style])
def title(number,text,description):
    if story:story.append(PageBreak())
    story.extend([p(f'GUÍA DE USO / {number:02d}','GuideKicker'),p(text,'GuideTitle'),p(description)])
def sub(text):story.append(p(text,'GuideSub'))
def para(text):story.append(p(text))
def steps(items):
    for index,item in enumerate(items,1):story.append(p(f'<b>{index:02d}.</b>  {item}'))
def note(title,text):
    table=Table([[p(f'<b>{title}</b><br/>{text}')]],colWidths=[475])
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),.7,LINE),('LEFTPADDING',(0,0),(-1,-1),14),('RIGHTPADDING',(0,0),(-1,-1),14),('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story.extend([Spacer(1,8),table,Spacer(1,10)])
def table(headers,rows,widths):
    content=[[p(x,'GuideCell') for x in headers]]+[[p(x,'GuideCell') for x in row] for row in rows]
    t=Table(content,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),LIGHT),('LINEBELOW',(0,0),(-1,0),1,LINE),('LINEBELOW',(0,1),(-1,-1),.5,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
    story.append(t)

story.extend([Spacer(1,55),Image(str(ROOT/'frontend/public/umg.png'),width=78,height=78,hAlign='LEFT'),Spacer(1,28),p('BUFETE POPULAR UMG','GuideKicker'),p('Manual de usuario','GuideTitle'),p('Gestión jurídica, práctica académica<br/>y administración de sedes.','GuideBody'),Spacer(1,22)])
note('Una guía para el proceso completo','Desde la recepción de una persona hasta el expediente, sus documentos y el seguimiento. Incluye la creación y el cambio de sedes.')
story.extend([Spacer(1,30),p('Edición 1.1 · Octubre de 2026','GuideSmall'),p('Sede inicial: Petén<br/>Destinatarios: dirección, administración, secretaría y alumnos autorizados.','GuideSmall')])
note('Confidencialidad y acceso','Utilice información autorizada por la institución y cuentas personales. Las credenciales se entregan por separado y no forman parte de este manual. Las capturas y demostraciones públicas deben usar datos ficticios o anonimizados.')

title(1,'Comience aquí','Objetivo: iniciar sesión, reconocer la sede y ubicar el módulo correcto.')
steps(['Abra <b>https://bufete-popular-umg.vercel.app/acceso</b> en un navegador actualizado.','Ingrese el correo y la contraseña recibidos. Seleccione <b>Ingresar al sistema</b>.','Compruebe la franja <b>Gestión institucional</b> y el nombre de la sede activa.','Antes de capturar datos, consulte <b>Sedes</b>. Cree una sede de prueba si desea evaluar un flujo desde cero.','Use el menú lateral para abrir los módulos. Al terminar, seleccione <b>Cerrar sesión</b>.'])
sub('Dos tipos de “usuario” que conviene distinguir')
table(['Módulo','Para qué sirve'],[['<b>Gestión jurídica &gt; Usuarios</b>','Personas atendidas por el bufete. Sus fichas se vinculan a expedientes. No les crea automáticamente una cuenta de acceso.'],['<b>Administración &gt; Accesos y personal</b>','Cuentas que pueden iniciar sesión y operar el sistema según su rol y vigencia.'],['<b>Práctica académica &gt; Alumnos</b>','Perfil académico, inscripción, requisitos y casos asignados. El registro incluye el acceso académico.']],[180,295])
sub('Recorrido recomendado')
para('<b>Sede → usuario atendido → alumno e inscripción → documentos → aprobación → expediente → asignación → seguimiento.</b>')
note('Compruebe que quedó guardado','Después de cada operación, espere la confirmación, recargue la página y vuelva a abrir el registro. Los cambios se conservan en el servidor, no sólo en su navegador.')

title(2,'Bufetes y sedes','Objetivo: organizar la revisión en espacios de trabajo separados.')
sub('Crear una sede')
steps(['Abra <b>Sedes</b> desde la franja superior.','En <b>Crear sede</b>, escriba un nombre descriptivo; por ejemplo, “Bufete Popular UMG · sede de evaluación”.','Indique un <b>Código único</b>, de 2 a 40 caracteres: letras minúsculas, números o guiones. Ejemplo: <b>sede-evaluacion</b>.','Seleccione <b>Crear sede</b>. La nueva sede aparece en la lista con el estado <b>Disponible</b>.','Seleccione <b>Entrar a la sede</b> y confirme el cambio. El sistema vuelve al resumen operativo.'])
sub('Qué cambia al entrar a otra sede')
para('Cambian los usuarios atendidos, alumnos, expedientes, documentos, actividades y accesos locales. La nueva sede inicia sin registros operativos, con los catálogos disponibles para configurar sus procesos. No se copian automáticamente los expedientes de Petén.')
para('La sede seleccionada aparece en la franja de la sede. Compruébela antes de adjuntar documentos o crear registros. Para volver a Petén, abra <b>Sedes</b> y seleccione su botón de entrada.')
table(['Perfil','Alcance'],[['Administrador de plataforma','Puede crear sedes y cambiar de espacio de trabajo.'],['Personal local','Opera únicamente en la sede asociada a su cuenta. No puede abrir otra sede introduciendo su identificador.']],[175,300])
note('Antes de cambiar de sede','Guarde o cancele los formularios abiertos. El cambio finaliza el contexto anterior. Los datos guardados permanecen en la sede original.')

title(3,'Accesos y personal','Objetivo: dar acceso al personal sin confundir sus cuentas con las fichas de atención.')
steps(['Abra <b>Administración &gt; Accesos y personal</b>.','Seleccione <b>Crear usuario</b>. Complete nombre, correo, identificador de acceso y contraseña.','Asigne el rol adecuado y revise las fechas de participación. Una cuenta fuera de su período no tendrá acceso vigente.','Guarde, localice la cuenta en el directorio y compruebe sus datos.','Si necesita corregir información, abra la edición de la cuenta y guarde los cambios.'])
sub('Roles de acceso')
table(['Rol','Uso esperado'],[['Administrador','Administra los registros de su sede, cuentas, catálogos, eliminados e histórico.'],['Secretaría','Registra y actualiza la operación jurídica y académica de su sede; no administra cuentas ni la eliminación definitiva.'],['Alumno','Consulta su perfil académico y los expedientes asignados. No consulta la cartera completa ni administra accesos.']],[125,350])
sub('Suspender, eliminar o restaurar')
para('<b>Suspender</b> detiene el acceso sin borrar la cuenta. <b>Eliminar</b> la retira del directorio vigente y la conserva en eliminados. <b>Restaurar</b> recupera la cuenta suspendida; revise su vigencia antes de activarla.')
para('La <b>eliminación definitiva</b> sólo se permite para cuentas previamente eliminadas. No elimina la ficha académica ni los expedientes; conserva la trazabilidad de las acciones ya registradas. No use esta acción durante una revisión si necesita volver a usar la misma cuenta.')
note('Contraseñas y cuenta de plataforma','Las cuentas locales admiten entre 8 y 128 caracteres. La contraseña de la cuenta de plataforma entregada al licenciado se administra mediante soporte; no se cambia desde el perfil.')

title(4,'Registrar una persona atendida','Objetivo: completar la ficha de recepción que utilizará después el expediente.')
steps(['Abra <b>Gestión jurídica &gt; Usuarios</b> y seleccione la acción para registrar un usuario.','Complete <b>Identidad</b>: nombre, DPI y datos personales. El DPI se presenta en grupos de 4, 5 y 4 dígitos.','Complete <b>Contacto y trabajo</b>: domicilio, teléfonos y datos laborales o económicos disponibles.','En <b>Recepción</b>, indique la fecha, lugar y asistencia solicitada. Adjunte los documentos ficticios disponibles.','En <b>Confirmar</b>, revise la información y guarde. Si una sección está incompleta, el formulario le indicará dónde corregir.'])
sub('Después de registrar')
para('Localice a la persona por nombre, DPI o número de recepción. Abra su ficha y revise <b>Información</b>, <b>Papelería</b> y los procesos asociados. Desde allí puede abrir un expediente con el proceso que corresponda.')
sub('Editar y comprobar')
steps(['Abra el detalle y seleccione <b>Editar ficha</b> o la acción de edición disponible.','Actualice las secciones correspondientes. No cambie identificadores internos ni valores calculados.','Guarde y recargue. Compruebe que la ficha conserva los nuevos datos.','Abra el siguiente expediente usando la ficha corregida y verifique que muestra el nombre correcto.'])
note('Edad y documentos de ingresos','La edad se deriva de la fecha de nacimiento y la fecha de recepción. Si genera una declaración de ingresos, revise los datos antes de imprimirla. Las declaraciones generadas requieren revisión y firma fuera del sistema.')
para('Si aparece un conflicto de actualización, otra operación modificó la ficha. Recargue y revise los datos actuales antes de volver a guardar; no sobrescriba a ciegas.')

title(5,'Alumnos e inscripción','Objetivo: completar la inscripción antes de habilitar la asignación de casos.')
steps(['Abra <b>Práctica académica &gt; Alumnos</b> y seleccione <b>Inscribir alumno</b>.','Complete identidad y contacto, carné, DPI, correo y datos académicos. Use un correo ficticio que no esté registrado.','Indique modalidad, sede de práctica, jornada, horario y período de participación.','Defina el acceso académico y adjunte los documentos disponibles.','Revise la información final y cree el alumno. Abra su perfil para continuar la inscripción.'])
sub('Estados de la inscripción')
table(['Estado actual','Siguiente paso'],[['Borrador','Presentar la solicitud.'],['Presentada','Admitir, observar o rechazar.'],['Admitida','Iniciar la revisión documental.'],['En revisión','Aceptar requisitos y aprobar; o registrar observaciones/rechazo.'],['Observada','Corregir y volver a presentar o revisar.'],['Aprobada','Asignar casos y registrar el carné de clínica cuando corresponda.']],[140,335])
para('Para aprobar, los requisitos obligatorios no condicionales deben estar aceptados. La aprobación no se sustituye por activar la cuenta de acceso; son controles distintos.')
note('No aparece al asignar un caso','Revise que el alumno esté activo, tenga una inscripción aprobada y no esté ya asignado al mismo expediente. Si va a darlo de baja, finalice o reasigne sus casos activos primero.')

title(6,'Papelería y archivo digital','Objetivo: adjuntar, revisar y recuperar el documento correcto.')
steps(['Abra la pestaña <b>Papelería</b> del alumno o <b>Requisitos</b> del expediente.','En el requisito, seleccione <b>Adjuntar</b>. Elija un archivo de prueba y confirme su carga.','Compruebe que aparece el documento y abra su vista previa.','Seleccione <b>Revisar</b> cuando exista evidencia. Indique el estado y las observaciones que correspondan.','Guarde, recargue y verifique tanto el estado como la posibilidad de volver a abrir el archivo.'])
table(['Estado','Significado'],[['Pendiente','Falta completar el requisito.'],['Presentado','La evidencia está disponible y pendiente de evaluación.'],['Aceptado','La evidencia fue revisada y aceptada.'],['Observado','Necesita corrección o aclaración.'],['No aplica','Sólo para un requisito condicional que no corresponde al caso.']],[130,345])
sub('Versiones y archivos')
para('Para corregir un archivo, use la sustitución o nueva versión disponible. La versión anterior se conserva en el histórico. No cargue un archivo en otro alumno o expediente para reutilizar su identificador: el documento debe pertenecer al registro correcto.')
note('Formatos admitidos','PDF, PNG, JPEG y WEBP; máximo 3 MiB por archivo. Las fotografías de perfil sólo admiten formatos de imagen. Un PDF renombrado como imagen, o un archivo vacío, será rechazado.')
para('El archivo digital permite buscar y recuperar los documentos registrados. Sus archivos se conservan en almacenamiento privado y se entregan únicamente después de validar el acceso.')

title(7,'Digitalizar e importar páginas','Objetivo: revisar las páginas antes de convertirlas en un documento definitivo.')
steps(['Desde <b>Adjuntar</b> o <b>Archivo digital</b>, seleccione el modo de digitalización.','Elija el propietario correcto del documento y una descripción clara.','Importe páginas PNG/JPEG o archivos PDF de prueba. Si dispone del agente y equipo local, puede usar la captura del escáner.','Revise las miniaturas. Quite páginas equivocadas, cambie el orden y gire las que lo necesiten.','Abra la <b>vista previa</b> del documento completo. Esta revisión es obligatoria antes de aceptar.','Acepte el documento y compruebe que aparece en el propietario o requisito correspondiente.'])
sub('Continuar después de digitalizar')
para('La captura no sustituye la evaluación del requisito. Después de almacenar el documento, vuelva a la papelería, compruebe su asociación y continúe con la revisión documental. El archivo debe poder visualizarse y descargarse de nuevo después de recargar.')
sub('Si necesita interrumpir')
para('Guarde el borrador de la sesión para continuar más tarde. Cancelar la sesión evita incorporarla como documento definitivo. No cierre la ventana mientras se muestra una operación de carga en curso.')
note('Disponibilidad del escáner físico','El sitio web no instala controladores ni el componente local de escaneo. La captura física requiere un dispositivo compatible y el agente local. Sin ellos, utilice la importación de PDF, PNG o JPEG; permite evaluar el resto del ciclo documental.')
para('Límites de revisión: hasta 40 archivos de página por sesión. El documento final debe respetar el límite de tamaño de esta instalación. Si es demasiado grande, reduzca resolución o divida el material en documentos independientes.')

title(8,'Abrir y administrar expedientes','Objetivo: vincular recepción, proceso, requisitos y responsables.')
steps(['Abra <b>Gestión jurídica &gt; Expedientes</b> y seleccione <b>Nuevo expediente</b>.','Busque a la persona atendida dentro de la sede. Si no existe, complete primero su ficha de recepción.','Seleccione el <b>Tipo de proceso</b> y revise la etapa inicial. Añada la contraparte y observaciones disponibles.','Cree el expediente. Compruebe el número generado, la persona y el proceso.','Abra <b>Requisitos</b>: se crean a partir del catálogo del proceso seleccionado. Adjunte y revise cada evidencia.','Seleccione <b>Asignar alumno</b>, elija un alumno elegible y defina si es responsable principal o apoyo.'])
sub('Control y seguimiento')
para('<b>Estado y etapa</b> permite actualizar la situación operativa. Para pasar a activo, complete los requisitos obligatorios. Use <b>Registrar paso</b> para actuaciones, y consulte <b>Línea de tiempo</b> para recuperar lo ocurrido.')
para('En <b>Personas</b>, mantenga las contrapartes y sus datos de contacto. La pestaña de alumnos o responsables permite comprobar las asignaciones y finalizar las que ya no estén vigentes.')
note('Un responsable principal','Si asigna un nuevo responsable principal, los demás responsables dejan de tener esa condición. Pueden conservarse como apoyos mientras su asignación esté activa.')
sub('Cerrar o reabrir')
para('Use <b>Cerrar caso</b> e indique el motivo. Se finalizan las asignaciones activas y queda una actuación de cierre. Reabrir requiere un motivo; revise nuevamente las asignaciones, porque no se reactivan automáticamente.')

title(9,'Memoriales y notificaciones','Objetivo: conservar versiones y revisiones sin confundir una simulación con una presentación judicial.')
sub('Memorial')
steps(['Abra el expediente y la pestaña <b>Memoriales</b>.','Registre un título y adjunte el archivo del memorial.','Revise la versión vigente. Indique si requiere cambios o si está aprobada, con sus observaciones.','Si requiere cambios, adjunte una <b>nueva versión</b>. No sustituya la evidencia de la revisión anterior.','Después de aprobar, registre la presentación, fecha, resultado y archivos de respaldo disponibles.'])
table(['Situación','Qué hacer'],[['Recibido / corregido','Revisar la versión vigente.'],['Requiere corrección','Preparar y adjuntar una nueva versión.'],['Aprobado para firma','Completar la presentación y sus constancias.'],['Presentado','Consultar la versión presentada y continuar el seguimiento.']],[170,305])
sub('Notificación')
para('Seleccione <b>Notificación</b> en el expediente. Registre la fecha, descripción y documento. Si corresponde, indique la nueva etapa. Después de guardar, verifique su aparición en el histórico y vuelva a abrir el documento.')
note('Alcance del registro','Registrar una presentación o notificación conserva su seguimiento interno. No presenta escritos a un juzgado, no firma documentos ni comunica la actuación a terceros.')
para('No apruebe versiones antiguas por error: la revisión debe corresponder al archivo vigente. Un memorial ya presentado no admite modificación de esa presentación mediante una nueva versión.')

title(10,'Actividades y reportes','Objetivo: registrar la operación diaria y preparar un informe verificable.')
steps(['Abra <b>Operación interna &gt; Actividades</b>.','Registre fecha, tipo y descripción de la actividad. Relaciónela con la persona, alumno o expediente cuando corresponda.','Guarde y compruebe que aparece al aplicar los filtros del período.','Abra <b>Reportes</b>. Seleccione un rango de fechas que incluya las actividades.','Genere el reporte y revise su contenido antes de aprobarlo.','Use la impresión o descarga disponible. Compruebe el logotipo, período y contenido.'])
sub('Del borrador a la revisión')
para('Un reporte en borrador puede revisarse. La revisión deja su responsable y fecha. Verifique que las actividades pertenecen al período seleccionado; si falta información, revise las fechas y los filtros antes de generar otro reporte.')
note('Correo deshabilitado','El envío de correo no está configurado en esta instalación. Si selecciona enviar, recibirá un aviso explícito; no se simula un envío exitoso. Puede revisar, imprimir y guardar el informe para evaluar el flujo sin contactar a terceros.')
sub('Observaciones para el equipo')
para('Si detecta un dato incorrecto, anote el módulo, registro, acción y resultado esperado. Incluya una captura sin datos reales. Evite crear múltiples registros para intentar corregir el mismo problema: primero compruebe si la operación anterior quedó guardada.')
para('La auditoría permite revisar qué cuenta ejecutó una operación y en qué momento. Los registros de otra sede no aparecen en la sede actual.')

title(11,'Bajas, eliminados y recuperación','Objetivo: retirar registros del trabajo diario sin perder la continuidad del proceso.')
table(['Acción','Resultado'],[['Baja o suspensión','Detiene la atención o el acceso sin borrar el registro.'],['Eliminación lógica','Retira el registro de los listados operativos y lo conserva para restauración.'],['Restauración','Recupera el registro. En cuentas de acceso vuelve suspendido.'],['Eliminación definitiva de cuenta','Retira la cuenta previamente eliminada; no borra automáticamente la historia jurídica o académica.']],[180,295])
sub('Eliminar y restaurar un registro')
steps(['Abra la ficha correcta y compruebe su identidad y sede.','Finalice o reasigne los procesos activos que impidan la baja.','Seleccione <b>Eliminar</b>, registre el motivo cuando se solicite y confirme.','Compruebe que desapareció del listado habitual.','Como administrador, abra <b>Eliminados</b>, localice el registro y seleccione <b>Restaurar</b>.','Vuelva al módulo original y verifique que la ficha, documentos y relaciones siguen disponibles.'])
note('No borre para ocultar un error','Si una ficha tiene datos equivocados, edítela. Si una persona dejó de participar, revise la baja. La eliminación no debe utilizarse como sustituto de cerrar expedientes o finalizar asignaciones.')
para('La pantalla de retención permite revisar información; no ejecuta una depuración definitiva. La eliminación irreversible requiere una política institucional de conservación aprobada.')

title(12,'Perfil, ayuda y revisión final','Objetivo: terminar la evaluación con evidencia clara de los resultados.')
sub('Mi cuenta y fotografía')
para('Abra el menú del usuario en la esquina superior y entre a <b>Mi cuenta</b>. Revise nombre y correo. Para cambiar la fotografía, seleccione una imagen ficticia PNG, JPEG o WEBP y espere la confirmación. Recargue y compruebe la imagen tanto en el perfil como en el encabezado.')
sub('Soluciones rápidas')
table(['Lo que observa','Qué comprobar'],[['No puede iniciar sesión','Correo, contraseña, vigencia de cuenta y disponibilidad del servicio. Utilice las credenciales de esta instalación.'],['No puede revisar un requisito','Primero adjunte el archivo o complete la evidencia; sólo un requisito condicional admite “No aplica”.'],['No aparece un alumno al asignar','Debe estar activo, con inscripción aprobada y no estar ya asignado al expediente.'],['No ve sus registros','Compruebe la sede, los filtros, el estado de atención y la sección de eliminados.'],['Un archivo no carga','Revise formato, tamaño máximo de 3 MiB, propietario y acceso.'],['Conflicto al guardar','Recargue y revise los cambios recientes antes de editar otra vez.']],[180,295])
title(13,'Lista de revisión del licenciado','Objetivo: comprobar los recorridos principales y registrar observaciones reproducibles.')
para('1. Crear una sede y comprobar que inicia vacía.<br/>2. Registrar una persona, editarla y recargar.<br/>3. Inscribir un alumno, adjuntar evidencias y aprobarlo.<br/>4. Abrir un expediente y asignarlo.<br/>5. Recuperar un documento y una fotografía tras recargar.<br/>6. Registrar una actuación, memorial y notificación de prueba.<br/>7. Generar un reporte.<br/>8. Eliminar y restaurar un registro sin perder su información.<br/>9. Volver a Petén y comprobar que no se mezclaron los datos.')
note('Cómo reportar un hallazgo','Indique: sede, módulo, acción exacta, resultado observado y resultado esperado. Añada fecha y captura con datos ficticios. El equipo de soporte revisará el hallazgo y comunicará el resultado.')

def frame(c,doc):
    w,h=doc.pagesize
    c.saveState()
    c.setStrokeColor(LINE);c.line(60,55,w-60,55)
    c.setFont('Segoe',8);c.setFillColor(MUTED)
    c.drawString(60,39,'BUFETE POPULAR UMG  |  GESTIÓN INSTITUCIONAL')
    c.drawRightString(w-60,39,f'{doc.page}')
    if doc.page>1:
        c.setFont('SegoeBold',8);c.setFillColor(NAVY);c.drawString(60,h-34,'MANUAL DE USUARIO')
        c.setFont('Segoe',8);c.setFillColor(MUTED);c.drawRightString(w-60,h-34,'Edición 1.1 / Octubre 2026')
    c.restoreState()
doc=SimpleDocTemplate(str(OUT),pagesize=(595.28,841.89),leftMargin=60,rightMargin=60,topMargin=65,bottomMargin=76,title='Bufete Popular UMG - Manual de usuario',author='Bufete Popular UMG',subject='Sedes y flujos funcionales')
doc.build(story,onFirstPage=frame,onLaterPages=frame)
shutil.copy2(OUT,ROOT/'frontend/public/manual.pdf')
shutil.copy2(OUT,ROOT/'frontend/public/manual-demo.pdf')
print(OUT)
