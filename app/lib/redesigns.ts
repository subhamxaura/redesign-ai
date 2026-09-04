// Placeholder architecture for redesign history
// Stored per-user, not committing binary images.
// Future: move to Postgres/Prisma when persistent history is needed.

export type StoredRedesign = {
  id: string;
  userId: string;
  createdAt: string;
  title: string;
  // we store only lightweight preview data, not the raw image buffer
  theme?: { background: string; surface: string; accent: string; text: string };
  analysisExcerpt?: string;
};

// For now, return empty array — no fake history
// Wiring is ready for future persistence without changing dashboard API.
export async function getRecentRedesignsForUser(_userId: string): Promise<StoredRedesign[]> {
  void _userId;
  return [];
}
