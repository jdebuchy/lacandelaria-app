import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export type AppProfile = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  full_name: string;
  role: UserRole;
  active: boolean;
};

export type AuthContext = {
  user: User;
  profile: AppProfile;
};

const PROFILE_SELECT = "id, auth_user_id, email, full_name, role, active";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("auth.getSession failed", sessionError);
    return null;
  }

  if (!session) {
    return null;
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    console.error("auth.getUser failed", error);
    return null;
  }

  return user;
}

async function findProfileByAuthUserId(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("auth_user_id", userId)
    .limit(1)
    .maybeSingle<AppProfile>();

  if (error) {
    console.error("profile lookup by auth_user_id failed", error);
    return null;
  }

  return data;
}

async function findProfileByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .ilike("email", normalizeEmail(email))
    .limit(1)
    .maybeSingle<AppProfile>();

  if (error) {
    console.error("profile lookup by email failed", error);
    return null;
  }

  return data;
}

async function linkProfileToAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  authUserId: string
) {
  const { data, error } = await admin
    .from("profiles")
    .update({ auth_user_id: authUserId })
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single<AppProfile>();

  if (error) {
    console.error("profile link failed", error);
    return null;
  }

  return data;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  const admin = createAdminClient();
  let profile = await findProfileByAuthUserId(admin, user.id);

  if (!profile && user.email) {
    const emailProfile = await findProfileByEmail(admin, user.email);

    if (emailProfile) {
      if (emailProfile.auth_user_id && emailProfile.auth_user_id !== user.id) {
        return null;
      }

      profile =
        emailProfile.auth_user_id === user.id
          ? emailProfile
          : await linkProfileToAuthUser(admin, emailProfile.id, user.id);
    }
  }

  if (!profile || !profile.active) {
    return null;
  }

  return { user, profile };
}

export async function requirePageRole(allowedRoles: readonly UserRole[], nextPath: string) {
  const auth = await getAuthContext();

  if (!auth) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}&reason=not_registered`);
  }

  if (!allowedRoles.includes(auth.profile.role)) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}&reason=forbidden`);
  }

  return auth;
}

export async function requirePageRegistration(nextPath: string) {
  const auth = await getAuthContext();

  if (!auth) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}&reason=not_registered`);
  }

  return auth;
}

export async function requireApiRole(allowedRoles: readonly UserRole[]) {
  const auth = await getAuthContext();

  if (!auth) {
    return {
      error: NextResponse.json(
        { success: false, message: "Debes iniciar sesion con un usuario registrado." },
        { status: 401 }
      )
    };
  }

  if (!allowedRoles.includes(auth.profile.role)) {
    return {
      error: NextResponse.json(
        { success: false, message: "No tienes permisos para esta accion." },
        { status: 403 }
      )
    };
  }

  return { auth };
}
