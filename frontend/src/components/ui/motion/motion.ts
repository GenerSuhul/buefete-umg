import { animate, stagger } from "animejs";

export const motionDuration = {
  micro: 140,
  normal: 230,
  emphasis: 360,
} as const;

export interface MotionHandle {
  finished: Promise<void>;
  cancel: () => void;
}

const completed: MotionHandle = {
  finished: Promise.resolve(),
  cancel: () => undefined,
};

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function run(targets: Parameters<typeof animate>[0], parameters: Parameters<typeof animate>[1]): MotionHandle {
  if (prefersReducedMotion()) return completed;
  const instance = animate(targets, parameters);
  return {
    finished: Promise.resolve(instance).then(() => undefined),
    cancel: () => instance.cancel(),
  };
}

export const motion = {
  loginEnter(root: HTMLElement) {
    const elements = root.querySelectorAll<HTMLElement>(".login-brand__mark, .login-brand__copy, .login-brand__features, .login-form__header, .login-fields > *, .login-form-panel .button, .login-note");
    return run(elements, {
      opacity: { from: 0, to: 1 },
      y: { from: 8, to: 0 },
      duration: motionDuration.normal,
      delay: stagger(32),
      ease: "out(3)",
    });
  },
  loginExit(root: HTMLElement) {
    return run(root, {
      opacity: { to: 0 },
      scale: { to: 0.992 },
      y: { to: -4 },
      duration: motionDuration.normal,
      ease: "in(2)",
    });
  },
  routeEnter(root: HTMLElement) {
    const targets = root.querySelectorAll<HTMLElement>(":scope > .page-header, :scope > .dashboard-grid, :scope > .detail-layout, :scope > .directory-shell, :scope > .card, :scope > section");
    if (!targets.length) return completed;
    return run(targets, {
      opacity: { from: 0, to: 1 },
      y: { from: 7, to: 0 },
      duration: motionDuration.normal,
      delay: stagger(24),
      ease: "out(3)",
    });
  },
  modalEnter(overlay: HTMLElement, panel: HTMLElement) {
    const overlayMotion = run(overlay, { opacity: { from: 0, to: 1 }, duration: motionDuration.micro, ease: "out(2)" });
    const panelMotion = run(panel, { opacity: { from: 0, to: 1 }, scale: { from: 0.985, to: 1 }, y: { from: 9, to: 0 }, duration: motionDuration.normal, ease: "out(3)" });
    return { finished: Promise.all([overlayMotion.finished, panelMotion.finished]).then(() => undefined), cancel: () => { overlayMotion.cancel(); panelMotion.cancel(); } };
  },
  modalExit(overlay: HTMLElement, panel: HTMLElement) {
    const overlayMotion = run(overlay, { opacity: { to: 0 }, duration: motionDuration.micro, ease: "in(2)" });
    const panelMotion = run(panel, { opacity: { to: 0 }, scale: { to: 0.99 }, y: { to: 5 }, duration: motionDuration.micro, ease: "in(2)" });
    return { finished: Promise.all([overlayMotion.finished, panelMotion.finished]).then(() => undefined), cancel: () => { overlayMotion.cancel(); panelMotion.cancel(); } };
  },
  toastEnter(element: HTMLElement, index = 0) {
    return run(element, { opacity: { from: 0, to: 1 }, x: { from: 26, to: 0 }, scale: { from: 0.97, to: 1 }, duration: motionDuration.normal, delay: Math.min(index * 22, 66), ease: "out(3)" });
  },
  toastExit(element: HTMLElement) {
    return run(element, { opacity: { to: 0 }, x: { to: 22 }, scale: { to: 0.98 }, duration: motionDuration.micro, ease: "in(2)" });
  },
  successPulse(element: HTMLElement) {
    return run(element, { scale: [{ to: 1.025 }, { to: 1 }], duration: motionDuration.normal, ease: "inOut(2)" });
  },
  shakeError(element: HTMLElement) {
    return run(element, { x: [{ to: -5 }, { to: 4 }, { to: -2 }, { to: 0 }], duration: motionDuration.normal, ease: "inOut(2)" });
  },
};
