import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  message: string;
  channelId?: string;
  notificationType?: "group" | "broadcast";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, channelId, notificationType }: NotificationRequest = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get LINE notification settings
    let query = supabaseClient
      .from("line_notifications")
      .select("*")
      .eq("enabled", true);

    if (channelId) {
      query = query.eq("id", channelId);
    } else if (notificationType) {
      query = query.eq("notification_type", notificationType);
    }

    const { data: settings } = await query.single();

    if (!settings || !settings.channel_access_token) {
      throw new Error("LINE notification not configured");
    }

    // Send LINE notification
    let lineResponse;
    if (notificationType === "group" && settings.group_id) {
      // Send to LINE group
      lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.channel_access_token}`,
        },
        body: JSON.stringify({
          to: settings.group_id,
          messages: [
            {
              type: "text",
              text: message,
            },
          ],
        }),
      });
    } else if (notificationType === "broadcast") {
      // Send broadcast message
      lineResponse = await fetch("https://api.line.me/v2/bot/message/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.channel_access_token}`,
        },
        body: JSON.stringify({
          messages: [
            {
              type: "text",
              text: message,
            },
          ],
        }),
      });
    }

    if (!lineResponse || !lineResponse.ok) {
      const errorText = await lineResponse?.text();
      console.error("LINE API error:", errorText);
      throw new Error("Failed to send LINE notification");
    }

    console.log("LINE notification sent successfully");

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
