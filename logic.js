export function movementDelta(keys, yaw, dt, sprinting = false) {
  let side = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  let depth = Number(keys.has('KeyS')) - Number(keys.has('KeyW'));
  const magnitude = Math.hypot(side, depth) || 1;
  side /= magnitude; depth /= magnitude;
  const speed = sprinting ? 8.1 : 5.4;
  const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
  return { x: (rightX * side - forwardX * depth) * speed * dt, z: (rightZ * side - forwardZ * depth) * speed * dt };
}

export function consumeRound(weapon) {
  if (!weapon || weapon.mag <= 0) return false;
  weapon.mag -= 1;
  return true;
}

export function refillMagazine(weapon) {
  const amount = Math.min(Math.max(0, weapon.magSize - weapon.mag), weapon.reserve);
  weapon.mag += amount;
  weapon.reserve -= amount;
  return amount;
}

export function waveSize(wave) {
  return 5 + Math.max(0, Math.floor(wave) - 1) * 3;
}

export function applyDamage(target, damage) {
  target.hp = Math.max(0, target.hp - Math.max(0, damage));
  return target.hp === 0;
}

export function chooseChestLoot(roll) {
  if (roll < 0.38) return 'ammo';
  if (roll < 0.65) return 'medkit';
  if (roll < 0.84) return 'weapon';
  return 'score';
}
