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
  name: string;
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

  console.log("=== LINE Notification Edge Function Started ===");
  console.log("Request method:", req.method);
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  try {
    // Validate request body
    const body: NotificationRequest = await req.json();
    console.log("Request body received:", JSON.stringify(body, null, 2));

    const { message, channelId, notificationType } = body;

    // Validate message
    if (!message || message.trim().length === 0) {
      console.error("Validation error: Message is empty");
      throw new Error("Message is required and cannot be empty");
    }

    if (message.length > 5000) {
      console.error("Validation error: Message too long");
      throw new Error("Message cannot exceed 5000 characters");
    }

    console.log("Message validated successfully");
    console.log("Message length:", message.length);
    console.log("Channel ID:", channelId || "not provided");
    console.log("Notification type:", notificationType || "not provided");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase credentials");
      throw new Error("Supabase credentials not configured");
    }

    console.log("Supabase client initialized");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Fetch LINE notification settings
    let settings: LineNotificationSettings | null = null;

    if (channelId) {
      console.log("Fetching channel by ID:", channelId);
      const { data, error } = await supabaseClient
        .from("line_notifications")
        .select("*")
        .eq("id", channelId)
        .eq("enabled", true)
        .single();

      if (error) {
        console.error("Database error fetching channel:", error);
        throw new Error(`Channel not found or disabled: ${error.message}`);
      }

      settings = data as LineNotificationSettings;
      console.log("Channel found:", settings.name);
    } else if (notificationType) {
      console.log("Fetching channel by notification type:", notificationType);
      const { data, error } = await supabaseClient
        .from("line_notifications")
        .select("*")
        .eq("notification_type", notificationType)
        .eq("enabled", true)
        .limit(1)
        .single();

      if (error) {
        console.error("Database error fetching by type:", error);
        throw new Error(`No active ${notificationType} channel found: ${error.message}`);
      }

      settings = data as LineNotificationSettings;
      console.log("Channel found:", settings.name);
    } else {
      console.log("Fetching first active channel");
      const { data, error } = await supabaseClient
        .from("line_notifications")
        .select("*")
        .eq("enabled", true)
        .limit(1)
        .single();

      if (error) {
        console.error("Database error fetching first active:", error);
        throw new Error("No active LINE notification channels found");
      }

      settings = data as LineNotificationSettings;
      console.log("Channel found:", settings.name);
    }

    // Validate settings
    if (!settings) {
      console.error("No settings retrieved from database");
      throw new Error("No active LINE notification configuration found");
    }

    if (!settings.channel_access_token || settings.channel_access_token.trim().length === 0) {
      console.error("Channel access token is missing or empty");
      throw new Error("LINE channel access token not configured for this channel");
    }

    console.log("=== Preparing LINE API Request ===");
    console.log("Channel name:", settings.name);
    console.log("Notification type:", settings.notification_type);
    console.log("Access token length:", settings.channel_access_token.length);

    // Prepare LINE API request
    let lineApiUrl: string;
    let linePayload: any;

    if (settings.notification_type === "group") {
      // Send to specific LINE group
      if (!settings.group_id || settings.group_id.trim().length === 0) {
        console.error("Group ID is missing for group notification");
        throw new Error("Group ID not configured for this channel");
      }

      console.log("Using push API for group message");
      console.log("Target group ID:", settings.group_id);

      lineApiUrl = "https://api.line.me/v2/bot/message/push";
      linePayload = {
        to: settings.group_id,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    } else if (settings.notification_type === "broadcast") {
      console.log("Using broadcast API");

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
      console.error("Invalid notification type:", settings.notification_type);
      throw new Error(`Unsupported notification type: ${settings.notification_type}`);
    }

    console.log("LINE API URL:", lineApiUrl);
    console.log("Payload:", JSON.stringify(linePayload, null, 2));

    // Send LINE notification
    console.log("=== Sending to LINE API ===");
    const lineResponse = await fetch(lineApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.channel_access_token}`,
      },
      body: JSON.stringify(linePayload),
    });

    console.log("LINE API response status:", lineResponse.status);
    console.log("LINE API response status text:", lineResponse.statusText);

    // Handle LINE API response
    if (!lineResponse.ok) {
      const errorText = await lineResponse.text();
      console.error("LINE API error response:", {
        status: lineResponse.status,
        statusText: lineResponse.statusText,
        body: errorText,
      });

      // Parse LINE error if possible
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorText;
        console.error("Parsed LINE error:", errorJson);
      } catch (e) {
        console.log("Could not parse error as JSON");
      }

      throw new Error(`LINE API error (${lineResponse.status}): ${errorMessage}`);
    }

    const responseData = await lineResponse.json().catch(() => ({}));
    console.log("LINE notification sent successfully!");
    console.log("LINE response data:", responseData);

    // Log notification to database (with error handling)
    try {
      console.log("Attempting to log notification to database");
      const { error: logError } = await supabaseClient.from("notification_logs").insert({
        channel_id: settings.id,
        message: message,
        notification_type: settings.notification_type,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      if (logError) {
        // Don't throw error, just log warning
        console.warn("Failed to log notification (non-critical):", logError);
        console.warn("This might be because notification_logs table doesn't exist");
      } else {
        console.log("Notification logged successfully");
      }
    } catch (logError) {
      console.warn("Exception while logging notification:", logError);
    }

    console.log("=== Success! Returning response ===");
    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification sent successfully",
        channelName: settings.name,
        notificationType: settings.notification_type,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("=== ERROR in Edge Function ===");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    const errorMessage = error.message || "An unexpected error occurred";
    const isNotFound =
      errorMessage.includes("not found") ||
      errorMessage.includes("not configured") ||
      errorMessage.includes("No active");

    const isValidationError =
      errorMessage.includes("required") ||
      errorMessage.includes("cannot be empty") ||
      errorMessage.includes("cannot exceed");

    const statusCode = isNotFound ? 404 : isValidationError ? 400 : 500;

    console.log("Returning error response with status:", statusCode);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false,
        timestamp: new Date().toISOString(),
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
