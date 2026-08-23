import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path === "/" || path === "/login" || path.startsWith("/_next");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (path === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = profile.role === "admin" ? "/dashboard" : "/tarefas";
      return NextResponse.redirect(url);
    }

    const adminOnlyPrefixes = [
      "/dashboard",
      "/quartos",
      "/camareiras",
      "/mesas/gerenciar",
      "/checklists",
      "/historico",
      "/chegadas-saidas/gerenciar",
      "/ocorrencias",
    ];
    if (profile.role !== "admin" && adminOnlyPrefixes.some((p) => path.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/tarefas";
      return NextResponse.redirect(url);
    }

    const camareiraOnlyPrefixes = ["/tarefas"];
    if (profile.role === "admin" && camareiraOnlyPrefixes.some((p) => path.startsWith(p))) {
      // admin can still view; no redirect needed
    }
  }

  return response;
}
