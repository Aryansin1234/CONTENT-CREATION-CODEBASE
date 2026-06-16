// Mock Supabase client — in-memory store
const store: Record<string, any[]> = {};

export const mockSupabase = {
  from: (table: string) => ({
    select: (_: string) => ({
      eq: (_col: string, _val: any) => ({
        single: async () => ({ data: (store[table] ?? []).find(() => true) ?? null }),
        in: (_col2: string, _vals: any[]) => ({ data: store[table] ?? [] }),
      }),
      in: (_col: string, _vals: any[]) => ({ data: store[table] ?? [] }),
      gte: (_col: string, _val: any) => ({
        order: (_col2: string, _opts: any) => ({
          limit: (_n: number) => ({ data: store[table] ?? [] }),
        }),
        lte: (_col2: string, _val2: any) => ({
          limit: (_n: number) => ({ data: store[table] ?? [] }),
        }),
      }),
      order: (_col: string, _opts: any) => ({
        limit: (_n: number) => ({ data: store[table] ?? [] }),
      }),
    }),
    insert: async (rows: any) => {
      store[table] = [...(store[table] ?? []), ...(Array.isArray(rows) ? rows : [rows])];
      return { error: null };
    },
    upsert: async (row: any, _opts?: any) => {
      store[table] = [...(store[table] ?? []).filter((r) => r.url_hash !== row.url_hash), row];
      return { error: null };
    },
  }),
  storage: {
    from: (_bucket: string) => ({
      upload: async () => ({ error: null }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: `https://storage.test/${_path}` } }),
    }),
  },
};

export function clearMockStore(): void {
  Object.keys(store).forEach((k) => delete store[k]);
}
