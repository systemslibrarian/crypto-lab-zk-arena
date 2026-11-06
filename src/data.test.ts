import { expect, it } from 'vitest';
import { DIMENSIONS, QUESTIONS, SYSTEMS } from './data';
it('does not award a family speed advantage from circuit size alone', () => {
  for (const id of ['prove-time', 'verify-time']) expect(DIMENSIONS.find(d => d.id === id)?.winner).toBe('tie');
  for (const option of QUESTIONS.find(q => q.id === 'scale')!.options) expect(option.weight.snark).toBe(option.weight.stark);
  expect(SYSTEMS.find(s => s.name === 'Groth16')!.note).not.toContain('fastest');
});
