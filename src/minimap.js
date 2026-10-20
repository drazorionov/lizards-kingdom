export const MINIMAP_INK = "#d1bf98";

// HUD dimensions are in CSS pixels, independent of the game's world scale.
export function minimapLayout(renderer, world, all = false) {
  const unit = 1 / (renderer.cssScale || 1);
  const width = Math.min(340 * unit, renderer.viewWidth * 0.36);
  const compact = 620 / unit < 500;
  const height = Math.min(width * 0.44, (compact ? 80 : 150) * unit);
  const rooms = world.rooms.filter(
    (room) => all || world.discovered.has(room.id),
  );
  const left = Math.max(
    0,
    Math.min(
      ...(rooms.length ? rooms.map((r) => r.x) : [world.spawn?.x || 0]),
    ) - 120,
  );
  const top = Math.max(
    0,
    Math.min(
      ...(rooms.length ? rooms.map((r) => r.y) : [world.spawn?.y || 0]),
    ) - 120,
  );
  const right = Math.min(
    world.width,
    Math.max(...rooms.map((r) => r.x + r.w), left + 2600) + 120,
  );
  const bottom = Math.min(
    world.height,
    Math.max(...rooms.map((r) => r.y + r.h), top + 1000) + 120,
  );
  const zoom = Math.min(width / (right - left), height / (bottom - top));
  return {
    x: renderer.viewWidth - width - 24 * unit,
    y: (compact ? 96 : 112) * unit,
    width,
    height,
    unit,
    zoom,
    left: left - (width / zoom - (right - left)) / 2,
    top: top - (height / zoom - (bottom - top)) / 2,
  };
}

export function minimapPoint(layout, x, y) {
  return [
    layout.x + (x - layout.left) * layout.zoom,
    layout.y + (y - layout.top) * layout.zoom,
  ];
}

export function drawMinimapMarkers(renderer, game, layout, seen) {
  const g = renderer.ctx,
    w = game.world,
    u = layout.unit;
  g.save();
  // A shadow follows only the strokes and text; the map itself stays transparent.
  g.shadowColor = "#020b14";
  g.shadowBlur = 3 * u;
  g.lineWidth = 1.4 * u;
  g.textAlign = "center";
  g.font = `600 ${8 * u}px Manrope, Arial`;
  const camps = w.checkpoints || [w.checkpoint];
  camps.forEach((camp, index) => {
    if (!camp || !seen(camp)) return;
    const [x, y] = minimapPoint(layout, camp.x, camp.y);
    const active = game.checkpointUsed && camp === w.checkpoint;
    g.strokeStyle = MINIMAP_INK;
    g.fillStyle = MINIMAP_INK;
    g.beginPath();
    g.moveTo(x, y - 5 * u);
    g.lineTo(x - 5 * u, y + 4 * u);
    g.lineTo(x + 5 * u, y + 4 * u);
    g.closePath();
    if (active) g.fill();
    else g.stroke();
    if (active) {
      g.beginPath();
      g.arc(x, y, 8 * u, 0, Math.PI * 2);
      g.stroke();
    }
    if (camps.length > 1) g.fillText(String(index + 1), x, y - 10 * u);
  });
  const [px, py] = minimapPoint(layout, game.player.x + 15, game.player.y + 27);
  g.fillStyle = MINIMAP_INK;
  g.strokeStyle = MINIMAP_INK;
  g.beginPath();
  g.arc(px, py, 3 * u, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(px, py, 5 * u, 0, Math.PI * 2);
  g.stroke();
  const room = w.rooms.find(
    (room) =>
      game.player.x + 15 >= room.x &&
      game.player.x + 15 < room.x + room.w &&
      game.player.y + 27 >= room.y &&
      game.player.y + 27 < room.y + room.h,
  );
  g.font = `500 ${9 * u}px Manrope, Arial`;
  g.fillStyle = MINIMAP_INK;
  g.fillText(room?.name || "", layout.x + layout.width / 2, layout.y - 9 * u);
  g.font = `${8 * u}px Manrope, Arial`;
  g.fillStyle = MINIMAP_INK;
  g.fillText(
    "● Ты здесь   △ Привал   ◉ Возврат",
    layout.x + layout.width / 2,
    layout.y + layout.height + 14 * u,
  );
  g.restore();
}
