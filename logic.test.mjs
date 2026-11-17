import test from 'node:test';
import assert from 'node:assert/strict';
import { movementDelta, consumeRound, refillMagazine, waveSize, applyDamage, chooseChestLoot } from './logic.js';

test('teclas movem o personagem em relação à direção da câmera e normalizam diagonais', () => {
  const forward = movementDelta(new Set(['KeyW']), 0, 1);
  assert.ok(Math.abs(forward.x) < 1e-9);
  assert.equal(forward.z, -5.4);
  const diagonal = movementDelta(new Set(['KeyW', 'KeyD']), 0, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 5.4) < 1e-9);
  assert.ok(movementDelta(new Set(['KeyW']), 0, 1, true).z < forward.z);
});

test('tiro consome exatamente uma bala e não deixa munição ficar negativa', () => {
  const weapon = { mag: 1 };
  assert.equal(consumeRound(weapon), true);
  assert.equal(weapon.mag, 0);
  assert.equal(consumeRound(weapon), false);
  assert.equal(weapon.mag, 0);
});

test('recarga completa a arma sem ultrapassar o carregador ou a reserva', () => {
  const weapon = { mag: 3, magSize: 12, reserve: 5 };
  assert.equal(refillMagazine(weapon), 5);
  assert.deepEqual(weapon, { mag: 8, magSize: 12, reserve: 0 });
});

test('cada onda acrescenta três zumbis à horda', () => {
  assert.equal(waveSize(1), 5);
  assert.equal(waveSize(2), 8);
  assert.equal(waveSize(5), 17);
});

test('dano encerra zumbi quando a vida chega a zero', () => {
  const zombie = { hp: 20 };
  assert.equal(applyDamage(zombie, 12), false);
  assert.equal(zombie.hp, 8);
  assert.equal(applyDamage(zombie, 22), true);
  assert.equal(zombie.hp, 0);
});

test('baús distribuem munição, kit médico, arma ou pontuação em faixas distintas', () => {
  assert.equal(chooseChestLoot(0.1), 'ammo');
  assert.equal(chooseChestLoot(0.5), 'medkit');
  assert.equal(chooseChestLoot(0.75), 'weapon');
  assert.equal(chooseChestLoot(0.95), 'score');
});
