"use client";

import { useActionState, useState } from "react";
import { submitBooking, type BookingState } from "./actions";

type Activity = {
  id: string;
  title: string;
  eligible_age_bands: string[];
};

const initialState: BookingState = {
  status: "idle",
  message: "",
};

const fieldClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-100";

export default function BookingForm({
  activities,
}: {
  activities: Activity[];
}) {
  const [state, formAction, pending] = useActionState(
    submitBooking,
    initialState
  );

  const [childCount, setChildCount] = useState("1");
  const [details, setDetails] = useState<Record<string, string>>({
    parentName: "",
    phone: "",
    nickname1: "",
    ageBand1: "",
    nickname2: "",
    ageBand2: "",
    sessionId: "",
  });

  function update(name: string, value: string) {
    setDetails((current) => ({ ...current, [name]: value }));
  }

  const completed =
    state.status === "confirmed" || state.status === "waiting";

  if (completed) {
    return (
      <section
        aria-live="polite"
        className="rounded-3xl border border-slate-200 bg-white p-8"
      >
        <p className="text-sm font-bold uppercase tracking-widest text-orange-700">
          {state.status === "confirmed" ? "You’re booked" : "You’re in the queue"}
        </p>

        <h2 className="mt-4 text-2xl font-bold">{state.message}</h2>

        <p className="mt-5 text-sm text-slate-600">
          Booking reference
        </p>
        <p className="mt-1 break-all font-mono text-sm">
          {state.bookingId}
        </p>

        <p className="mt-5 text-sm text-slate-600">
          Keep your booking reference for future updates.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Test another family
        </button>
      </section>
    );
  }

  return (
    <form action={formAction} className="space-y-7">
      <fieldset disabled={pending} className="space-y-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block font-semibold">
            Parent or guardian’s name
            <input
              name="parentName"
              value={details.parentName}
              onChange={(e) => update("parentName", e.target.value)}
              autoComplete="name"
              maxLength={80}
              required
              className={fieldClass}
            />
          </label>

          <label className="block font-semibold">
            Mobile number
            <input
              name="phone"
              type="tel"
              value={details.phone}
              onChange={(e) => update("phone", e.target.value)}
              autoComplete="tel"
              placeholder="0700000001"
              required
              className={fieldClass}
            />
          </label>
        </div>

        <label className="block font-semibold">
          How many children are joining?
          <select
            name="childCount"
            value={childCount}
            onChange={(e) => setChildCount(e.target.value)}
            className={fieldClass}
          >
            <option value="1">One child</option>
            <option value="2">Two children — book together</option>
          </select>
        </label>

        {Array.from({ length: Number(childCount) }, (_, index) => {
          const number = index + 1;
          const nicknameKey = `nickname${number}`;
          const ageKey = `ageBand${number}`;

          return (
            <fieldset
              key={number}
              className="rounded-2xl border border-slate-200 p-5"
            >
              <legend className="px-2 font-bold">
                Child {number}
              </legend>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block font-semibold">
                  Nickname
                  <input
                    name={nicknameKey}
                    value={details[nicknameKey]}
                    onChange={(e) => update(nicknameKey, e.target.value)}
                    maxLength={40}
                    required
                    className={fieldClass}
                  />
                </label>

                <label className="block font-semibold">
                  Age band
                  <select
                    name={ageKey}
                    value={details[ageKey]}
                    onChange={(e) => update(ageKey, e.target.value)}
                    required
                    className={fieldClass}
                  >
                    <option value="">Select age band</option>
                    <option value="3-5">3–5 years</option>
                    <option value="6-8">6–8 years</option>
                    <option value="9-12">9–12 years</option>
                  </select>
                </label>
              </div>
            </fieldset>
          );
        })}

        <label className="block font-semibold">
          Choose an activity
          <select
            name="sessionId"
            value={details.sessionId}
            onChange={(e) => update("sessionId", e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Select an activity</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.title} · Ages{" "}
                {activity.eligible_age_bands.join(", ")}
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm leading-relaxed text-slate-600">
          If there isn’t space for every selected child, the whole
          group joins the waiting list.
        </p>

        <button
          type="submit"
          disabled={pending || activities.length === 0}
          className="w-full rounded-xl bg-[#D94B35] px-6 py-4 font-bold text-white disabled:opacity-60"
        >
          {pending ? "Checking places…" : "Book our adventure"}
        </button>
      </fieldset>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

