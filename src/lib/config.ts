export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "Paltas La Candelaria",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
};

export function hasSupabaseEnv() {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
}
