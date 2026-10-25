export type Pt = { id: string; lat: number; lng: number; severity: string };

/** Great-circle distance in metres. */
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type Cluster = {
  id: number;
  size: number;
  centroid: { lat: number; lng: number };
  radius: number;
  severities: Record<string, number>;
};

/**
 * DBSCAN over geographic points, distances in metres.
 * O(n^2) neighbourhood queries — fine for the volumes a single
 * incident area produces; swap for PostGIS when data grows.
 */
export function dbscan(points: Pt[], epsM: number, minPts: number): Cluster[] {
  const n = points.length;
  const labels: number[] = new Array(n).fill(-2); // -2 unvisited, -1 noise
  let clusterId = 0;

  const neighbours = (i: number): number[] => {
    const out: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (
        haversine(
          points[i].lat,
          points[i].lng,
          points[j].lat,
          points[j].lng,
        ) <= epsM
      ) {
        out.push(j);
      }
    }
    return out;
  };

  const centroidOf = (idx: number[]) => {
    let lat = 0;
    let lng = 0;
    for (const i of idx) {
      lat += points[i].lat;
      lng += points[i].lng;
    }
    return { lat: lat / idx.length, lng: lng / idx.length };
  };

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue;
    const nbrs = neighbours(i);
    if (nbrs.length + 1 < minPts) {
      labels[i] = -1;
      continue;
    }
    const cid = clusterId++;
    labels[i] = cid;
    const queue = [...nbrs];
    while (queue.length > 0) {
      const j = queue.shift()!;
      if (labels[j] === -1) labels[j] = cid; // noise -> border point
      if (labels[j] !== -2) continue;
      labels[j] = cid;
      const jNbrs = neighbours(j);
      if (jNbrs.length + 1 >= minPts) queue.push(...jNbrs);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (labels[i] >= 0) {
      const g = groups.get(labels[i]) ?? [];
      g.push(i);
      groups.set(labels[i], g);
    }
  }

  const clusters: Cluster[] = [];
  for (const idx of groups.values()) {
    const centroid = centroidOf(idx);
    let radius = 0;
    const severities: Record<string, number> = {};
    for (const i of idx) {
      radius = Math.max(
        radius,
        haversine(centroid.lat, centroid.lng, points[i].lat, points[i].lng),
      );
      severities[points[i].severity] = (severities[points[i].severity] ?? 0) + 1;
    }
    clusters.push({
      id: clusters.length,
      size: idx.length,
      centroid,
      radius: Math.max(radius, 60),
      severities,
    });
  }
  return clusters.sort((a, b) => b.size - a.size);
}
