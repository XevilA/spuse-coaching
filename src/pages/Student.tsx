import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileCheck, Download, RefreshCw, AlertCircle, Users as UsersIcon, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StudentGroupSelector } from "@/components/StudentGroupSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentManager } from "@/components/AppointmentManager";

// 🛡️ Security: Rate Limiter Class
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private limit: number;
  private windowMs: number;

  constructor(limit: number = 10, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Clean old requests
    const validRequests = requests.filter((time) => now - time < this.windowMs);

    if (validRequests.length >= this.limit) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }

  getRemainingTime(key: string): number {
    const requests = this.requests.get(key) || [];
    if (requests.length === 0) return 0;

    const oldestRequest = requests[0];
    const timeLeft = this.windowMs - (Date.now() - oldestRequest);
    return Math.max(0, Math.ceil(timeLeft / 1000));
  }
}

// 🛡️ Anti-Many-Request: Debounce Function
function useDebounce<T extends (...args: any[]) => any>(callback: T, delay: number): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );
}

// 🛡️ Security: Input Sanitization
const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, "") // Remove < and >
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
};

// 🛡️ Security: File Validation
const validateFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ["application/pdf"];

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "กรุณาอัปโหลดไฟล์ PDF เท่านั้น" };
  }

  if (file.size > maxSize) {
    return { valid: false, error: "ไฟล์มีขนาดเกิน 10MB" };
  }

  return { valid: true };
};

// Rate limiters
const fetchRateLimiter = new RateLimiter(20, 60000); // 20 requests per minute
const uploadRateLimiter = new RateLimiter(5, 60000); // 5 uploads per minute

export default function Student() {
  // State Management
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [requiredSessions, setRequiredSessions] = useState(3);
  const [sessionNumber, setSessionNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [submissionType, setSubmissionType] = useState<"individual" | "group">("individual");
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  
  // First-time setup states
  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);
  const [setupStep, setSetupStep] = useState<"role" | "create-group" | "add-members">("role");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupData, setNewGroupData] = useState({
    name: "",
    year_level: "",
    major: ""
  });
  const [memberEmails, setMemberEmails] = useState<string[]>(["", "", ""]);
  const [addingMembers, setAddingMembers] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Refs for cleanup
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 🚀 Performance: Memoized computed values
  const completedSessions = useMemo(() => sessions.filter((s) => s.status === "approved").length, [sessions]);

  const progressPercentage = useMemo(
    () => (completedSessions / requiredSessions) * 100,
    [completedSessions, requiredSessions],
  );

  const userName = useMemo(() => (profile ? `${profile.first_name} ${profile.last_name}` : ""), [profile]);

  // 🛡️ Security: Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 🚀 Performance: Optimized Auth Check
  const checkAuth = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roleError) throw roleError;

      if (roleData?.role !== "student") {
        navigate(`/${roleData?.role || "auth"}`);
        return;
      }

      if (mountedRef.current) {
        setUser(session.user);
        await fetchData(session.user.id);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถตรวจสอบสิทธิ์ได้",
      });
      navigate("/auth");
    }
  }, [navigate, toast]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 🚀 Performance: Optimized Realtime Subscriptions
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`student-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coaching_sessions",
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          if (mountedRef.current) {
            debouncedFetchData(user.id);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          if (mountedRef.current) {
            debouncedFetchData(user.id);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          if (mountedRef.current) {
            debouncedFetchData(user.id);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
        },
        () => {
          if (mountedRef.current) {
            debouncedFetchTeachers();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // 🚀 Performance: Optimized Data Fetching with Cache
  const fetchData = useCallback(
    async (userId: string) => {
      // Rate limiting check
      if (!fetchRateLimiter.canMakeRequest(`fetch-${userId}`)) {
        const waitTime = fetchRateLimiter.getRemainingTime(`fetch-${userId}`);
        setRateLimitError(`กรุณารอ ${waitTime} วินาทีก่อนโหลดข้อมูลอีกครั้ง`);
        return;
      }

      setRateLimitError(null);

      try {
        // Create abort controller for this request
        abortControllerRef.current = new AbortController();

        const [profileRes, sessionsRes, settingsRes, groupsRes, leaderRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          supabase
            .from("coaching_sessions")
            .select("*")
            .eq("student_id", userId)
            .order("created_at", { ascending: false }),
          supabase.from("coaching_settings").select("*").eq("key", "min_sessions").single(),
          supabase.from("student_groups").select("*").order("name"),
          supabase.from("group_members").select("is_leader, group_id").eq("student_id", userId).maybeSingle(),
        ]);

        if (!mountedRef.current) return;

        // Handle profile
        if (profileRes.data) {
          setProfile(profileRes.data);
          setSelectedGroup(profileRes.data.group_id || "");
        } else if (profileRes.error) {
          throw profileRes.error;
        }

        // Handle sessions
        if (sessionsRes.data) {
          setSessions(sessionsRes.data);
        } else if (sessionsRes.error) {
          console.error("Sessions error:", sessionsRes.error);
        }

        // Handle settings
        if (settingsRes.data) {
          const minSessions = parseInt(settingsRes.data.value);
          if (!isNaN(minSessions) && minSessions > 0) {
            setRequiredSessions(minSessions);
          }
        }

        // Handle groups
        if (groupsRes.data) {
          setGroups(groupsRes.data);
        }

        // Handle leader status
        if (leaderRes.data) {
          setIsLeader(leaderRes.data.is_leader || false);
        }
        
        // Check if this is first-time user without a group
        if (profileRes.data && !profileRes.data.group_id && !leaderRes.data?.group_id) {
          setShowFirstTimeSetup(true);
        }

        // Fetch required sessions from teacher assignment if available
        if (profileRes.data?.group_id || leaderRes.data?.group_id) {
          const groupId = profileRes.data?.group_id || leaderRes.data?.group_id;
          const { data: assignmentData } = await supabase
            .from("teacher_assignments")
            .select("required_sessions")
            .eq("group_id", groupId)
            .maybeSingle();
          
          if (assignmentData && assignmentData.required_sessions) {
            setRequiredSessions(assignmentData.required_sessions);
          } else if (settingsRes.data) {
            // Fallback to system default
            const minSessions = parseInt(settingsRes.data.value);
            if (!isNaN(minSessions) && minSessions > 0) {
              setRequiredSessions(minSessions);
            }
          }
        } else if (settingsRes.data) {
          // Use system default if no group
          const minSessions = parseInt(settingsRes.data.value);
          if (!isNaN(minSessions) && minSessions > 0) {
            setRequiredSessions(minSessions);
          }
        }

        // Fetch teachers
        await fetchTeachers();
      } catch (error: any) {
        if (error.name === "AbortError") return;

        console.error("Error fetching data:", error);

        if (mountedRef.current) {
          toast({
            variant: "destructive",
            title: "เกิดข้อผิดพลาด",
            description: error.message || "ไม่สามารถโหลดข้อมูลได้",
          });
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [toast],
  );

  // 🛡️ Anti-Many-Request: Debounced fetch
  const debouncedFetchData = useDebounce(fetchData, 500);

  // 🚀 Performance: Optimized Teacher Fetching with Error Handling
  const fetchTeachers = useCallback(async () => {
    if (isLoadingTeachers) return; // Prevent concurrent requests

    setIsLoadingTeachers(true);
    setTeacherError(null);

    try {
      console.log("🔍 Fetching teachers...");

      // Step 1: Get teacher IDs from user_roles
      const { data: teacherRoles, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "teacher");

      if (roleError) {
        console.error("❌ Role query error:", roleError);
        throw new Error(`ไม่สามารถค้นหา user_roles: ${roleError.message}`);
      }

      console.log("👥 Teacher roles found:", teacherRoles?.length || 0);

      if (!teacherRoles || teacherRoles.length === 0) {
        setTeacherError("ไม่พบข้อมูลอาจารย์ในระบบ");
        setAvailableTeachers([]);
        return;
      }

      const teacherIds = teacherRoles.map((r) => r.user_id);
      console.log("🆔 Teacher IDs:", teacherIds);

      // Step 2: Get teacher profiles
      const { data: teacherProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", teacherIds);

      if (profileError) {
        console.error("❌ Profile query error:", profileError);
        throw new Error(`ไม่สามารถค้นหา profiles: ${profileError.message}`);
      }

      console.log("📋 Teacher profiles found:", teacherProfiles?.length || 0);

      if (!teacherProfiles || teacherProfiles.length === 0) {
        setTeacherError("ไม่พบข้อมูลโปรไฟล์อาจารย์");
        setAvailableTeachers([]);
        return;
      }

      // Filter out incomplete profiles
      const validTeachers = teacherProfiles.filter((t) => t.first_name && t.last_name);

      if (validTeachers.length === 0) {
        setTeacherError("ข้อมูลอาจารย์ไม่สมบูรณ์");
        setAvailableTeachers([]);
        return;
      }

      if (mountedRef.current) {
        setAvailableTeachers(validTeachers);
        console.log("✅ Teachers loaded successfully:", validTeachers.length);
      }
    } catch (error: any) {
      console.error("💥 Error fetching teachers:", error);

      if (mountedRef.current) {
        const errorMessage = error.message || "ไม่สามารถโหลดรายชื่ออาจารย์ได้";
        setTeacherError(errorMessage);

        toast({
          variant: "destructive",
          title: "เกิดข้อผิดพลาด",
          description: errorMessage,
        });
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingTeachers(false);
      }
    }
  }, [isLoadingTeachers, toast]);

  // 🛡️ Anti-Many-Request: Debounced teacher fetch
  const debouncedFetchTeachers = useDebounce(fetchTeachers, 500);

  // 🚀 Performance: Optimized Group Save
  const handleSaveGroup = useCallback(
    async (groupId: string) => {
      if (!user) return;

      setIsSavingProfile(true);

      try {
        const { error: profileError } = await supabase.from("profiles").update({ group_id: groupId }).eq("id", user.id);

        if (profileError) throw profileError;

        // Add to group_members table
        const { error: memberError } = await supabase
          .from("group_members")
          .upsert({ student_id: user.id, group_id: groupId }, { onConflict: "student_id", ignoreDuplicates: false });

        if (memberError) {
          console.error("Group member error:", memberError);
        }

        if (mountedRef.current) {
          setSelectedGroup(groupId);
          setProfile((prev: any) => ({ ...prev, group_id: groupId }));
          setSelectedTeacher("");

          toast({
            title: "บันทึกสำเร็จ",
            description: "บันทึกกลุ่มเรียนของคุณแล้ว",
          });
        }
      } catch (error: any) {
        console.error("Save group error:", error);

        if (mountedRef.current) {
          toast({
            variant: "destructive",
            title: "เกิดข้อผิดพลาด",
            description: error.message,
          });
        }
      } finally {
        if (mountedRef.current) {
          setIsSavingProfile(false);
        }
      }
    },
    [user, toast],
  );

  // 🛡️ Security: Enhanced File Upload with Validation
  const handleSubmit = useCallback(async () => {
    // Rate limiting check
    if (!uploadRateLimiter.canMakeRequest(`upload-${user?.id}`)) {
      const waitTime = uploadRateLimiter.getRemainingTime(`upload-${user?.id}`);
      toast({
        variant: "destructive",
        title: "ส่งงานบ่อยเกินไป",
        description: `กรุณารอ ${waitTime} วินาทีก่อนส่งงานอีกครั้ง`,
      });
      return;
    }

    // Validation
    if (!file || !sessionNumber) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลให้ครบ",
        description: "กรุณาเลือกไฟล์และระบุครั้งที่",
      });
      return;
    }

    // Validate file
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      toast({
        variant: "destructive",
        title: "ไฟล์ไม่ถูกต้อง",
        description: fileValidation.error,
      });
      return;
    }

    // Validate session number
    const sessionNum = parseInt(sessionNumber);
    if (isNaN(sessionNum) || sessionNum < 1 || sessionNum > requiredSessions) {
      toast({
        variant: "destructive",
        title: "หมายเลขครั้งที่ไม่ถูกต้อง",
        description: `กรุณาระบุครั้งที่ 1-${requiredSessions}`,
      });
      return;
    }

    if (!selectedTeacher) {
      toast({
        variant: "destructive",
        title: "กรุณาเลือกอาจารย์",
        description: "กรุณาเลือกอาจารย์ที่ปรึกษาก่อนส่งใบ Coaching",
      });
      return;
    }

    if (submissionType === "group") {
      if (!selectedGroup) {
        toast({
          variant: "destructive",
          title: "กรุณาเลือกกลุ่ม",
          description: "กรุณาเลือกกลุ่มเรียนสำหรับการส่งแบบกลุ่ม",
        });
        return;
      }

      if (!isLeader) {
        toast({
          variant: "destructive",
          title: "ไม่มีสิทธิ์",
          description: "เฉพาะหัวหน้ากลุ่มเท่านั้นที่ส่งแบบกลุ่มได้",
        });
        return;
      }
    }

    // Check for duplicate submission
    const isDuplicate = sessions.some(
      (s) =>
        s.session_number === sessionNum &&
        s.status !== "rejected" &&
        ((submissionType === "individual" && !s.group_id) ||
          (submissionType === "group" && s.group_id === selectedGroup)),
    );

    if (isDuplicate) {
      toast({
        variant: "destructive",
        title: "ส่งซ้ำ",
        description: `คุณได้ส่งใบ Coaching ครั้งที่ ${sessionNum} แล้ว`,
      });
      return;
    }

    setIsUploading(true);

    try {
      // Sanitize filename
      const fileExt = file.name.split(".").pop();
      const timestamp = Date.now();
      const sanitizedFileName = `${user.id}/${timestamp}.${fileExt}`;

      console.log("📤 Uploading file:", sanitizedFileName);

      // Upload file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("coaching-forms")
        .upload(sanitizedFileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`ไม่สามารถอัปโหลดไฟล์: ${uploadError.message}`);
      }

      console.log("✅ File uploaded:", uploadData.path);

      // Insert session record
      const sessionData = {
        student_id: user?.id,
        teacher_id: selectedTeacher,
        group_id: submissionType === "group" ? selectedGroup : null,
        session_number: sessionNum,
        file_url: uploadData.path,
        file_name: sanitizeInput(file.name),
        status: "pending" as const,
      };

      console.log("💾 Inserting session:", sessionData);

      const { data: insertedSession, error: sessionError } = await supabase
        .from("coaching_sessions")
        .insert([sessionData])
        .select()
        .single();

      if (sessionError) {
        console.error("Session insert error:", sessionError);

        // Cleanup uploaded file on error
        await supabase.storage.from("coaching-forms").remove([uploadData.path]);

        throw new Error(`ไม่สามารถบันทึกข้อมูล: ${sessionError.message}`);
      }

      console.log("✅ Session created successfully");

      // Send LINE notification to teacher
      if (insertedSession && selectedTeacher) {
        try {
          const teacherProfile = availableTeachers.find((t) => t.id === selectedTeacher);
          const studentName = `${user?.email}`;

          await supabase.functions.invoke("send-line-notification", {
            body: {
              teacherId: selectedTeacher,
              message: `📝 นักศึกษา ${studentName} ส่งใบ Coaching ครั้งที่ ${sessionNum}\n${submissionType === "group" ? "แบบกลุ่ม" : "แบบส่วนตัว"}\nรอการตรวจสอบจากอาจารย์ ${teacherProfile?.first_name} ${teacherProfile?.last_name}`,
              notificationType: "coaching_submission",
            },
          });
        } catch (notifError) {
          console.error("LINE notification error:", notifError);
          // Don't throw error, just log it
        }
      }

      if (mountedRef.current) {
        toast({
          title: "ส่งงานสำเร็จ",
          description: `ส่งใบ Coaching ${submissionType === "individual" ? "แบบส่วนตัว" : "แบบกลุ่ม"} ครั้งที่ ${sessionNum} สำเร็จแล้ว`,
        });

        // Reset form
        setFile(null);
        setSessionNumber("");

        // Refresh data
        if (user?.id) {
          await fetchData(user.id);
        }
      }
    } catch (error: any) {
      console.error("Submit error:", error);

      if (mountedRef.current) {
        toast({
          variant: "destructive",
          title: "เกิดข้อผิดพลาด",
          description: error.message || "ไม่สามารถส่งงานได้",
        });
      }
    } finally {
      if (mountedRef.current) {
        setIsUploading(false);
      }
    }
  }, [
    file,
    sessionNumber,
    selectedTeacher,
    submissionType,
    selectedGroup,
    isLeader,
    user,
    sessions,
    requiredSessions,
    toast,
    fetchData,
  ]);

  // 🚀 Performance: Optimized File Viewer
  const viewFile = useCallback(
    async (fileUrl: string) => {
      try {
        const { data, error } = await supabase.storage.from("coaching-forms").createSignedUrl(fileUrl, 60);

        if (error) throw error;

        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        }
      } catch (error: any) {
        console.error("View file error:", error);
        toast({
          variant: "destructive",
          title: "ไม่สามารถเปิดไฟล์ได้",
          description: error.message,
        });
      }
    },
    [toast],
  );

  const handleCreateGroup = async () => {
    if (!newGroupData.name || !newGroupData.year_level || !newGroupData.major) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลให้ครบถ้วน",
      });
      return;
    }

    setIsCreatingGroup(true);
    try {
      // Create new group
      const { data: newGroup, error: groupError } = await supabase
        .from("student_groups")
        .insert({
          name: sanitizeInput(newGroupData.name),
          year_level: sanitizeInput(newGroupData.year_level),
          major: sanitizeInput(newGroupData.major),
          required_sessions: 10
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add current user as leader
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: newGroup.id,
          student_id: user.id,
          is_leader: true
        });

      if (memberError) throw memberError;

      // Update profile with group_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ group_id: newGroup.id })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast({
        title: "สร้างกลุ่มสำเร็จ",
        description: "คุณได้สร้างกลุ่มและเป็นหัวหน้ากลุ่มแล้ว",
      });

      setSetupStep("add-members");
      setSelectedGroup(newGroup.id);
      setIsLeader(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleAddMembers = async () => {
    const validEmails = memberEmails.filter(email => email.trim() && email.includes("@"));
    
    if (validEmails.length === 0) {
      setShowFirstTimeSetup(false);
      await fetchData(user.id);
      return;
    }

    setAddingMembers(true);
    try {
      const results = await Promise.allSettled(
        validEmails.map(async (email) => {
          // Find user by email
          const { data: memberProfile, error: findError } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email.trim())
            .single();

          if (findError || !memberProfile) {
            throw new Error(`ไม่พบผู้ใช้: ${email}`);
          }

          // Add to group
          const { error: addError } = await supabase
            .from("group_members")
            .insert({
              group_id: selectedGroup,
              student_id: memberProfile.id,
              is_leader: false
            });

          if (addError) throw addError;

          // Update member's profile
          await supabase
            .from("profiles")
            .update({ group_id: selectedGroup })
            .eq("id", memberProfile.id);

          return email;
        })
      );

      const succeeded = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      toast({
        title: succeeded > 0 ? "เพิ่มสมาชิกสำเร็จ" : "เกิดข้อผิดพลาด",
        description: `เพิ่มสมาชิกได้ ${succeeded} คน${failed > 0 ? `, ไม่สำเร็จ ${failed} คน` : ""}`,
        variant: failed > 0 ? "destructive" : "default",
      });

      setShowFirstTimeSetup(false);
      await fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setAddingMembers(false);
    }
  };

  // 🚀 Performance: Memoized status badge
  const getStatusBadge = useCallback((status: string) => {
    const badges = {
      approved: (
        <Badge className="bg-green-500">
          <FileCheck className="w-3 h-3 mr-1" />
          อนุมัติ
        </Badge>
      ),
      rejected: <Badge variant="destructive">ไม่อนุมัติ</Badge>,
      pending: <Badge variant="secondary">รอยืนยัน</Badge>,
    };
    return badges[status as keyof typeof badges] || badges.pending;
  }, []);

  // 🎨 Loading State
  if (isLoading) {
    return (
      <DashboardLayout role="student" userName="">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student" userName={userName} variant="student">
      {/* First-time Setup Dialog */}
      <Dialog open={showFirstTimeSetup} onOpenChange={setShowFirstTimeSetup}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {setupStep === "role" && "ยินดีต้อนรับ! คุณเป็นหัวหน้ากลุ่มหรือไม่?"}
              {setupStep === "create-group" && "สร้างกลุ่มใหม่"}
              {setupStep === "add-members" && "เพิ่มสมาชิกในกลุ่ม"}
            </DialogTitle>
            <DialogDescription>
              {setupStep === "role" && "กรุณาเลือกบทบาทของคุณเพื่อตั้งค่ากลุ่ม Coaching"}
              {setupStep === "create-group" && "กรอกข้อมูลกลุ่มของคุณ"}
              {setupStep === "add-members" && "เพิ่มสมาชิกในกลุ่ม (สามารถเพิ่มได้ทีหลัง)"}
            </DialogDescription>
          </DialogHeader>

          {setupStep === "role" && (
            <div className="grid gap-4 py-4">
              <Button
                onClick={() => setSetupStep("create-group")}
                className="h-24 flex flex-col gap-2"
              >
                <UsersIcon className="w-8 h-8" />
                <span className="text-lg">ฉันเป็นหัวหน้ากลุ่ม</span>
                <span className="text-xs opacity-80">สร้างกลุ่มและเพิ่มสมาชิก</span>
              </Button>
              <Button
                onClick={() => {
                  setShowFirstTimeSetup(false);
                  toast({
                    title: "รอหัวหน้ากลุ่มเพิ่มคุณเข้ากลุ่ม",
                    description: "กรุณาติดต่อหัวหน้ากลุ่มเพื่อเพิ่มคุณเข้ากลุ่ม",
                  });
                }}
                variant="outline"
                className="h-24 flex flex-col gap-2"
              >
                <UserIcon className="w-8 h-8" />
                <span className="text-lg">ฉันเป็นสมาชิกกลุ่ม</span>
                <span className="text-xs opacity-80">รอหัวหน้ากลุ่มเพิ่มเข้ากลุ่ม</span>
              </Button>
            </div>
          )}

          {setupStep === "create-group" && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">ชื่อกลุ่ม</Label>
                <Input
                  id="group-name"
                  placeholder="เช่น กลุ่ม A"
                  value={newGroupData.name}
                  onChange={(e) => setNewGroupData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year-level">ชั้นปี</Label>
                <Select value={newGroupData.year_level} onValueChange={(value) => setNewGroupData(prev => ({ ...prev, year_level: value }))}>
                  <SelectTrigger id="year-level">
                    <SelectValue placeholder="เลือกชั้นปี" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">ปี 1</SelectItem>
                    <SelectItem value="2">ปี 2</SelectItem>
                    <SelectItem value="3">ปี 3</SelectItem>
                    <SelectItem value="4">ปี 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="major">สาขา</Label>
                <Input
                  id="major"
                  placeholder="เช่น วิทยาการคอมพิวเตอร์"
                  value={newGroupData.major}
                  onChange={(e) => setNewGroupData(prev => ({ ...prev, major: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setSetupStep("role")} className="flex-1">
                  ย้อนกลับ
                </Button>
                <Button onClick={handleCreateGroup} disabled={isCreatingGroup} className="flex-1">
                  {isCreatingGroup ? "กำลังสร้าง..." : "สร้างกลุ่ม"}
                </Button>
              </div>
            </div>
          )}

          {setupStep === "add-members" && (
            <div className="grid gap-4 py-4">
              <p className="text-sm text-muted-foreground">
                เพิ่มอีเมล์สมาชิกในกลุ่ม (ต้องใช้อีเมล์ @spumail.net)
              </p>
              {memberEmails.map((email, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`member-${index}`}>สมาชิกคนที่ {index + 1}</Label>
                  <Input
                    id={`member-${index}`}
                    type="email"
                    placeholder="example@spumail.net"
                    value={email}
                    onChange={(e) => {
                      const newEmails = [...memberEmails];
                      newEmails[index] = e.target.value;
                      setMemberEmails(newEmails);
                    }}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => setMemberEmails([...memberEmails, ""])}
                className="w-full"
              >
                + เพิ่มสมาชิก
              </Button>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowFirstTimeSetup(false);
                    fetchData(user.id);
                  }}
                  className="flex-1"
                >
                  ข้ามไปก่อน
                </Button>
                <Button onClick={handleAddMembers} disabled={addingMembers} className="flex-1">
                  {addingMembers ? "กำลังเพิ่ม..." : "เพิ่มสมาชิก"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-6 p-4 sm:p-6">
        {/* Rate Limit Warning */}
        {rateLimitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{rateLimitError}</AlertDescription>
          </Alert>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="coaching" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="coaching">📝 Coaching</TabsTrigger>
            <TabsTrigger value="appointments">📅 นัดหมาย</TabsTrigger>
            <TabsTrigger value="profile">👤 โปรไฟล์</TabsTrigger>
          </TabsList>

          {/* Coaching Tab */}
          <TabsContent value="coaching" className="space-y-6">
            {/* Progress Card */}
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <span className="text-3xl">🎯</span>
                  ความคืบหน้า Coaching
                </CardTitle>
                <CardDescription className="text-lg">
                  {completedSessions}/{requiredSessions} ครั้ง
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progressPercentage} className="h-4" />
                <p className="text-center mt-3 text-lg font-semibold">{Math.round(progressPercentage)}% เสร็จสมบูรณ์</p>
              </CardContent>
            </Card>

            {/* Upload Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">อัปโหลดใบ Coaching</CardTitle>
                <CardDescription>เลือกประเภทการส่งงาน: ส่งแบบส่วนตัว หรือ ส่งแบบกลุ่ม</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
            {/* Submission Type */}
            <div className="space-y-2">
              <Label>ประเภทการส่ง</Label>
              <Select
                value={submissionType}
                onValueChange={(value: "individual" | "group") => setSubmissionType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">ส่งแบบส่วนตัว</SelectItem>
                  <SelectItem value="group" disabled={!isLeader}>
                    ส่งแบบกลุ่ม {!isLeader && "(เฉพาะหัวหน้ากลุ่ม)"}
                  </SelectItem>
                </SelectContent>
              </Select>
              {submissionType === "group" && !isLeader && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>คุณต้องเป็นหัวหน้ากลุ่มจึงจะส่งแบบกลุ่มได้</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Group Selection for Group Submission */}
            {submissionType === "group" && (
              <div className="space-y-2">
                <Label htmlFor="group">กลุ่มเรียน</Label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger id="group">
                    <SelectValue placeholder="เลือกกลุ่มเรียน" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} - {group.year_level} ({group.major})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Teacher & Session Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teacher">
                  อาจารย์ที่ปรึกษา <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher} disabled={isLoadingTeachers}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={isLoadingTeachers ? "กำลังโหลด..." : "เลือกอาจารย์"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {teacherError ? (
                      <div className="p-4 text-center space-y-2">
                        <p className="text-sm text-destructive">{teacherError}</p>
                        <Button size="sm" variant="outline" onClick={fetchTeachers} disabled={isLoadingTeachers}>
                          <RefreshCw className={`w-3 h-3 mr-2 ${isLoadingTeachers ? "animate-spin" : ""}`} />
                          โหลดใหม่
                        </Button>
                      </div>
                    ) : availableTeachers.length === 0 ? (
                      <div className="p-4 text-center space-y-2">
                        <p className="text-sm text-muted-foreground">ไม่พบรายชื่ออาจารย์</p>
                        <Button size="sm" variant="outline" onClick={fetchTeachers} disabled={isLoadingTeachers}>
                          <RefreshCw className={`w-3 h-3 mr-2 ${isLoadingTeachers ? "animate-spin" : ""}`} />
                          โหลดใหม่
                        </Button>
                      </div>
                    ) : (
                      availableTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.first_name} {teacher.last_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {isLoadingTeachers ? "กำลังโหลดรายชื่ออาจารย์..." : `พบอาจารย์ ${availableTeachers.length} คน`}
                </p>
              </div>
              <div>
                <Label htmlFor="sessionNumber">
                  หมายเลขครั้งที่ <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sessionNumber"
                  type="number"
                  value={sessionNumber}
                  onChange={(e) => setSessionNumber(e.target.value)}
                  placeholder="เช่น 1, 2, 3..."
                  min="1"
                  max={requiredSessions}
                />
                <p className="text-xs text-muted-foreground mt-1">ระบุครั้งที่ 1-{requiredSessions}</p>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">
                อัปโหลดไฟล์ PDF <span className="text-red-500">*</span>
              </Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    const validation = validateFile(selectedFile);
                    if (validation.valid) {
                      setFile(selectedFile);
                    } else {
                      toast({
                        variant: "destructive",
                        title: "ไฟล์ไม่ถูกต้อง",
                        description: validation.error,
                      });
                      e.target.value = "";
                    }
                  }
                }}
              />
              {file && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <FileCheck className="w-3 h-3" />
                  เลือกไฟล์: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              <p className="text-xs text-muted-foreground">ไฟล์ PDF เท่านั้น ขนาดไม่เกิน 10 MB</p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={
                isUploading ||
                !file ||
                !sessionNumber ||
                !selectedTeacher ||
                isLoadingTeachers ||
                (submissionType === "group" && (!selectedGroup || !isLeader))
              }
              className="w-full"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  กำลังอัปโหลด...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  ส่งใบ Coaching ({submissionType === "individual" ? "ส่วนตัว" : "กลุ่ม"})
                </>
              )}
            </Button>
          </CardContent>
        </Card>

            {/* Sessions History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">📚 ประวัติการส่ง</CardTitle>
                <CardDescription>
                  ทั้งหมด {sessions.length} รายการ ({completedSessions} อนุมัติแล้ว)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Upload className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>ยังไม่มีประวัติการส่งใบ Coaching</p>
                    <p className="text-sm mt-2">เริ่มส่งใบ Coaching แรกของคุณเลย!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ครั้งที่</TableHead>
                          <TableHead>ประเภท</TableHead>
                          <TableHead>วันที่ส่ง</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead>คะแนน</TableHead>
                          <TableHead>ความคิดเห็นจากอาจารย์</TableHead>
                          <TableHead>ไฟล์</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.map((session) => (
                          <TableRow key={session.id} className="hover:bg-muted/50">
                            <TableCell className="font-bold text-lg">#{session.session_number}</TableCell>
                            <TableCell className="text-sm">
                              <Badge variant={session.group_id ? "default" : "outline"}>
                                {session.group_id ? "กลุ่ม" : "ส่วนตัว"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(session.created_at).toLocaleDateString("th-TH", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell>{getStatusBadge(session.status)}</TableCell>
                            <TableCell className="font-semibold text-center">
                              {session.score ? (
                                <div className="flex flex-col">
                                  <span className="text-xl text-green-600">
                                    {session.score}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    / {session.max_score || 100}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-md">
                              {session.teacher_comment ? (
                                <div className="p-3 bg-muted/50 rounded-lg border border-border">
                                  <p className="text-sm text-foreground whitespace-pre-wrap">
                                    💬 {session.teacher_comment}
                                  </p>
                                  {session.reviewed_at && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      ตรวจเมื่อ: {new Date(session.reviewed_at).toLocaleDateString("th-TH", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">ยังไม่มีความคิดเห็น</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => viewFile(session.file_url)} className="gap-2">
                                <Download className="w-4 h-4" />
                                ดู
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6">
            {user?.id && <AppointmentManager role="student" userId={user.id} />}
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">👤 ข้อมูลส่วนตัว</CardTitle>
                <CardDescription>จัดการข้อมูลและกลุ่มเรียนของคุณ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>ชื่อ-นามสกุล</Label>
                    <Input value={userName} disabled className="bg-muted" />
                  </div>
                  <div>
                    <Label>รหัสนักศึกษา</Label>
                    <Input value={profile?.student_id || "-"} disabled className="bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Group Management */}
            {user?.id && (
              <StudentGroupSelector 
                userId={user.id} 
                currentGroupId={selectedGroup} 
                onGroupChange={() => fetchData(user.id)}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
