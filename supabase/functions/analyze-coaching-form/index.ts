import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_REQUEST_TIMEOUT = 90000; // 90 seconds (increased)
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB (increased)
const MAX_RETRIES = 2;

interface AnalyzeRequest {
  fileUrl: string;
  sessionId?: string;
  analysisType?: "quick" | "detailed";
}

interface CoachingAnalysis {
  studentName?: string;
  studentId?: string;
  date?: string;
  sessionNumber?: number;
  topics?: string[];
  issues?: string[];
  goals?: string[];
  actionPlans?: string[];
  progress?: string;
  summary?: string;
  recommendations?: string[];
  strengths?: string[];
  areasForImprovement?: string[];
  nextSessionPlans?: string[];
  teacherNotes?: string;
  sentiment?: "positive" | "neutral" | "concerning";
  rawAnalysis: string;
}

/**
 * Download file with retry mechanism
 */
async function downloadFile(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Downloading file (attempt ${attempt}/${retries})...`);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error: any) {
      console.error(`Download attempt ${attempt} failed:`, error.message);

      if (attempt === retries) {
        throw new Error(`Failed to download file after ${retries} attempts: ${error.message}`);
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new Error("Download failed");
}

/**
 * Extract text from PDF (basic implementation)
 * For production, consider using a PDF parsing library
 */
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // This is a placeholder - in production, you'd use a proper PDF parser
    // For now, we'll indicate it's a PDF and let AI handle it
    const uint8Array = new Uint8Array(arrayBuffer);
    const text = new TextDecoder().decode(uint8Array);

    // Try to extract visible text (very basic)
    const textMatch = text.match(/\((.*?)\)/g);
    if (textMatch) {
      return textMatch.map((m) => m.slice(1, -1)).join(" ");
    }

    return "[PDF content - automated text extraction may be limited]";
  } catch (error) {
    console.error("PDF extraction error:", error);
    return "[PDF content - unable to extract text]";
  }
}

/**
 * Call AI with retry mechanism
 */
async function analyzeWithAI(
  content: string,
  apiKey: string,
  analysisType: "quick" | "detailed" = "detailed",
  retries = MAX_RETRIES,
): Promise<any> {
  const systemPrompt =
    analysisType === "quick"
      ? `คุณเป็น AI ผู้ช่วยวิเคราะห์เอกสาร Coaching Form แบบรวดเร็ว

กรุณาวิเคราะห์และสกัดข้อมูลหลักต่อไปนี้:
1. ชื่อนักศึกษา (studentName)
2. รหัสนักศึกษา (studentId)
3. วันที่ (date ในรูปแบบ YYYY-MM-DD)
4. ครั้งที่ (sessionNumber)
5. หัวข้อที่ปรึกษา (topics - array)
6. สรุปสั้นๆ (summary - 2-3 ประโยค)

ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น`
      : `คุณเป็น AI ผู้ช่วยวิเคราะห์เอกสาร Coaching Form อย่างละเอียด

กรุณาวิเคราะห์และสกัดข้อมูลครบถ้วนต่อไปนี้:

**ข้อมูลพื้นฐาน:**
1. studentName: ชื่อ-นามสกุลนักศึกษา
2. studentId: รหัสนักศึกษา
3. date: วันที่ในรูปแบบ YYYY-MM-DD
4. sessionNumber: ครั้งที่ (เป็นตัวเลข)

**เนื้อหาการ Coaching:**
5. topics: หัวข้อที่ปรึกษาทั้งหมด (array of strings)
6. issues: ปัญหาหรือความท้าทายที่พบ (array of strings)
7. goals: เป้าหมายที่ตั้งไว้ (array of strings)
8. actionPlans: แผนการปฏิบัติ (array of strings)
9. progress: ความคืบหน้าจากครั้งก่อน (string)

**การประเมินและสรุป:**
10. summary: สรุปการ coaching โดยรวม (3-5 ประโยค)
11. recommendations: ข้อเสนอแนะสำหรับนักศึกษา (array of strings)
12. strengths: จุดแข็งของนักศึกษา (array of strings)
13. areasForImprovement: จุดที่ควรพัฒนา (array of strings)
14. nextSessionPlans: แผนสำหรับครั้งถัดไป (array of strings)
15. teacherNotes: บันทึกเพิ่มเติมจากอาจารย์ (string)
16. sentiment: ประเมินอารมณ์โดยรวม ("positive", "neutral", หรือ "concerning")

**หมายเหตุ:**
- ถ้าไม่พบข้อมูลใด ให้ใส่ null หรือ [] (สำหรับ array)
- วิเคราะห์อย่างละเอียดและครบถ้วน
- ระบุข้อมูลตามที่เห็นในเอกสารเท่านั้น ไม่ต้องสมมติ

ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น`;

  const userPrompt = `กรุณาวิเคราะห์เอกสาร Coaching Form ต่อไปนี้อย่างละเอียด:

${content.substring(0, 10000)}

${content.length > 10000 ? "\n[เอกสารยาว - แสดงเฉพาะส่วนต้น]\n" : ""}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT);

    try {
      console.log(`AI analysis attempt ${attempt}/${retries}...`);

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-exp",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.2,
          max_tokens: analysisType === "quick" ? 1000 : 3000,
          response_format: { type: "json_object" },
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

      return aiData;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`AI attempt ${attempt} failed:`, error.message);

      if (attempt === retries) {
        if (error.name === "AbortError") {
          throw new Error("AI request timeout - the document may be too long. Please try again.");
        }
        throw error;
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }

  throw new Error("AI analysis failed");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log("=== Analyze Coaching Document Request Started ===");

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("Missing authorization header");
      return new Response(
        JSON.stringify({
          error: "Authorization header is required",
          code: "AUTH_REQUIRED",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration");
      throw new Error("Service configuration error");
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
      console.error("Authentication error:", userError?.message);
      return new Response(
        JSON.stringify({
          error: "Invalid authentication token",
          code: "AUTH_INVALID",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`User authenticated: ${user.id}`);

    // Parse and validate request body
    const body: AnalyzeRequest = await req.json();
    const { fileUrl, sessionId, analysisType = "detailed" } = body;

    if (!fileUrl || typeof fileUrl !== "string") {
      return new Response(
        JSON.stringify({
          error: "fileUrl is required and must be a string",
          code: "INVALID_INPUT",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Invalid file URL format",
          code: "INVALID_URL",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Analyzing file: ${fileUrl}`);
    console.log(`Analysis type: ${analysisType}`);

    // Validate user owns the file
    const { data: session, error: sessionError } = await supabaseClient
      .from("coaching_sessions")
      .select("id, student_id, coach_id, file_url, session_number")
      .eq("file_url", fileUrl)
      .maybeSingle();

    if (sessionError) {
      console.error("Database error:", sessionError);
      throw new Error("Failed to verify file ownership");
    }

    if (!session) {
      return new Response(
        JSON.stringify({
          error: "Coaching session not found for this file",
          code: "SESSION_NOT_FOUND",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if user is the student or coach
    const isAuthorized = session.student_id === user.id || session.coach_id === user.id;

    if (!isAuthorized) {
      console.warn(`Unauthorized access attempt by user ${user.id} for session ${session.id}`);
      return new Response(
        JSON.stringify({
          error: "You do not have permission to access this file",
          code: "UNAUTHORIZED",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Authorization verified for session: ${session.id}`);

    // Check if analysis already exists (optional cache)
    const { data: existingAnalysis } = await supabaseClient
      .from("coaching_analysis")
      .select("*")
      .eq("session_id", session.id)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAnalysis) {
      console.log("Found existing analysis, returning cached result");
      return new Response(
        JSON.stringify({
          success: true,
          analysis: existingAnalysis.analysis_result,
          sessionId: session.id,
          cached: true,
          analyzedAt: existingAnalysis.analyzed_at,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Download file content
    console.log("Downloading file...");
    const fileResponse = await downloadFile(fileUrl);

    const contentType = fileResponse.headers.get("content-type") || "";
    const contentLength = parseInt(fileResponse.headers.get("content-length") || "0");

    console.log(`File info - Type: ${contentType}, Size: ${contentLength} bytes`);

    if (contentLength > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `File size (${(contentLength / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          code: "FILE_TOO_LARGE",
        }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Process file based on type
    let fileContent: string;
    let fileInfo = {
      type: contentType,
      size: contentLength,
      extracted: false,
    };

    if (contentType.includes("text") || contentType.includes("json")) {
      console.log("Processing text file...");
      fileContent = await fileResponse.text();
      fileInfo.extracted = true;
    } else if (contentType.includes("pdf") || contentType.includes("application/pdf")) {
      console.log("Processing PDF file...");
      const arrayBuffer = await fileResponse.arrayBuffer();
      fileContent = await extractTextFromPDF(arrayBuffer);
      fileInfo.extracted = true;
      console.log(`PDF text extraction: ${fileContent.length} characters`);
    } else if (contentType.includes("image")) {
      console.log("Processing image file...");
      // For images, we'll indicate it's an image
      // In production, you could use OCR or image analysis
      fileContent = `[Image file - automated text extraction not available. Content-Type: ${contentType}]`;
      fileInfo.extracted = false;
    } else if (contentType.includes("word") || contentType.includes("msword") || contentType.includes("document")) {
      console.log("Processing Word document...");
      // Word documents need special handling
      fileContent = `[Word document - automated text extraction may be limited. Content-Type: ${contentType}]`;
      fileInfo.extracted = false;
    } else {
      console.log("Processing unknown file type...");
      try {
        fileContent = await fileResponse.text();
        fileInfo.extracted = true;
      } catch {
        fileContent = `[Unknown file type - Content-Type: ${contentType}]`;
        fileInfo.extracted = false;
      }
    }

    console.log(`Content extracted: ${fileContent.length} characters`);

    // Check Lovable API key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    // Analyze with AI
    console.log("Starting AI analysis...");
    const aiData = await analyzeWithAI(fileContent, LOVABLE_API_KEY, analysisType);

    const analysisText = aiData.choices[0].message.content;
    console.log("AI analysis received successfully");

    // Parse JSON response
    let analysis: CoachingAnalysis;
    try {
      const parsedJson = JSON.parse(analysisText);
      analysis = {
        ...parsedJson,
        rawAnalysis: analysisText,
      };
      console.log("Analysis parsed successfully");
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      // If not JSON, use raw text
      analysis = {
        summary: analysisText,
        rawAnalysis: analysisText,
      };
    }

    // Add metadata
    const analysisWithMetadata = {
      ...analysis,
      _metadata: {
        fileInfo,
        analysisType,
        model: "google/gemini-2.0-flash-exp",
        sessionNumber: session.session_number,
        processingTime: Date.now() - startTime,
      },
    };

    // Save analysis to database
    console.log("Saving analysis to database...");
    const { data: savedAnalysis, error: insertError } = await supabaseClient
      .from("coaching_analysis")
      .insert({
        session_id: session.id,
        analyzed_by: user.id,
        analysis_result: analysisWithMetadata,
        analyzed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.warn("Failed to save analysis to database:", insertError);
      // Continue anyway, don't fail the request
    } else {
      console.log("Analysis saved successfully");
    }

    const processingTime = Date.now() - startTime;
    console.log(`=== Request completed in ${processingTime}ms ===`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysisWithMetadata,
        sessionId: session.id,
        cached: false,
        processingTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("=== Error in analyze-coaching-document ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);

    let statusCode = 500;
    let errorMessage = "An unexpected error occurred";
    let errorCode = "INTERNAL_ERROR";

    if (error.message.includes("timeout")) {
      statusCode = 504;
      errorMessage = "Request timeout - the document may be too long or the service is busy";
      errorCode = "TIMEOUT";
    } else if (error.message.includes("not configured")) {
      statusCode = 503;
      errorMessage = "Service temporarily unavailable";
      errorCode = "SERVICE_UNAVAILABLE";
    } else if (error.message.includes("download")) {
      statusCode = 502;
      errorMessage = "Failed to download file - the file may be corrupted or inaccessible";
      errorCode = "DOWNLOAD_FAILED";
    } else if (error.message.includes("AI") || error.message.includes("gateway")) {
      statusCode = 503;
      errorMessage = "AI service temporarily unavailable - please try again";
      errorCode = "AI_SERVICE_ERROR";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        code: errorCode,
        success: false,
        processingTime,
        details: Deno.env.get("ENVIRONMENT") === "development" ? error.stack : undefined,
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
