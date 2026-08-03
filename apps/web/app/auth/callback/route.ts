import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Email confirmation callback. Supabase lands users here after they click the
 * verification link in their inbox; we exchange the code for a session and
 * forward them to the desired page (defaults to the dashboard).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  // Only allow same-origin, path-only destinations — anything else
  // (https://evil.com, //evil.com) would be an open redirect.
  const rawNext = url.searchParams.get("next") ?? "/dashboard/teams";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/dashboard/teams";

  const response = NextResponse.redirect(new URL(next, request.url));

  if (!code && !tokenHash) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: any) => {
          toSet.forEach(({ name, value, options }: any) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // PKCE links carry ?code=;  token-hash links (customized email templates)
  // carry ?token_hash=&type= — support both.
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: (type ?? "email") as any, token_hash: tokenHash! });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
  return response;
}
