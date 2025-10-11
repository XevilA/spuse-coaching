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

interface LineNotificationSettings {
  id: string;
  channel_access_token: string;
  notification_type: "group" | "broadcast";
  group_id?: string;
  enabled: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request body
    const body: NotificationRequest = await req.json();
    const { message, channelId, notificationType } = body;

    if (!message || message.trim().length === 0) {
      throw new Error("Message is required and cannot be empty");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Build query for LINE notification settings
    let query = supabaseClient.from("line_notifications").select("*").eq("enabled", true);

    if (channelId) {
      query = query.eq("id", channelId);
    } else if (notificationType) {
      query = query.eq("notification_type", notificationType);
    } else {
      // Default to first active notification if no filter specified
      console.log("No channelId or notificationType specified, using first active notification");
    }

    // Execute query
    const { data: settings, error: dbError } = await query.limit(1).maybeSingle();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Failed to fetch LINE notification settings: ${dbError.message}`);
    }

    if (!settings) {
      throw new Error("No active LINE notification configuration found");
    }

    const typedSettings = settings as LineNotificationSettings;

    if (!typedSettings.channel_access_token) {
      throw new Error("LINE channel access token not configured");
    }

    console.log(`Sending LINE notification via ${typedSettings.notification_type} channel`);

    // Prepare LINE API request
    let lineApiUrl: string;
    let linePayload: any;

    if (typedSettings.notification_type === "group") {
      // Send to specific LINE group
      if (!typedSettings.group_id) {
        throw new Error("Group ID not configured for group notification");
      }

      lineApiUrl = "https://api.line.me/v2/bot/message/push";
      linePayload = {
        to: typedSettings.group_id,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    } else if (typedSettings.notification_type === "broadcast") {
      // Send broadcast message to all followers
      lineApiUrl = "https://api.line.me/v2/bot/message/broadcast";
      linePayload = {
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    } else {
      throw new Error(`Unsupported notification type: ${typedSettings.notification_type}`);
    }

    // Send LINE notification
    const lineResponse = await fetch(lineApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${typedSettings.channel_access_token}`,
      },
      body: JSON.stringify(linePayload),
    });

    // Handle LINE API response
    if (!lineResponse.ok) {
      const errorText = await lineResponse.text();
      console.error("LINE API error:", {
        status: lineResponse.status,
        statusText: lineResponse.statusText,
        body: errorText,
      });
      throw new Error(`LINE API error (${lineResponse.status}): ${errorText}`);
    }

    const responseData = await lineResponse.json().catch(() => ({}));
    console.log("LINE notification sent successfully:", responseData);

    // Log notification to database (optional)
    await supabaseClient
      .from("notification_logs")
      .insert({
        channel_id: typedSettings.id,
        message: message,
        notification_type: typedSettings.notification_type,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .catch((err) => {
        console.warn("Failed to log notification:", err);
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification sent successfully",
        notificationType: typedSettings.notification_type,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error sending LINE notification:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "An unexpected error occurred",
        success: false,
      }),
      {
        status: error.message.includes("not configured") || error.message.includes("not found") ? 404 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
