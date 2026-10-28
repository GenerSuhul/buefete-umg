import type { RequirementDefinition } from '../types/domain';

export function validateRequirement(input: Omit<RequirementDefinition, 'id' | 'maximumAgeDays'> & { maximumAgeDays: string }): string | null {
  if (!input.code.trim() || !input.label.trim()) return 'Complete el código y la etiqueta del requisito antes de guardar.';
  if (input.isConditional && !input.conditionDescription?.trim()) return 'Explique en «Condición» cuándo se solicita este requisito.';
  if (input.kind === 'Document' && input.maximumAgeDays && (!Number.isInteger(Number(input.maximumAgeDays)) || Number(input.maximumAgeDays) <= 0))
    return 'La vigencia debe ser un número de días mayor que cero. Déjela vacía si no vence.';
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) return 'El orden debe ser un número entero igual o mayor que cero.';
  return null;
}
