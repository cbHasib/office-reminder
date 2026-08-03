import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

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

  const { data: { session } } = await supabase.auth.getSession();
  const path = request.nextUrl.pathname;

  // Redirects must carry over any auth cookies the client refreshed onto
  // `response`, or a rotated refresh token gets lost and the session breaks.
  function redirectWith(url: URL) {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // Keep proxy fast: session reads cookies, while getUser validates with Supabase.
  // Dashboard layouts still verify the user server-side before rendering protected data.
  if (!session && path.startsWith("/dashboard")) {
    return redirectWith(new URL("/login", request.url));
  }
  if (session && (path === "/login" || path === "/signup")) {
    return redirectWith(new URL("/dashboard/teams", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
