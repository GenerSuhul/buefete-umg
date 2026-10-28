import { NextRequest } from "next/server";
import { createRestriction, ensureClientAllowed, listRestrictions, removeRestriction, restrictionStatus } from '../../../demo/clientRestrictions';
import { practiceNoticeOperation } from '../../../demo/practiceNotices';
import { ensureStudentNotBlocked, studentDisciplineOperation } from '../../../demo/studentDiscipline';
import {
  authorizeDocument,
  isReadOperation,
  operate,
} from "../../../demo/domain";
import {
  download,
  scanOperation,
  upload,
  type UploadedFile,
} from "../../../demo/files";
import {
  audit,
  DemoError,
  ensure,
  requireValue,
  rootId,
} from "../../../demo/model";
import {
  checkPassword,
  createTenant,
  database,
  hashPassword,
  inTenant,
  initializeDemo,
  login,
  revoke,
  sessionFor,
  switchTenant,
  workspace,
} from "../../../demo/store";

export const runtime = "nodejs";
export const maxDuration = 60;
const noCache = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: NextRequest) {
  try {
    ensure(process.env.DEMO_MODE === "true", "No encontrado.", 404);
    const origin = request.headers.get("origin");
    ensure(
      !origin || new URL(origin).host === request.headers.get("host"),
      "Origen no autorizado.",
      403,
    );
    ensure(
      Number(request.headers.get("content-length") ?? 0) <= 4.3 * 1024 * 1024,
      "La solicitud supera el tamaño máximo permitido.",
      413,
    );
    const raw = await request.text();
    ensure(
      raw.length <= 4.3 * 1024 * 1024,
      "La solicitud supera el tamaño máximo permitido.",
      413,
    );
    let body: { method: string; args?: unknown[] };
    try {
      body = JSON.parse(raw);
      ensure(body && typeof body === "object", "Solicitud inválida.");
    } catch {
      throw new DemoError("El cuerpo de la solicitud no es válido.", 400);
    }
    const { method, args = [] } = body;
    ensure(
      typeof method === "string" &&
        method.length < 80 &&
        Array.isArray(args) &&
        args.length < 8,
      "Solicitud inválida.",
    );
    if (method === "getPlatformHealth") {
      await initializeDemo();
      await database()`SELECT 1`;
      return Response.json(
        {
          status: "Healthy",
          checks: [{ name: "postgresql", status: "Healthy" }],
        },
        { headers: noCache },
      );
    }
    if (method === "login")
      return Response.json(
        await login(
          String(args[0]),
          String(args[1]),
          request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local",
        ),
        { headers: noCache },
      );
    const session = await sessionFor(
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "",
    );
    if (method === "logout") {
      await revoke(session);
      return Response.json(null, { headers: noCache });
    }
    // Validate account availability even for control-plane operations.
    await inTenant(session, false, () => null);
    if (method === "getWorkspace")
      return Response.json(await workspace(session), { headers: noCache });
    if (method === 'checkClientRestriction')
      return Response.json(await restrictionStatus(args[0]), { headers: noCache });
    if (method === 'listClientRestrictions')
      return Response.json(await listRestrictions(session, String(args[0] ?? ''), Number(args[1] ?? 1)), { headers: noCache });
    if (method === 'createClientRestriction')
      return Response.json(await createRestriction(session, String(args[0]), String(args[1]), String(args[2])), { headers: noCache });
    if (method === 'removeClientRestriction') {
      await removeRestriction(session, String(args[0]), String(args[1]));
      return Response.json(null, { headers: noCache });
    }
    if (method === "createTenant") {
      const d = args[0] as { code: string; name: string };
      return Response.json(await createTenant(session, d.code, d.name), {
        headers: noCache,
      });
    }
    if (method === "switchTenant")
      return Response.json(await switchTenant(session, String(args[0])), {
        headers: noCache,
      });
    const write = !(isReadOperation(method) || method === 'downloadStudentDisciplineDocument') || method === "previewScanSession";
    const result = await inTenant(session, write, async (state, transaction) => {
      const user = requireValue(
        state.users.find((u) => u.id === session.user_id),
      );
      const admin = user.roles.includes("AdministradorGeneral");
      if (['listStudentDisciplines','createStudentDiscipline','revokeStudentDiscipline','downloadStudentDisciplineDocument'].includes(method))
        return studentDisciplineOperation(state, session, method, args, transaction);
      if (method === 'registerStudent') await ensureStudentNotBlocked(String((args[0] as { student?: { dpi?: string } })?.student?.dpi ?? ''), transaction);
      if (['createEnrollment','setStudentActive','provisionStudentAccess','assignStudent','changeEnrollmentStatus','setUserAccess','updateStudent'].includes(method)) {
        const studentId = method === 'assignStudent' ? String(args[1]) : method === 'changeEnrollmentStatus'
          ? state.students.find(x => x.enrollments.some(e => e.id === args[0]))?.student.id : method === 'setUserAccess'
          ? state.students.find(x => x.student.userAccountId === args[0])?.student.id : String(args[0]);
        const student = state.students.find(x => x.student.id === studentId)?.student;
        const advancing = method !== 'setStudentActive' || args[1] === true;
        const access = method !== 'setUserAccess' || args[1] === true;
        const status = method !== 'changeEnrollmentStatus' || ['Submitted','Admitted','UnderReview','Approved'].includes(String((args[1] as { status?: string })?.status));
        if (student && advancing && access && status)
          await ensureStudentNotBlocked(method === 'updateStudent' ? String((args[1] as { dpi?: string })?.dpi ?? student.dpi) : student.dpi, transaction);
      }
      if (method === 'listPracticeNotices' || method === 'markPracticeNoticeRead' || method === 'markPracticeNoticeSounded')
        return practiceNoticeOperation(state, user, method, args);
      if (method === 'createClient') await ensureClientAllowed((args[0] as { dpi?: string })?.dpi, transaction);
      if (method === 'updateClient' || method === 'setClientAttention') {
        const current = requireValue(state.clients.find((candidate) => candidate.client.id === args[0]));
        const dpi = method === 'updateClient' ? ((args[1] as { dpi?: string })?.dpi ?? current.client.dpi) : current.client.dpi;
        if (method !== 'setClientAttention' || args[1] === true) await ensureClientAllowed(dpi, transaction);
      }
      if (method === 'openCase' || method === 'createIncomeDeclaration') {
        const clientId = method === 'openCase' ? (args[0] as { clientId?: string })?.clientId : String(args[0]);
        const current = requireValue(state.clients.find((candidate) => candidate.client.id === clientId));
        await ensureClientAllowed(current.client.dpi, transaction);
      }
      if (/Scan|scan/.test(method))
        return scanOperation(state, user, session.tenant_id, method, args);
      if (method === "uploadDocument")
        return upload(
          state,
          user,
          session.tenant_id,
          args[0] as Parameters<typeof upload>[3],
        );
      if (method === "downloadDocument")
        return download(state, user, String(args[0]));
      if (["getDocument", "getDocumentReadAccess"].includes(method)) {
        const d = requireValue(state.documents.find((d) => d.id === args[0]));
        authorizeDocument(state, user, d.contextType, d.contextId);
      }
      if (method === "setOwnPhoto" || method === "setUserPhoto") {
        ensure(
          method === "setOwnPhoto" || admin,
          "No tiene permiso para cambiar esta fotografía.",
          403,
        );
        const target =
          method === "setOwnPhoto"
            ? user
            : requireValue(state.users.find((u) => u.id === args[0]));
        const file = (
          method === "setOwnPhoto" ? args[0] : args[1]
        ) as UploadedFile;
        ensure(
          ["image/jpeg", "image/png", "image/webp"].includes(file.type),
          "Use PNG, JPEG o WEBP para la fotografía.",
        );
        const d = await upload(state, user, session.tenant_id, {
          file,
          contextType: "UserPhoto",
          contextId: target.id,
          label: "Fotografía de perfil",
          replaceDocumentId: target.photoDocumentId ?? undefined,
        });
        target.photoDocumentId = d.id;
        state.students
          .filter((p) => p.student.userAccountId === target.id)
          .forEach((p) => (p.student.photoDocumentId = d.id));
        return target;
      }
      if (method === "resetUserPassword" || method === "changeOwnPassword") {
        const target =
          method === "changeOwnPassword"
            ? user
            : requireValue(state.users.find((u) => u.id === args[0]));
        ensure(
          method === "changeOwnPassword" || admin,
          "No tiene permiso para restablecer contraseñas.",
          403,
        );
        ensure(
          target.id !== rootId,
          "La clave de plataforma se administra mediante soporte.",
        );
        if (method === "changeOwnPassword")
          ensure(
            checkPassword(String(args[0]), state.passwords[user.id] ?? ""),
            "La contraseña actual no coincide.",
          );
        state.passwords[target.id] = hashPassword(String(args[1]));
        audit(state, user, method, target.id);
        return null;
      }
      if (method === "provisionStudentAccess") {
        ensure(admin, "Sólo el administrador puede crear accesos.", 403);
        const student = requireValue(
          state.students.find((p) => p.student.id === args[0]),
        ).student;
        ensure(!student.userAccountId, "El alumno ya tiene una cuenta.");
        ensure(student.isActive && !state.studentLegalStudies?.[student.id]?.closure, 'La práctica del alumno ya está cerrada.');
        const data = args[1] as Record<string, unknown>;
        const account = operate(state, user, "createUser", [
          {
            ...data,
            studentId: student.id,
            username: student.email,
            email: student.email,
            fullName: student.fullName,
            isActive: true,
            roleIds: ["student"],
          },
        ]) as typeof user;
        state.passwords[account.id] = hashPassword(String(data.password));
        return {
          userAccountId: account.id,
          username: account.username,
          email: account.email,
          isActive: account.isActive,
        };
      }
      const response = operate(state, user, method, args);
      if (method === "createUser")
        state.passwords[(response as { id: string }).id] = hashPassword(
          String((args[0] as { password: string }).password),
        );
      if (method === "registerStudent") {
        const r = response as { access: { userAccountId: string } | null };
        if (r.access) state.passwords[r.access.userAccountId] = hashPassword(
          String((args[0] as { access: { password: string } }).access.password),
        );
      }
      return response;
    });
    if (method === 'getClient') {
      const profile = result as { client: { dpi: string | null } };
      return Response.json({ ...profile, restriction: await restrictionStatus(profile.client.dpi) }, { headers: noCache });
    }
    if (method === 'listClients') {
      const page = result as { items: Array<{ dpi: string | null }> };
      const items = await Promise.all(page.items.map(async item => ({ ...item, restriction: await restrictionStatus(item.dpi) })));
      return Response.json({ ...page, items }, { headers: noCache });
    }
    return Response.json(result, { headers: noCache });
  } catch (error) {
    if (error instanceof DemoError)
      return Response.json(
        { detail: error.message },
        { status: error.status, headers: noCache },
      );
    console.error(
      "Demo operation failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      {
        detail:
          "No se pudo completar la operación. Inténtelo nuevamente; si continúa, informe al administrador.",
      },
      { status: 500, headers: noCache },
    );
  }
}
