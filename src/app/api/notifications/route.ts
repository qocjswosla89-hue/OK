import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mclahufkvvhhknumgkpg.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4";

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, type, created_at, read, related_id")
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Notifications fetch error:", error.message);
      return NextResponse.json({ notifications: [] });
    }

    return NextResponse.json({ notifications: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Notifications GET error:", message);
    return NextResponse.json({ notifications: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, markAllRead } = body;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    if (markAllRead) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, markAllRead: true });
    }

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Notifications POST error:", message);
    return NextResponse.json({ error: `오류: ${message}` }, { status: 500 });
  }
}
