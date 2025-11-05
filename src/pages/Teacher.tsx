import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { AppointmentManager } from "@/components/AppointmentManager";
import { AIAssistant } from "@/components/AIAssistant";
import { Footer } from "@/components/Footer";
import { LINENotificationSender } from "@/components/LINENotificationSender";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Calendar as CalendarIcon,
  MessageSquare,
  Users as UsersIcon,
  ClipboardCheck,
  MessageCircle,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Eye,
  BookOpen,
  ChevronDown,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const Teacher = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [eventRequests, setEventRequests] = useState<any[]>([]);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessionComment, setSessionComment] = useState("");
  const [sessionScore, setSessionScore] = useState<number>(100);
  const [groups, setGroups] = useState<any[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("teacher-realtime-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "coaching_sessions" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_bookings" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_requests" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teacher_assignments" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "student_groups" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAuth = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();

      if (roles?.role !== "teacher") {
        navigate("/");
        return;
      }

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      setUser(user);
      setProfile(profileData);
      fetchData(user.id);
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (teacherId: string) => {
    try {
      const [sessionsRes, leaveRes, roomRes, eventRes, assignmentsRes, allSessionsRes, groupsRes] = await Promise.all([
        supabase
          .from("coaching_sessions")
          .select(
            `
            *,
            student:profiles!coaching_sessions_student_id_fkey(first_name, last_name, student_id, group_id)
          `,
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),

        supabase
          .from("leave_requests")
          .select(
            `
            *,
            student:profiles!leave_requests_student_id_fkey(first_name, last_name, student_id)
          `,
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),

        supabase
          .from("room_bookings")
          .select(
            `
            *,
            student:profiles!room_bookings_student_id_fkey(first_name, last_name, student_id)
          `,
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),

        supabase
          .from("event_requests")
          .select(
            `
            *,
            student:profiles!event_requests_student_id_fkey(first_name, last_name, student_id)
          `,
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),

        supabase
          .from("teacher_assignments")
          .select(
            `
            *,
            student_groups(name, required_sessions)
          `,
          )
          .eq("teacher_id", teacherId),

        supabase
          .from("coaching_sessions")
          .select(
            `
            *,
            student:profiles!coaching_sessions_student_id_fkey(first_name, last_name, student_id, group_id)
          `,
          )
          .order("created_at", { ascending: false }),
        
        supabase.from("student_groups").select("*").order("name"),
      ]);

      setSessions(sessionsRes.data || []);
      setLeaveRequests(leaveRes.data || []);
      setRoomBookings(roomRes.data || []);
      setEventRequests(eventRes.data || []);
      setGroups(groupsRes.data || []);

      if (assignmentsRes.data) {
        const groupIds = assignmentsRes.data.map((a) => a.group_id);
        const teacherSessions = (allSessionsRes.data || []).filter((s: any) => groupIds.includes(s.student?.group_id));

        setProfile((prev: any) => ({
          ...prev,
          teacherAssignments: assignmentsRes.data,
          totalGroups: assignmentsRes.data.length,
          totalSessions: teacherSessions.length,
          approvedSessions: teacherSessions.filter((s: any) => s.status === "approved").length,
          pendingSessions: teacherSessions.filter((s: any) => s.status === "pending").length,
        }));
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลได้",
      });
    }
  };

  const handleApproveSession = async (sessionId: string, action: "approved" | "rejected", comment?: string, score?: number) => {
    try {
      const updateData: any = {
        status: action,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };

      if (comment) {
        updateData.teacher_comment = comment;
      }

      if (action === "approved" && score !== undefined) {
        updateData.score = score;
      }

      const { error } = await supabase.from("coaching_sessions").update(updateData).eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "สำเร็จ",
        description: `${action === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}ใบ coaching แล้ว`,
      });

      fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleReviewRequest = async (
    table: "leave_requests" | "room_bookings" | "event_requests",
    requestId: string,
    action: "approved" | "rejected",
  ) => {
    try {
      const { error } = await supabase
        .from(table)
        .update({
          status: action,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "สำเร็จ",
        description: `${action === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}คำขอแล้ว`,
      });

      fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleSaveGroup = async () => {
    if (!profile?.group_id) {
      toast({
        variant: "destructive",
        title: "กรุณาเลือกกลุ่ม",
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ group_id: profile.group_id })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast({
        title: "บันทึกสำเร็จ",
        description: "บันทึกกลุ่มของคุณแล้ว",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const viewFile = async (fileUrl: string) => {
    try {
      const { data, error } = await supabase.storage.from("coaching-forms").createSignedUrl(fileUrl, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถเปิดไฟล์ได้",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="teacher" userName="">
        <div className="space-y-4 p-2 sm:p-4 md:p-6">
          <Skeleton className="h-8 w-full sm:h-12" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <Skeleton className="h-16 sm:h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const pendingCount = sessions.length + leaveRequests.length + roomBookings.length + eventRequests.length;

  return (
    <DashboardLayout role="teacher" userName={`${profile?.first_name || ""} ${profile?.last_name || ""}`}>
      <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 p-2 sm:p-4 md:p-0">
        {/* Personal Information Section */}
        <Card className="shadow-sm border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">ข้อมูลส่วนตัว</CardTitle>
            <CardDescription>เลือกกลุ่มที่คุณดูแล</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teacher-group">กลุ่ม</Label>
                <Select
                  value={profile?.group_id || ""}
                  onValueChange={(value) => setProfile((prev: any) => ({ ...prev, group_id: value }))}
                >
                  <SelectTrigger id="teacher-group" className="bg-background">
                    <SelectValue placeholder="เลือกกลุ่ม" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-md z-50">
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} - {group.major} ปี {group.year_level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleSaveGroup}
                  disabled={isSavingProfile || !profile?.group_id}
                  className="w-full"
                >
                  {isSavingProfile ? "กำลังบันทึก..." : "บันทึกกลุ่ม"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile-Optimized Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="p-3 sm:p-4 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <UsersIcon className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-blue-500" />
                <span className="hidden sm:inline">กลุ่มที่ดูแล</span>
                <span className="sm:hidden">กลุ่ม</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold">{profile?.totalGroups || 0}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">กลุ่มเรียน</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 shadow-sm">
            <CardHeader className="p-3 sm:p-4 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-green-500" />
                <span className="hidden sm:inline">Coaching</span>
                <span className="sm:hidden">Coach</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold">{profile?.totalSessions || 0}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                อนุมัติ {profile?.approvedSessions || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 shadow-sm">
            <CardHeader className="p-3 sm:p-4 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-orange-500" />
                <span className="hidden sm:inline">รอตรวจ</span>
                <span className="sm:hidden">รอ</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold">{sessions.length}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">ใบ Coach</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500 shadow-sm">
            <CardHeader className="p-3 sm:p-4 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <ClipboardCheck className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-purple-500" />
                <span className="hidden sm:inline">คำขอ</span>
                <span className="sm:hidden">คำขอ</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                {leaveRequests.length + roomBookings.length + eventRequests.length}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                <span className="hidden sm:inline">ลา+ห้อง+กิจกรรม</span>
                <span className="sm:hidden">รายการ</span>
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-red-500 shadow-sm col-span-2 sm:col-span-1">
            <CardHeader className="p-3 sm:p-4 md:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-red-500" />
                <span className="hidden sm:inline">รอพิจารณา</span>
                <span className="sm:hidden">ทั้งหมด</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold">{pendingCount}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">รายการรอ</p>
            </CardContent>
          </Card>
        </div>

        {/* Mobile-Responsive Tabs */}
        <Tabs defaultValue="coaching" className="w-full">
          {/* Mobile: Scrollable Tab List */}
          <ScrollArea className="w-full whitespace-nowrap pb-2 md:pb-0">
            <TabsList className="inline-flex w-auto md:grid md:w-full md:grid-cols-7 h-auto p-1 bg-muted/50">
              <TabsTrigger
                value="coaching"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2 text-xs sm:text-sm"
              >
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Coaching</span>
                <span className="sm:hidden">Coach</span>
                {sessions.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5 p-0 text-[10px] flex items-center justify-center"
                  >
                    {sessions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2 text-xs sm:text-sm"
              >
                <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">ปฏิทิน</span>
                <span className="sm:hidden">ปฏิทิน</span>
              </TabsTrigger>
              <TabsTrigger
                value="appointments"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2 text-xs sm:text-sm"
              >
                <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">นัดหมาย</span>
                <span className="sm:hidden">นัด</span>
              </TabsTrigger>
              <TabsTrigger
                value="leave"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2 text-xs sm:text-sm"
              >
                <ClipboardCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">คำขอลา</span>
                <span className="sm:hidden">ลา</span>
                {leaveRequests.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5 p-0 text-[10px] flex items-center justify-center"
                  >
                    {leaveRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="rooms"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2 text-xs sm:text-sm"
              >
                <UsersIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">จองห้อง</span>
                <span className="sm:hidden">ห้อง</span>
                {roomBookings.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5 p-0 text-[10px] flex items-center justify-center"
                  >
                    {roomBookings.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="events"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2 text-xs sm:text-sm"
              >
                <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">จัดงาน</span>
                <span className="sm:hidden">งาน</span>
                {eventRequests.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5 p-0 text-[10px] flex items-center justify-center"
                  >
                    {eventRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="line"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2 text-xs sm:text-sm"
              >
                <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                LINE
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          {/* Coaching Tab - Mobile Optimized */}
          <TabsContent value="coaching" className="space-y-3 sm:space-y-4 animate-in fade-in duration-300 mt-4">
            <Card className="shadow-sm">
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  รอตรวจสอบใบ Coaching
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  มีใบ coaching รอตรวจสอบ {sessions.length} รายการ
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {sessions.length === 0 ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-xs sm:text-sm">ไม่มีใบ coaching ที่รอตรวจสอบ</AlertDescription>
                    </Alert>
                  ) : (
                    sessions.map((session) => (
                      <Card key={session.id} className="border-2 hover:shadow-md transition-shadow">
                        <CardContent className="p-3 sm:p-4 space-y-3">
                          {/* Mobile: Compact Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm sm:text-base truncate">
                                {session.student?.first_name} {session.student?.last_name}
                              </p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {session.student?.student_id} - ครั้งที่ {session.session_number}
                              </p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                {new Date(session.created_at).toLocaleDateString("th-TH", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="bg-orange-100 text-orange-700 text-[10px] sm:text-xs shrink-0"
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              <span className="hidden sm:inline">รอตรวจสอบ</span>
                              <span className="sm:hidden">รอ</span>
                            </Badge>
                          </div>

                          {/* Mobile: Stacked Buttons */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewFile(session.file_url)}
                              className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                              ดูไฟล์
                            </Button>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 sm:flex-initial bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-8 sm:h-9"
                                onClick={() => {
                                  setCurrentSession({ ...session, status: "approved" });
                                  setCommentDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                <span className="hidden sm:inline">อนุมัติ</span>
                                <span className="sm:hidden">✓</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1 sm:flex-initial text-xs sm:text-sm h-8 sm:h-9"
                                onClick={() => {
                                  setCurrentSession({ ...session, status: "rejected" });
                                  setCommentDialogOpen(true);
                                }}
                              >
                                <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                <span className="hidden sm:inline">ไม่อนุมัติ</span>
                                <span className="sm:hidden">✗</span>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="animate-in fade-in duration-300 mt-4">
            <div className="overflow-hidden rounded-lg">
              <AppointmentCalendar role="teacher" userId={user?.id || ""} />
            </div>
          </TabsContent>

          <TabsContent value="appointments" className="animate-in fade-in duration-300 mt-4">
            <AppointmentManager role="teacher" userId={user?.id || ""} />
          </TabsContent>

          {/* Leave Requests Tab - Mobile Optimized */}
          <TabsContent value="leave" className="space-y-3 sm:space-y-4 animate-in fade-in duration-300 mt-4">
            <Card className="shadow-sm">
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  คำขอลา
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  มีคำขอลารอตรวจสอบ {leaveRequests.length} รายการ
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {leaveRequests.length === 0 ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-xs sm:text-sm">ไม่มีคำขอลา</AlertDescription>
                    </Alert>
                  ) : (
                    leaveRequests.map((request) => (
                      <Card key={request.id} className="border-2 hover:shadow-md transition-shadow">
                        <CardContent className="p-3 sm:p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm sm:text-base truncate">
                                {request.student?.first_name} {request.student?.last_name}
                              </p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {request.leave_type === "sick"
                                  ? "ลาป่วย"
                                  : request.leave_type === "personal"
                                    ? "ลากิจ"
                                    : "อื่นๆ"}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="bg-orange-100 text-orange-700 text-[10px] sm:text-xs shrink-0"
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              รอ
                            </Badge>
                          </div>
                          <div className="bg-muted/50 p-2 sm:p-3 rounded-lg space-y-1.5 sm:space-y-2">
                            <p className="text-xs sm:text-sm">
                              <strong>วันที่:</strong>{" "}
                              {new Date(request.start_date).toLocaleDateString("th-TH", {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              -{" "}
                              {new Date(request.end_date).toLocaleDateString("th-TH", {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="text-xs sm:text-sm">
                              <strong>เหตุผล:</strong> {request.reason}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-8 sm:h-9"
                              onClick={() => handleReviewRequest("leave_requests", request.id, "approved")}
                            >
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              อนุมัติ
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
                              onClick={() => handleReviewRequest("leave_requests", request.id, "rejected")}
                            >
                              <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              ไม่อนุมัติ
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Room Bookings Tab - Mobile Optimized */}
          <TabsContent value="rooms" className="space-y-3 sm:space-y-4 animate-in fade-in duration-300 mt-4">
            <Card className="shadow-sm">
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  คำขอจองห้อง
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  มีคำขอจองห้องรอตรวจสอบ {roomBookings.length} รายการ
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {roomBookings.length === 0 ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-xs sm:text-sm">ไม่มีคำขอจองห้อง</AlertDescription>
                    </Alert>
                  ) : (
                    roomBookings.map((booking) => (
                      <Card key={booking.id} className="border-2 hover:shadow-md transition-shadow">
                        <CardContent className="p-3 sm:p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm sm:text-base truncate">
                                {booking.student?.first_name} {booking.student?.last_name}
                              </p>
                              <p className="text-xs sm:text-sm text-muted-foreground">{booking.room_name}</p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="bg-orange-100 text-orange-700 text-[10px] sm:text-xs shrink-0"
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              รอ
                            </Badge>
                          </div>
                          <div className="bg-muted/50 p-2 sm:p-3 rounded-lg space-y-1.5 sm:space-y-2">
                            <p className="text-xs sm:text-sm">
                              <strong>วันที่:</strong>{" "}
                              {new Date(booking.booking_date).toLocaleDateString("th-TH", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-xs sm:text-sm">
                              <strong>เวลา:</strong> {booking.start_time} - {booking.end_time}
                            </p>
                            <p className="text-xs sm:text-sm">
                              <strong>วัตถุประสงค์:</strong> {booking.purpose}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-8 sm:h-9"
                              onClick={() => handleReviewRequest("room_bookings", booking.id, "approved")}
                            >
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              อนุมัติ
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
                              onClick={() => handleReviewRequest("room_bookings", booking.id, "rejected")}
                            >
                              <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              ไม่อนุมัติ
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab - Mobile Optimized */}
          <TabsContent value="events" className="space-y-3 sm:space-y-4 animate-in fade-in duration-300 mt-4">
            <Card className="shadow-sm">
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  คำขอจัดกิจกรรม
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  มีคำขอจัดกิจกรรมรอตรวจสอบ {eventRequests.length} รายการ
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {eventRequests.length === 0 ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-xs sm:text-sm">ไม่มีคำขอจัดกิจกรรม</AlertDescription>
                    </Alert>
                  ) : (
                    eventRequests.map((event) => (
                      <Card key={event.id} className="border-2 hover:shadow-md transition-shadow">
                        <CardContent className="p-3 sm:p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm sm:text-base">{event.event_name}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                โดย {event.student?.first_name} {event.student?.last_name}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="bg-orange-100 text-orange-700 text-[10px] sm:text-xs shrink-0"
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              รอ
                            </Badge>
                          </div>
                          <div className="bg-muted/50 p-2 sm:p-3 rounded-lg space-y-1.5 sm:space-y-2">
                            <p className="text-xs sm:text-sm">
                              <strong>ประเภท:</strong> {event.event_type}
                            </p>
                            <p className="text-xs sm:text-sm">
                              <strong>วันที่:</strong>{" "}
                              {new Date(event.event_date).toLocaleDateString("th-TH", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-xs sm:text-sm">
                              <strong>เวลา:</strong> {event.start_time} - {event.end_time}
                            </p>
                            <p className="text-xs sm:text-sm">
                              <strong>สถานที่:</strong> {event.location || "-"}
                            </p>
                            <p className="text-xs sm:text-sm">
                              <strong>ผู้เข้าร่วม:</strong> {event.expected_participants || "-"} คน
                            </p>
                            <p className="text-xs sm:text-sm line-clamp-2">
                              <strong>รายละเอียด:</strong> {event.description}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-8 sm:h-9"
                              onClick={() => handleReviewRequest("event_requests", event.id, "approved")}
                            >
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              อนุมัติ
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
                              onClick={() => handleReviewRequest("event_requests", event.id, "rejected")}
                            >
                              <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              ไม่อนุมัติ
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="line" className="space-y-3 sm:space-y-4 animate-in fade-in duration-300 mt-4">
            <LINENotificationSender userId={user?.id || ""} role="teacher" />
          </TabsContent>
        </Tabs>

        {/* Mobile-Optimized Comment Dialog */}
        <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
          <DialogContent className="w-[95vw] max-w-md sm:max-w-lg mx-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                {currentSession?.status === "approved" ? "อนุมัติใบ Coaching" : "ไม่อนุมัติใบ Coaching"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {currentSession?.student && (
                  <span className="block">
                    นักศึกษา: {currentSession.student.first_name} {currentSession.student.last_name}
                    <br className="sm:hidden" />
                    <span className="hidden sm:inline"> </span>({currentSession.student.student_id}) - ครั้งที่{" "}
                    {currentSession.session_number}
                  </span>
                )}
                <br />
                <span className="text-[11px] sm:text-xs">เพิ่มความคิดเห็นสำหรับนักศึกษา (ไม่บังคับ)</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
              {currentSession?.status === "approved" && (
                <div className="space-y-2">
                  <Label htmlFor="score" className="text-xs sm:text-sm">
                    คะแนน (เต็m {currentSession?.max_score || 100})
                  </Label>
                  <Input
                    id="score"
                    type="number"
                    min="0"
                    max={currentSession?.max_score || 100}
                    value={sessionScore}
                    onChange={(e) => setSessionScore(parseInt(e.target.value) || 0)}
                    className="text-xs sm:text-sm"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="comment" className="text-xs sm:text-sm">
                  ความคิดเห็นของอาจารย์
                </Label>
                <Textarea
                  id="comment"
                  placeholder="พิมพ์ความคิดเห็นหรือข้อเสนอแนะ..."
                  value={sessionComment}
                  onChange={(e) => setSessionComment(e.target.value)}
                  rows={4}
                  className="text-xs sm:text-sm resize-none"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setCommentDialogOpen(false);
                  setSessionComment("");
                  setCurrentSession(null);
                }}
                className="w-full sm:w-auto text-xs sm:text-sm h-9"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={() => {
                  const action = currentSession?.status === "approved" ? "approved" : "rejected";
                  handleApproveSession(
                    currentSession?.id, 
                    action, 
                    sessionComment,
                    action === "approved" ? sessionScore : undefined
                  );
                  setCommentDialogOpen(false);
                  setSessionComment("");
                  setSessionScore(100);
                  setCurrentSession(null);
                }}
                className={cn(
                  "w-full sm:w-auto text-xs sm:text-sm h-9",
                  currentSession?.status === "approved" ? "bg-green-600 hover:bg-green-700" : "",
                )}
                variant={currentSession?.status === "rejected" ? "destructive" : "default"}
              >
                ยืนยัน{currentSession?.status === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile: Fixed Bottom AI Assistant Button */}
      <div className="block md:hidden">
        <AIAssistant />
      </div>
      {/* Desktop: Regular AI Assistant */}
      <div className="hidden md:block">
        <AIAssistant />
      </div>

      <Footer />
    </DashboardLayout>
  );
};

export default Teacher;
