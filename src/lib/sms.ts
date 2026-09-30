import "server-only";
import { getSupabaseServer } from "@/lib/supabase-server";

type SmsResult = "accepted" | "failed" | "pending";

type SmsResponse = {
  SMSMessageData?: {
    Recipients?: Array<{
      statusCode: number;
      status: string;
      messageId?: string;
    }>;
  };
};

export async function sendBookingSms(
  bookingId: string,
  phone: string,
  message: string
): Promise<SmsResult> {
  const supabase = getSupabaseServer();

  const { data: job, error: queueError } = await supabase
    .from("sms_jobs")
    .insert({
      booking_id: bookingId,
      recipient: phone,
      message,
      deduplication_key: `booking:${bookingId}:registration`,
      status: "pending",
    })
    .select("id")
    .single();

  if (queueError || !job) {
    console.error("SMS queue failed:", queueError?.code);
    return "failed";
  }

  // Remove accidental spaces around the configuration values.
  const apiKey = process.env.AT_API_KEY?.trim();
  const sender = process.env.AT_SMS_FROM?.trim();

  if (!apiKey || !sender) {
    console.error("Missing AT_API_KEY or AT_SMS_FROM in .env.local.");

    const { error } = await supabase
      .from("sms_jobs")
      .update({
        status: "failed",
        last_error: "Missing sandbox SMS configuration.",
      })
      .eq("id", job.id);

    if (error) {
      console.error("SMS status update failed:", error.code);
    }

    return "failed";
  }

  const { data: claimed, error: claimError } = await supabase
    .from("sms_jobs")
    .update({
      status: "processing",
      attempts: 1,
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) {
    console.error("SMS job could not be claimed:", claimError?.code);
    return "pending";
  }

  let result: SmsResult = "failed";
  let providerMessageId: string | null = null;
  let lastError: string | null = null;

  try {
    const body = new URLSearchParams({
      username: "sandbox",
      to: phone,
      message,
      from: sender,
    });

    const response = await fetch(
      "https://api.sandbox.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      lastError = `SMS API returned HTTP ${response.status}.`;
    } else {
      const payload = (await response.json()) as SmsResponse;
      const recipient = payload.SMSMessageData?.Recipients?.[0];

      if (recipient?.statusCode === 101) {
        result = "accepted";
        providerMessageId = recipient.messageId ?? null;
      } else {
        lastError = recipient
          ? `SMS rejected: ${recipient.status} (${recipient.statusCode}).`
          : "SMS API returned no recipient result.";
      }
    }
  } catch {
    lastError =
      "SMS request did not complete. Delivery is unknown; check Africa's Talking before retrying.";
  }

  const { error: updateError } = await supabase
    .from("sms_jobs")
    .update({
      status: result,
      provider_message_id: providerMessageId,
      last_error: lastError,
    })
    .eq("id", job.id);

  if (updateError) {
    console.error("SMS status update failed:", updateError.code);
  }

  if (lastError) {
    console.error(lastError);
  }

  return result;
}
