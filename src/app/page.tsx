import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function Home() {
  const supabase = getSupabaseServer();

  const { data: activities, error } = await supabase
    .from("activity_sessions")
    .select(
      "id, title, location, starts_at, ends_at, capacity, eligible_age_bands"
    )
    .eq("event_id", "10000000-0000-4000-8000-000000000001")
    .eq("is_open", true)
    .order("starts_at");

  if (error) {
    console.error("Activity query failed:", error.message);

    return (
      <main className="min-h-screen bg-[#FFF9EF] px-6 py-16 text-[#182B45]">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold">
            We couldn’t load the activities.
          </h1>
          <p className="mt-4 text-slate-600">
            Please refresh and try again.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF9EF] text-[#182B45]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <Link
            href="/"
            aria-label="Pamoja Play home"
            className="text-2xl font-black tracking-tight"
          >
            pamoja<span className="text-[#D94B35]">play.</span>
          </Link>

          <Link
            href="/book"
            className="rounded-xl bg-[#182B45] px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            Book an activity
          </Link>
        </header>

        <section className="max-w-3xl py-16 sm:py-20">
          <p className="mb-4 text-sm font-bold uppercase tracking-widest text-[#D94B35]">
            Little adventures. Together.
          </p>

          <h1 className="text-4xl font-black leading-tight sm:text-6xl">
            A day of discovery,
            <br />
            planned around your family.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Explore activities for your children and book their places
            together. If a session is full, join the waiting list as a
            family.
          </p>

          <Link
            href="/book"
            className="mt-8 inline-flex rounded-xl bg-[#D94B35] px-6 py-4 font-bold text-white transition hover:bg-[#BC3F2C]"
          >
            Plan our adventure
          </Link>

          <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium">
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2">
              17 October 2026
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2">
              Demo venue, Nairobi
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2">
              Ages 3–12
            </span>
          </div>
        </section>

        <section aria-labelledby="activities-heading">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-widest text-[#D94B35]">
              Explore the day
            </p>
            <h2
              id="activities-heading"
              className="mt-2 text-3xl font-bold"
            >
              Find their next adventure
            </h2>
            <p className="mt-3 text-slate-600">
              Check the age groups and choose an activity for your family.
            </p>
          </div>

          {!activities?.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-7">
              No activities have been published yet.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {activities.map((activity) => (
                <article
                  key={activity.id}
                  className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7"
                >
                  <p className="text-sm font-semibold text-[#D94B35]">
                    {activity.location}
                  </p>

                  <h3 className="mt-3 text-2xl font-bold">
                    {activity.title}
                  </h3>

                  <p className="mt-4 text-slate-600">
                    {formatTime(activity.starts_at)} –{" "}
                    {formatTime(activity.ends_at)}
                  </p>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    Age groups:{" "}
                    {activity.eligible_age_bands
                      .map((band: string) => band.replace("-", "–"))
                      .join(", ")}
                  </p>

                  <p className="mt-5 border-t border-slate-100 pt-4 text-sm font-semibold">
                    Total capacity: {activity.capacity} children
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Availability is checked when you book.
                  </p>

                  <Link
                    href="/book"
                    aria-label={`Open booking form for ${activity.title}`}
                    className="mt-6 inline-flex justify-center rounded-xl border border-[#182B45] px-4 py-3 font-semibold transition hover:bg-[#182B45] hover:text-white"
                  >
                    Open booking form
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-14 rounded-3xl bg-[#182B45] p-8 text-white sm:p-10">
          <h2 className="text-2xl font-bold">
            Their places belong together.
          </h2>

          <p className="mt-4 max-w-2xl leading-relaxed text-slate-200">
            Booking for two children? We check that there’s room for both.
            If there isn’t, the whole group joins the waiting list.
          </p>

          <Link
            href="/book"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-bold text-[#182B45] transition hover:bg-orange-50"
          >
            Book for my family
          </Link>
        </section>

        <footer className="mt-12 border-t border-slate-200 py-6 text-sm text-slate-500">
          Pamoja Play · Fictional event for the hackathon demo
        </footer>
      </div>
    </main>
  );
}
