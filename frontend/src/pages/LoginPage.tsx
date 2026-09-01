import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Scale, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field } from '../components/ui';
import { useNotify } from '../components/ui/Feedback';
import { humanizeOperationError } from '../components/ui/feedback/feedbackBus';
import { motion } from '../components/ui/motion/motion';
import { useAuth } from '../context/AuthContext';
import { dataSource } from '../data/dataSource';

export function LoginPage() {
  const [email, setEmail] = useState(dataSource.mode === 'mock' ? 'admin.bufete@umg.edu.gt' : '');
  const [password, setPassword] = useState(dataSource.mode === 'mock' ? 'demo-local' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const shellRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { login, loading } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();

  useEffect(() => {
    if (!shellRef.current) return;
    const entrance = motion.loginEnter(shellRef.current);
    return entrance.cancel;
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    try {
      await login(email, password);
      setStatus('success');
      notify.success({ title: 'Acceso concedido', message: 'Bienvenido al Bufete Popular UMG.', duration: 3500 });
      const button = formRef.current?.querySelector<HTMLElement>('.button');
      const animations = [shellRef.current ? motion.loginExit(shellRef.current).finished : Promise.resolve(), button ? motion.successPulse(button).finished : Promise.resolve()];
      await Promise.all(animations);
      navigate('/');
    } catch (cause) {
      setStatus('error');
      notify.error({ title: 'No fue posible iniciar sesión', message: humanizeOperationError(cause) });
      if (formRef.current) void motion.shakeError(formRef.current).finished;
    }
  };

  return <main className="login-page">
    <div className="login-shell" ref={shellRef}>
      <section className="login-brand" aria-label="Bufete Jurídico UMG">
        <div className="login-brand__mark">
          <span><Scale size={22} /></span>
          <div><small>UMG</small><strong>Bufete Popular</strong></div>
        </div>
        <div className="login-brand__copy">
          <small>GESTIÓN JURÍDICA INTERNA</small>
          <h1>Bufete Popular<br /><em>UMG</em></h1>
          <p className="login-brand__tagline">Casos claros. Seguimiento responsable.</p>
          <p>Gestión interna de expedientes, práctica supervisada y trazabilidad institucional.</p>
        </div>
        <div className="login-brand__features" aria-label="Capacidades principales">
          <span><CheckCircle2 size={17} /><span><strong>Expediente digital</strong><small>Documentos y actuaciones en un solo lugar.</small></span></span>
          <span><ShieldCheck size={17} /><span><strong>Trazabilidad completa</strong><small>Cada movimiento conserva su responsable.</small></span></span>
        </div>
        <small className="login-brand__institution">Universidad Mariano Gálvez de Guatemala</small>
      </section>

      <section className="login-form-panel">
        <form ref={formRef} onSubmit={submit} data-status={status}>
          <header className="login-form__header">
            <img className="login-logo" src="/umg.png" alt="Universidad Mariano Gálvez" />
            <div><small>ACCESO INTERNO</small><h2>Bienvenido</h2><p>Ingrese con sus credenciales autorizadas.</p></div>
          </header>
          <div className="login-fields">
            <Field label="Correo electrónico">
              <span className="input-with-icon"><UserRound size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus /></span>
            </Field>
            <Field label="Contraseña">
              <span className="input-with-icon input-with-icon--password"><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
            </Field>
          </div>
          <Button type="submit" disabled={loading || status === 'success'}>
            {status === 'loading' ? <><LoaderCircle className="spin" size={17} /> Validando acceso…</> : status === 'success' ? <><CheckCircle2 size={17} /> Acceso concedido</> : <>Ingresar al sistema <ArrowRight size={17} /></>}
          </Button>
          <small className="login-note"><LockKeyhole size={12} /> Uso exclusivo del personal y alumnos autorizados.</small>
        </form>
      </section>
    </div>
  </main>;
}
