import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const requestedPath = request.nextUrl.searchParams.get("next");
  const isPasswordRecovery = requestedPath === "/auth/update-password";
  const destination = new URL(isPasswordRecovery ? "/auth/update-password" : "/dashboard", request.url);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    destination.pathname = "/";
    destination.searchParams.set("auth_error", "configuration");
    return NextResponse.redirect(destination);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    destination.pathname = "/";
    const errorCode = request.nextUrl.searchParams.get("error_code");
    if (errorCode) destination.searchParams.set("error_code", errorCode);
    return NextResponse.redirect(destination);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    destination.pathname = "/";
    destination.searchParams.set("auth_error", "confirmation");
    return NextResponse.redirect(destination);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.couple_id && !isPasswordRecovery) {
    const inviteCode = data.user.user_metadata.couple_invite_code;
    if (typeof inviteCode === "string" && inviteCode.trim()) {
      await supabase.rpc("join_couple", { code: inviteCode.trim().toUpperCase() });
    } else {
      await supabase.rpc("create_couple", { relationship_date: null });
    }
  }

  return NextResponse.redirect(destination);
}