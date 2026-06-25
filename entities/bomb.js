/** Бомбы в стиле Bomberman */

function createBomb(x, y, owner, fuseTime) {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  return {
    x: (col + 0.5) * TILE_SIZE,
    y: (row + 0.5) * TILE_SIZE,
    col,
    row,
    fuse: fuseTime,
    owner,
    alive: true,
  };
}

function getBombBlastTiles(map, col, row, range) {
  const tiles = [{ col, row }];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (const [dc, dr] of dirs) {
    for (let i = 1; i <= range; i++) {
      const c = col + dc * i;
      const r = row + dr * i;
      const tile = tileAt(map, c, r);
      if (tile === TILE.VOID) break;
      if (tile === TILE.WALL_HARD) break;
      if (tile === TILE.COLUMN) {
        tiles.push({ col: c, row: r });
        break;
      }
      tiles.push({ col: c, row: r });
    }
  }
  return tiles;
}

function tileHasBomb(bombs, col, row) {
  return bombs.some((b) => b.alive && b.col === col && b.row === row);
}

function tryPlaceBomb(player, bombs, map, fuseTime) {
  if (!player.alive || !player.loadout?.hasBombs) return false;
  const col = Math.floor(player.x / TILE_SIZE);
  const row = Math.floor(player.y / TILE_SIZE);
  const tile = tileAt(map, col, row);
  if (!isWalkableTile(tile)) return false;
  if (tileHasBomb(bombs, col, row)) return false;

  bombs.push(createBomb(player.x, player.y, player, fuseTime));
  return true;
}

function updateBombs(bombs, map, mobs, players, effects, blastRange, blastDamage, dt, onMobKilled) {
  for (const bomb of bombs) {
    if (!bomb.alive) continue;
    bomb.fuse -= dt;
    if (bomb.fuse > 0) continue;

    bomb.alive = false;
    const tiles = getBombBlastTiles(map, bomb.col, bomb.row, blastRange);
    spawnExplosion(effects, tiles, blastDamage, bomb.owner);

    for (const tile of tiles) {
      const i = tile.row * MAP_W + tile.col;
      if (map.tiles[i] === TILE.WALL_SOFT) {
        map.tiles[i] = TILE.FLOOR;
      }

      const wx = (tile.col + 0.5) * TILE_SIZE;
      const wy = (tile.row + 0.5) * TILE_SIZE;

      for (const mob of mobs) {
        if (!mob.alive) continue;
        const mc = Math.floor(mob.x / TILE_SIZE);
        const mr = Math.floor(mob.y / TILE_SIZE);
        if (mc === tile.col && mr === tile.row) {
          const killed = mobTakeDamage(mob, blastDamage, bomb.owner, effects);
          if (killed && onMobKilled) onMobKilled(bomb.owner, mob);
        }
      }

      for (const pl of players) {
        if (!pl.alive || pl.invuln > 0) continue;
        const pc = Math.floor(pl.x / TILE_SIZE);
        const pr = Math.floor(pl.y / TILE_SIZE);
        if (pc === tile.col && pr === tile.row) {
          playerTakeDamage(pl, blastDamage * 0.5, effects, wx, wy);
        }
      }
    }
  }
  return bombs.filter((b) => b.alive);
}

function drawBombs(ctx, bombs, fogMap) {
  for (const bomb of bombs) {
    if (!bomb.alive) continue;
    if (fogMap && !isWorldVisible(fogMap, bomb.x, bomb.y)) continue;
    const pulse = 0.85 + Math.sin(bomb.fuse * 8) * 0.15;
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, 11 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💣", bomb.x, bomb.y);
  }
}
