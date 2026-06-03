function getEnv(name: string) {
  return process.env[name];
}

export const appConfig = {
  name: getEnv("NEXT_PUBLIC_APP_NAME") ?? "Paltas La Candelaria",
  appUrl: getEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL") ?? "",
  supabaseAnonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "",
  supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? ""
};

export function hasSupabaseEnv() {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
}
