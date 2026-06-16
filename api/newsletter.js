const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function createNewsletterHandler(getAdmin = getSupabaseAdmin) {
  return async function newsletterHandler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const action = String(req.body?.action || "").trim().toLowerCase();
    const email = normalizeEmail(req.body?.email);
    const honeypot = String(req.body?.company || "").trim();

    if (!["subscribe", "unsubscribe"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "A valid email address is required" });
    }

    // Silently accept bot submissions without writing to the database.
    if (honeypot) {
      return res.status(200).json({
        ok: true,
        status: action === "subscribe" ? "subscribed" : "unsubscribed"
      });
    }

    try {
      const supabase = getAdmin();
      const { data: subscriber, error: selectError } = await supabase
        .from("email_subscribers")
        .select("id, is_active")
        .eq("email", email)
        .maybeSingle();

      if (selectError) throw selectError;

      if (action === "subscribe") {
        if (subscriber?.is_active) {
          return res.status(200).json({ ok: true, status: "already_subscribed" });
        }

        if (subscriber) {
          const { error: updateError } = await supabase
            .from("email_subscribers")
            .update({
              is_active: true,
              unsubscribed_at: null
            })
            .eq("id", subscriber.id);

          if (updateError) throw updateError;
          return res.status(200).json({ ok: true, status: "subscribed" });
        }

        const { error: insertError } = await supabase
          .from("email_subscribers")
          .insert({
            email,
            is_active: true
          });

        if (insertError?.code === "23505") {
          return res.status(200).json({ ok: true, status: "already_subscribed" });
        }
        if (insertError) throw insertError;

        return res.status(200).json({ ok: true, status: "subscribed" });
      }

      if (!subscriber?.is_active) {
        return res.status(200).json({ ok: true, status: "not_subscribed" });
      }

      const { error: updateError } = await supabase
        .from("email_subscribers")
        .update({
          is_active: false,
          unsubscribed_at: new Date().toISOString()
        })
        .eq("id", subscriber.id);

      if (updateError) throw updateError;

      return res.status(200).json({ ok: true, status: "unsubscribed" });
    } catch (error) {
      console.error("[newsletter] Database error:", error);
      return res.status(500).json({ error: "Newsletter request failed" });
    }
  };
}

module.exports = createNewsletterHandler();
module.exports.createNewsletterHandler = createNewsletterHandler;
module.exports.normalizeEmail = normalizeEmail;
