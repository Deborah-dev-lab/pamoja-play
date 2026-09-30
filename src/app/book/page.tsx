import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase-server";
import BookingForm from "./BookingForm";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const supabase = getSupabaseServer();

  const { data: activities, error } = await supabase
    .from("activity_sessions")
    .select("id, title, eligible_age_bands")
    .eq("event_id", "10000000-0000-4000-8000-000000000001")
    .eq("is_open", true)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");

  if (error) {
    console.error("Booking page failed:", error.message);
  }

  return (
    <main className="min-h-screen bg-[#FFF9EF] px-6 py-12 text-[#182B45]">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-semibold">
          ← Back to activities
        </Link>

        <p className="mt-10 text-sm font-bold uppercase tracking-widest text-[#D94B35]">
          Pamoja Play
        </p>

        <h1 className="mt-3 text-4xl font-black">
          Plan a little adventure.
        </h1>

        <p className="mt-4 mb-8 leading-relaxed text-slate-600">
          Choose an activity for one or two children. We’ll keep their
          places together.
        </p>

        <p className="mb-6 rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
          Local demo: use fictional names and phone numbers.
        </p>

        {error ? (
          <p role="alert">
            We couldn’t load the activities. Please refresh and try again.
          </p>
        ) : (
          <BookingForm activities={activities ?? []} />
        )}
      </div>
    </main>
  );
}
