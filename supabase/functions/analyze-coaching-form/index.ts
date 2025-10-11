import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_REQUEST_TIMEOUT = 60000; // 60 seconds
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface AnalyzeRequest {
  fileUrl: string;
  sessionId?: string;
}

interface CoachingAnalysis {
  studentName?: string;
  date?: string;
  topics?: string[];
  summary?: string;
  recommendations?: string[];
  rawAnalysis: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header is required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase configuration is missing");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user authentication
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Authentication error:", userError);
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate request body
    const body: AnalyzeRequest = await req.json();
    const { fileUrl, sessionId } = body;

    if (!fileUrl || typeof fileUrl !== "string") {
      return new Response(JSON.stringify({ error: "fileUrl is required and must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid file URL format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`User ${user.id} requesting analysis for file: ${fileUrl}`);

    // Validate user owns the file
    const { data: session, error: sessionError } = await supabaseClient
      .from("coaching_sessions")
      .select("id, student_id, coach_id, file_url")
      .eq("file_url", fileUrl)
      .maybeSingle();

    if (sessionError) {
      console.error("Database error:", sessionError);
      throw new Error("Failed to verify file ownership");
    }

    if (!session) {
      return new Response(JSON.stringify({ error: "Coaching session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is the student or coach
    const isAuthorized = session.student_id === user.id || session.coach_id === user.id;

    if (!isAuthorized) {
      console.warn(`Unauthorized access attempt by user ${user.id} for session ${session.id}`);
      return new Response(JSON.stringify({ error: "You do not have permission to access this file" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file content
    console.log("Downloading file content...");
    const fileResponse = await fetch(fileUrl, {
      signal: AbortSignal.timeout(30000), // 30 second timeout for download
    });

    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`);
    }

    const contentType = fileResponse.headers.get("content-type") || "";
    const contentLength = parseInt(fileResponse.headers.get("content-length") || "0");

    if (contentLength > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Process file based on type
    let fileContent: string;

    if (contentType.includes("text") || contentType.includes("json")) {
      fileContent = await fileResponse.text();
    } else if (contentType.includes("pdf")) {
      // For PDF, we'll send the URL and let the AI handle it, or implement PDF parsing
      fileContent = `[PDF Document at ${fileUrl}]`;
      console.log("PDF file detected - AI will need to handle PDF parsing");
    } else if (contentType.includes("image")) {
      // For images, we can use base64 encoding
      const arrayBuffer = await fileResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      fileContent = `[Image data - base64 encoded, content-type: ${contentType}]`;
      console.log("Image file detected");
    } else {
      fileContent = await fileResponse.text();
    }

    // Check Lovable API key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Sending request to AI gateway...");

    // Create AI request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT);

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `คุณเป็น AI ผู้ช่วยวิเคราะห์เอกสาร Coaching Form 
              
กรุณาวิเคราะห์และสกัดข้อมูลต่อไปนี้:
1. ชื่อนักศึกษา
2. วันที่
3. หัวข้อที่ปรึกษา (Topics)
4. บทสรุป (Summary)
5. ข้อเสนอแนะ (Recommendations)

กรุณาตอบกลับในรูปแบบ JSON ดังนี้:
{
  "studentName": "ชื่อนักศึกษา",
  "date": "วันที่ในรูปแบบ YYYY-MM-DD",
  "topics": ["หัวข้อ 1", "หัวข้อ 2"],
  "summary": "สรุปการ coaching",
  "recommendations": ["ข้อเสนอแนะ 1", "ข้อเสนอแนะ 2"]
}`,
            },
            {
              role: "user",
              content: `กรุณาวิเคราะห์เอกสาร Coaching Form ต่อไปนี้:\n\n${fileContent.substring(0, 8000)}`, // Limit content size
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      clearTimeout(timeoutId);

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errorText);
        throw new Error(`AI gateway returned status ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();

      if (!aiData.choices || aiData.choices.length === 0) {
        throw new Error("No response from AI gateway");
      }

      const analysisText = aiData.choices[0].message.content;
      console.log("AI analysis received");

      // Try to parse JSON response
      let analysis: CoachingAnalysis;
      try {
        const parsedJson = JSON.parse(analysisText);
        analysis = {
          ...parsedJson,
          rawAnalysis: analysisText,
        };
      } catch {
        // If not JSON, use raw text
        analysis = {
          rawAnalysis: analysisText,
        };
      }

      // Save analysis to database
      const { error: insertError } = await supabaseClient
        .from("coaching_analysis")
        .insert({
          session_id: session.id,
          analyzed_by: user.id,
          analysis_result: analysis,
          analyzed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.warn("Failed to save analysis to database:", insertError);
        // Continue anyway, don't fail the request
      }

      return new Response(
        JSON.stringify({
          success: true,
          analysis,
          sessionId: session.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (aiError: any) {
      clearTimeout(timeoutId);

      if (aiError.name === "AbortError") {
        throw new Error("AI request timeout - please try again");
      }
      throw aiError;
    }
  } catch (error: any) {
    console.error("Error in analyze-coaching-document:", error);

    let statusCode = 500;
    let errorMessage = "An unexpected error occurred";

    if (error.message.includes("timeout")) {
      statusCode = 504;
      errorMessage = error.message;
    } else if (error.message.includes("not configured")) {
      statusCode = 500;
      errorMessage = "Service configuration error";
    } else if (error.message.includes("download")) {
      statusCode = 502;
      errorMessage = "Failed to download file";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false,
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
