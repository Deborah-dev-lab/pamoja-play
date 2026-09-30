"use server";

import { getSupabaseServer } from "@/lib/supabase-server";
import { sendBookingSms } from "@/lib/sms";

export type BookingState = {
  status: "idle" | "error" | "confirmed" | "waiting";
  message: string;
  bookingId?: string;
};

export async function submitBooking(
  _previousState: BookingState,
  formData: FormData
): Promise<BookingState> {
  if (process.env.NODE_ENV === "production") {
    return {
      status: "error",
      message: "Online booking is not open yet.",
    };
  }

  const read = (name: string) =>
    String(formData.get(name) ?? "").trim();

  const parentName = read("parentName");
  let phone = read("phone").replace(/[\s()-]/g, "");
  const sessionId = read("sessionId");
  const childCount = read("childCount");

  if (/^0[17]\d{8}$/.test(phone)) {
    phone = `+254${phone.slice(1)}`;
  } else if (/^254[17]\d{8}$/.test(phone)) {
    phone = `+${phone}`;
  }

  if (!parentName || parentName.length > 80) {
    return {
      status: "error",
      message: "Enter a parent name of up to 80 characters.",
    };
  }

  if (!/^\+254[17]\d{8}$/.test(phone)) {
    return {
      status: "error",
      message: "Enter a Kenyan mobile number, such as 0700000003.",
    };
  }

  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return { status: "error", message: "Choose an activity." };
  }

  if (childCount !== "1" && childCount !== "2") {
    return { status: "error", message: "Select one or two children." };
  }

  const nicknames = [read("nickname1")];
  const ageBands = [read("ageBand1")];

  if (childCount === "2") {
    nicknames.push(read("nickname2"));
    ageBands.push(read("ageBand2"));
  }

  if (
    nicknames.some((name) => !name || name.length > 40) ||
    ageBands.some((band) => !["3-5", "6-8", "9-12"].includes(band))
  ) {
    return {
      status: "error",
      message: "Enter a nickname and age band for every child.",
    };
  }

  let booking: {
    status: "confirmed" | "waiting";
    booking_id: string;
  };
  let activityTitle: string;

  try {
    const supabase = getSupabaseServer();

    const { data: activity, error: activityError } = await supabase
      .from("activity_sessions")
      .select("title")
      .eq("id", sessionId)
      .eq("event_id", "10000000-0000-4000-8000-000000000001")
      .single();

    if (activityError || !activity) {
      return {
        status: "error",
        message: "This activity could not be found.",
      };
    }

    activityTitle = activity.title;

    const { data, error } = await supabase.rpc(
      "register_and_book_family",
      {
        p_parent_name: parentName,
        p_phone_number: phone,
        p_session_id: sessionId,
        p_nicknames: nicknames,
        p_age_bands: ageBands,
      }
    );

    if (error) {
      console.error("Booking failed:", error.code, error.message);

      return {
        status: "error",
        message:
          error.code === "23505"
            ? "This number is already registered. Test another family with a different fictional number."
            : error.code === "P0001"
              ? error.message
              : "We couldn’t save the booking. Please try again.",
      };
    }

    if (
      !data?.booking_id ||
      !["confirmed", "waiting"].includes(data.status)
    ) {
      return {
        status: "error",
        message: "We couldn’t confirm the booking result.",
      };
    }

    booking = data;
  } catch {
    return {
      status: "error",
      message: "We couldn’t connect. Please try again.",
    };
  }

  const total = nicknames.length;
  const group = `${total} ${total === 1 ? "child" : "children"}`;

  const smsMessage =
    booking.status === "confirmed"
      ? `Pamoja Play: ${group} confirmed for ${activityTitle}. Reference: ${booking.booking_id}.`
      : `Pamoja Play: Your group of ${total} is waiting for ${activityTitle}. Places will be offered together. Reference: ${booking.booking_id}.`;

  // Notification failure must not turn a saved booking into an error.
  let notification =
    "Your booking is saved, but SMS could not be sent.";

  try {
    const smsResult = await sendBookingSms(
      booking.booking_id,
      phone,
      smsMessage
    );

    if (smsResult === "accepted") {
      notification =
        "SMS accepted. Check your Africa’s Talking simulator inbox.";
    } else if (smsResult === "pending") {
      notification = "Your booking is saved. SMS is pending.";
    }
  } catch {
    console.error("SMS notification could not be completed.");
  }

  const bookingMessage =
    booking.status === "confirmed"
      ? `Places confirmed for ${group}.`
      : "Your family is on the waiting list. Your requested places stay together.";

  return {
    status: booking.status,
    bookingId: booking.booking_id,
    message: `${bookingMessage} ${notification}`,
  };
}
