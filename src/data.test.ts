import { expect, it } from 'vitest';
import { DIMENSIONS, QUESTIONS, SHARED, SYSTEMS } from './data';
it('does not award a family speed advantage from circuit size alone', () => {
  for (const id of ['prove-time', 'verify-time']) expect(DIMENSIONS.find(d => d.id === id)?.winner).toBe('tie');
  for (const option of QUESTIONS.find(q => q.id === 'scale')!.options) expect(option.weight.snark).toBe(option.weight.stark);
  expect(SYSTEMS.find(s => s.name === 'Groth16')!.note).not.toContain('fastest');
});

it('does not attribute one assumption set or one non-interactivity transform to every SNARK', () => {
  const assumptions = DIMENSIONS.find(d => d.id === 'assumptions')!;
  expect(assumptions.winner).toBe('tie');
  expect(assumptions.snark).toContain('varies');
  expect(assumptions.detail).toContain('Plonky2');
  const nonInteractive = SHARED.find(s => s.title === 'Both are non-interactive')!;
  expect(nonInteractive.body).toContain('Many IOP-based systems');
  expect(nonInteractive.body).toContain('Groth16');
});
